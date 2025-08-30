const express = require('express');
const rateLimit = require('express-rate-limit');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const { authenticate } = require('../middleware/auth');
const { processFundBettingPurchase } = require('../services/bettingService');

const router = express.Router();

// Rate limiting for betting endpoints
const bettingRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each user to 10 betting requests per windowMs
  message: {
    error: 'Too many betting requests, please try again later.',
    retryAfter: 15 * 60 * 1000
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Fund betting account
router.post('/fund', authenticate, bettingRateLimit, async (req, res) => {
  try {
    const { provider, customerId, customerName, amount } = req.body;
    const userId = req.user.id;

    // Input validation
    if (!provider || !customerId || !amount) {
      return res.status(400).json({
        error: 'Missing required fields: provider, customerId, amount'
      });
    }

    // Validate amount
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({
        error: 'Invalid amount. Amount must be a positive number.'
      });
    }

    if (numAmount < 100) {
      return res.status(400).json({
        error: 'Minimum betting amount is ₦100'
      });
    }

    if (numAmount > 500000) {
      return res.status(400).json({
        error: 'Maximum betting amount is ₦500,000'
      });
    }

    // Get user and check transaction limits
    const user = await User.findById(userId).populate('wallet');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if user can transact this amount based on KYC level
    if (!user.canTransact(numAmount)) {
      return res.status(403).json({
        error: `Transaction amount exceeds your limit of ₦${user.getTransactionLimit().toLocaleString()}. Please upgrade your KYC level.`,
        transactionLimit: user.getTransactionLimit(),
        currentKycLevel: user.kycLevel
      });
    }

    // Check wallet balance
    const wallet = user.wallet || await user.getWallet();
    if (!wallet) {
      return res.status(500).json({ error: 'Wallet not found' });
    }

    if (wallet.balance < numAmount) {
      return res.status(400).json({
        error: 'Insufficient balance',
        currentBalance: wallet.balance,
        requiredAmount: numAmount
      });
    }

    // Check daily betting limits
    const dailyBettingStats = await Transaction.getDailyBettingTotal(userId);
    const dailyBettingTotal = dailyBettingStats[0]?.total || 0;
    const dailyLimit = user.kycLevel >= 2 ? 1000000 : 100000;

    if (dailyBettingTotal + numAmount > dailyLimit) {
      return res.status(400).json({
        error: `Daily betting limit of ₦${dailyLimit.toLocaleString()} would be exceeded`,
        currentDailyTotal: dailyBettingTotal,
        requestedAmount: numAmount,
        dailyLimit
      });
    }

    // Generate reference
    const reference = Transaction.generateReference('BET');
    const previousBalance = wallet.balance;
    const newBalance = wallet.balance - numAmount;

    // Create pending betting transaction
    const transaction = new Transaction({
      walletId: wallet._id,
      userId,
      type: 'debit',
      amount: numAmount,
      previousBalance,
      newBalance,
      description: `Betting Fund - ${provider.toUpperCase()} - ${customerId}`,
      reference,
      status: 'pending',
      category: 'betting',
      gateway: {
        provider: 'betting_service',
        gatewayReference: reference
      },
      metadata: {
        ip_address: req.ip,
        user_agent: req.get('User-Agent'),
        source: 'web',
        notes: `Betting account funding for ${provider.toUpperCase()}`,
        betting: {
          provider: provider.toUpperCase(),
          customerId: customerId.trim(),
          customerName: customerName?.trim() || '',
          retryCount: 0
        }
      }
    });

    await transaction.save();

    try {
      // Process the betting purchase
      const result = await processFundBettingPurchase({
        provider,
        customerId,
        customerName,
        amount: numAmount,
        userId
      });

      if (result.success) {
        // Update wallet balance
        wallet.balance = newBalance;
        wallet.lastTransactionAt = new Date();
        await wallet.save();

        // Mark transaction as successful
        await transaction.markBettingSuccess(
          result.successMessage,
          result.transactionData
        );

        return res.json({
          success: true,
          data: {
            reference: transaction.reference,
            provider: transaction.metadata.betting.provider,
            customerId: transaction.metadata.betting.customerId,
            amount: numAmount,
            description: transaction.description,
            status: 'completed',
            timestamp: transaction.createdAt,
            balanceAfter: wallet.balance
          },
          message: result.successMessage
        });

      } else {
        // Mark transaction as failed
        await transaction.markBettingFailed(
          result.errorMessage,
          result.transactionData
        );

        return res.status(400).json({
          error: result.errorMessage,
          reference: transaction.reference,
          canRetry: transaction.canRetryBetting()
        });
      }

    } catch (processingError) {
      // Mark transaction as failed
      await transaction.markBettingFailed(
        'Transaction processing failed. Please try again.',
        { error: processingError.message }
      );

      console.error('Betting processing error:', processingError);
      
      return res.status(500).json({
        error: 'Transaction processing failed. Please try again.',
        reference: transaction.reference,
        canRetry: true
      });
    }

  } catch (error) {
    console.error('Betting fund error:', error);
    res.status(500).json({
      error: 'Internal server error. Please try again.'
    });
  }
});

// Get user's betting transaction history
router.get('/transactions', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      page = 1,
      limit = 20,
      status,
      provider,
      startDate,
      endDate
    } = req.query;

    const transactions = await Transaction.getUserBettingTransactions(userId, {
      page: parseInt(page),
      limit: Math.min(parseInt(limit), 100),
      status,
      provider,
      startDate,
      endDate
    });

    const total = await Transaction.countDocuments({ 
      userId, 
      category: 'betting' 
    });

    // Format the response
    const formattedTransactions = transactions.map(tx => ({
      id: tx._id,
      reference: tx.reference,
      provider: tx.metadata?.betting?.provider || 'Unknown',
      customerId: tx.metadata?.betting?.customerId,
      customerName: tx.metadata?.betting?.customerName,
      amount: tx.amount,
      formattedAmount: tx.formattedAmount,
      status: tx.status,
      description: tx.description,
      timestamp: tx.createdAt,
      age: tx.age,
      canRetry: tx.canRetryBetting?.() || false
    }));

    res.json({
      success: true,
      data: {
        transactions: formattedTransactions,
        pagination: {
          current: parseInt(page),
          total: Math.ceil(total / limit),
          count: transactions.length,
          totalRecords: total
        }
      }
    });

  } catch (error) {
    console.error('Get betting transactions error:', error);
    res.status(500).json({
      error: 'Failed to fetch transaction history'
    });
  }
});

// Get betting statistics
router.get('/stats', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { period = '30d' } = req.query;

    const stats = await Transaction.getBettingStats(userId, period);
    
    const result = {
      period,
      total: 0,
      successful: 0,
      failed: 0,
      pending: 0,
      totalAmount: 0,
      successfulAmount: 0
    };

    stats.forEach(stat => {
      result.total += stat.count;
      result.totalAmount += stat.totalAmount;

      if (stat._id === 'completed') {
        result.successful = stat.count;
        result.successfulAmount = stat.totalAmount;
      } else if (stat._id === 'failed') {
        result.failed = stat.count;
      } else if (stat._id === 'pending') {
        result.pending = stat.count;
      }
    });

    result.successRate = result.total > 0 ? ((result.successful / result.total) * 100).toFixed(2) : 0;

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Get betting stats error:', error);
    res.status(500).json({
      error: 'Failed to fetch betting statistics'
    });
  }
});

// Retry failed transaction
router.post('/retry/:reference', authenticate, async (req, res) => {
  try {
    const { reference } = req.params;
    const userId = req.user.id;

    const transaction = await Transaction.findOne({
      reference,
      userId,
      category: 'betting'
    });

    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    if (!transaction.canRetryBetting()) {
      const retryCount = transaction.metadata?.betting?.retryCount || 0;
      return res.status(400).json({
        error: 'Transaction cannot be retried',
        reason: retryCount >= 3 ? 'Maximum retry attempts exceeded' : 'Transaction not failed'
      });
    }

    // Increment retry count
    await transaction.incrementBettingRetry();

    // Retry the transaction
    const result = await processFundBettingPurchase({
      provider: transaction.metadata.betting.provider.toLowerCase(),
      customerId: transaction.metadata.betting.customerId,
      customerName: transaction.metadata.betting.customerName,
      amount: transaction.amount,
      userId
    });

    if (result.success) {
      await transaction.markBettingSuccess(
        result.successMessage,
        result.transactionData
      );

      res.json({
        success: true,
        message: 'Transaction retry successful',
        data: {
          reference: transaction.reference,
          status: 'completed'
        }
      });
    } else {
      await transaction.markBettingFailed(
        result.errorMessage,
        result.transactionData
      );

      res.status(400).json({
        error: result.errorMessage,
        canRetry: transaction.canRetryBetting()
      });
    }

  } catch (error) {
    console.error('Retry betting transaction error:', error);
    res.status(500).json({
      error: 'Failed to retry transaction'
    });
  }
});

// Get betting providers
router.get('/providers', (req, res) => {
  const providers = [
    { id: 'bet9ja', name: 'Bet9ja', logo: null },
    { id: 'sportybet', name: 'SportyBet', logo: null },
    { id: 'nairabet', name: 'NairaBet', logo: null },
    { id: 'betway', name: 'Betway', logo: null },
    { id: '1xbet', name: '1xBet', logo: null },
    { id: 'betking', name: 'BetKing', logo: null },
    { id: 'merrybet', name: 'MerryBet', logo: null }
  ];

  res.json({
    success: true,
    data: providers
  });
});

module.exports = router;