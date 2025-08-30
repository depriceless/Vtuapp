const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const { authenticate } = require('../middleware/auth');

// GET /api/wallet/balance - Get current wallet balance
router.get('/wallet/balance', authenticate, async (req, res) => {
  try {
    const wallet = await Wallet.findByUserId(req.user.userId);
    
    if (!wallet) {
      return res.status(404).json({ 
        success: false, 
        message: 'Wallet not found' 
      });
    }

    // Get recent transactions
    const recentTransactions = await Transaction.getWalletTransactions(wallet._id, { limit: 5 });

    res.json({
      success: true,
      balance: wallet.balance,
      formattedBalance: wallet.formattedBalance,
      wallet: {
        id: wallet._id,
        isActive: wallet.isActive,
        currency: wallet.currency,
        lastTransactionDate: wallet.lastTransactionDate
      },
      stats: wallet.stats,
      recentTransactions
    });

  } catch (error) {
    console.error('Get balance error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error fetching balance' 
    });
  }
});

// POST /api/wallet/fund - Manual wallet funding
router.post('/wallet/fund', authenticate, async (req, res) => {
  try {
    const { amount, description } = req.body;

    // Validate amount
    if (!amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid amount. Please enter a valid positive number.' 
      });
    }

    if (amount > 1000000) {
      return res.status(400).json({ 
        success: false, 
        message: 'Amount cannot exceed ₦1,000,000' 
      });
    }

    // Find or create wallet
    let wallet = await Wallet.findByUserId(req.user.userId);
    if (!wallet) {
      wallet = await Wallet.createForUser(req.user.userId);
    }

    // Credit wallet using wallet method
    const result = await wallet.credit(
      Number(amount), 
      description || `Manual wallet funding: ₦${Number(amount).toLocaleString()}`
    );

    console.log(`Wallet funded: ${wallet.userId} - ₦${amount}`);

    res.json({
      success: true,
      message: `Wallet funded successfully! ₦${Number(amount).toLocaleString()} added to your account.`,
      balance: result.wallet.balance,
      formattedBalance: result.wallet.formattedBalance,
      transaction: result.transaction
    });

  } catch (error) {
    console.error('Fund wallet error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Server error occurred while funding wallet' 
    });
  }
});

// POST /api/wallet/debit - Debit from wallet
router.post('/wallet/debit', authenticate, async (req, res) => {
  try {
    const { amount, description, reference } = req.body;

    // Validate amount
    if (!amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid amount' 
      });
    }

    const wallet = await Wallet.findByUserId(req.user.userId);
    if (!wallet) {
      return res.status(404).json({ 
        success: false, 
        message: 'Wallet not found' 
      });
    }

    // Debit wallet using wallet method
    const result = await wallet.debit(
      Number(amount), 
      description || `Wallet debit: ₦${Number(amount).toLocaleString()}`,
      reference
    );

    console.log(`Wallet debited: ${wallet.userId} - ₦${amount}`);

    res.json({
      success: true,
      message: `₦${Number(amount).toLocaleString()} debited from your wallet.`,
      balance: result.wallet.balance,
      formattedBalance: result.wallet.formattedBalance,
      transaction: result.transaction
    });

  } catch (error) {
    console.error('Debit wallet error:', error);
    res.status(400).json({ 
      success: false, 
      message: error.message || 'Server error occurred while processing debit' 
    });
  }
});

// GET /api/wallet/transactions - Get transaction history
router.get('/wallet/transactions', authenticate, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      type, 
      status,
      startDate, 
      endDate 
    } = req.query;

    const wallet = await Wallet.findByUserId(req.user.userId);
    if (!wallet) {
      return res.status(404).json({ 
        success: false, 
        message: 'Wallet not found' 
      });
    }

    // Get transactions using static method
    const transactions = await Transaction.getUserTransactions(req.user.userId, {
      page: parseInt(page),
      limit: parseInt(limit),
      type,
      status,
      startDate,
      endDate
    });

    // Get total count for pagination
    const totalQuery = { userId: req.user.userId };
    if (type) totalQuery.type = type;
    if (status) totalQuery.status = status;
    if (startDate || endDate) {
      totalQuery.createdAt = {};
      if (startDate) totalQuery.createdAt.$gte = new Date(startDate);
      if (endDate) totalQuery.createdAt.$lte = new Date(endDate);
    }
    
    const totalTransactions = await Transaction.countDocuments(totalQuery);

    res.json({
      success: true,
      transactions,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalTransactions / limit),
        totalTransactions,
        hasNext: (page * limit) < totalTransactions,
        hasPrev: page > 1
      },
      wallet: {
        balance: wallet.balance,
        formattedBalance: wallet.formattedBalance,
        stats: wallet.stats
      }
    });

  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error fetching transactions' 
    });
  }
});

// POST /api/wallet/transfer - Transfer to another user
router.post('/wallet/transfer', authenticate, async (req, res) => {
  try {
    const { recipientEmail, amount, description } = req.body;

    // Validation
    if (!recipientEmail || !amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please provide valid recipient email and amount' 
      });
    }

    if (amount > 500000) {
      return res.status(400).json({ 
        success: false, 
        message: 'Transfer amount cannot exceed ₦500,000' 
      });
    }

    // Find sender and recipient
    const sender = await User.findById(req.user.userId);
    const recipient = await User.findOne({ email: recipientEmail.toLowerCase() });

    if (!sender) {
      return res.status(404).json({ success: false, message: 'Sender not found' });
    }

    if (!recipient) {
      return res.status(404).json({ success: false, message: 'Recipient not found' });
    }

    if (sender._id.toString() === recipient._id.toString()) {
      return res.status(400).json({ success: false, message: 'Cannot transfer to yourself' });
    }

    // Get wallets
    const senderWallet = await Wallet.findByUserId(sender._id);
    let recipientWallet = await Wallet.findByUserId(recipient._id);

    if (!senderWallet) {
      return res.status(404).json({ success: false, message: 'Sender wallet not found' });
    }

    // Create recipient wallet if doesn't exist
    if (!recipientWallet) {
      recipientWallet = await Wallet.createForUser(recipient._id);
    }

    // Perform transfer using wallet method
    const result = await senderWallet.transfer(
      recipientWallet, 
      Number(amount),
      description || `Transfer to ${recipient.name}`
    );

    console.log(`Transfer: ${sender.name} → ${recipient.name}: ₦${amount}`);

    res.json({
      success: true,
      message: `₦${Number(amount).toLocaleString()} transferred successfully to ${recipient.name}`,
      transfer: {
        amount: Number(amount),
        recipient: {
          name: recipient.name,
          email: recipient.email
        },
        reference: result.reference,
        newBalance: senderWallet.balance,
        formattedBalance: senderWallet.formattedBalance
      }
    });

  } catch (error) {
    console.error('Transfer error:', error);
    res.status(400).json({ 
      success: false, 
      message: error.message || 'Server error occurred during transfer' 
    });
  }
});

// GET /api/wallet/stats - Get wallet statistics
router.get('/wallet/stats', authenticate, async (req, res) => {
  try {
    const wallet = await Wallet.findByUserId(req.user.userId);
    
    if (!wallet) {
      return res.status(404).json({ 
        success: false, 
        message: 'Wallet not found' 
      });
    }

    // Get additional stats from transactions
    const thirtyDaysAgo = new Date(Date.now() - (30 * 24 * 60 * 60 * 1000));
    const sevenDaysAgo = new Date(Date.now() - (7 * 24 * 60 * 60 * 1000));

    const monthlyTransactions = await Transaction.countDocuments({
      userId: req.user.userId,
      createdAt: { $gte: thirtyDaysAgo }
    });

    const weeklyTransactions = await Transaction.countDocuments({
      userId: req.user.userId,
      createdAt: { $gte: sevenDaysAgo }
    });

    res.json({
      success: true,
      stats: {
        currentBalance: wallet.balance,
        formattedBalance: wallet.formattedBalance,
        ...wallet.stats,
        monthlyTransactions,
        weeklyTransactions,
        walletAge: Math.ceil((new Date() - wallet.createdAt) / (24 * 60 * 60 * 1000)),
        isActive: wallet.isActive,
        currency: wallet.currency
      }
    });

  } catch (error) {
    console.error('Get wallet stats error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error fetching wallet statistics' 
    });
  }
});

// POST /api/wallet/create - Create wallet for user (if needed)
router.post('/wallet/create', authenticate, async (req, res) => {
  try {
    const existingWallet = await Wallet.findByUserId(req.user.userId);
    
    if (existingWallet) {
      return res.status(400).json({
        success: false,
        message: 'User already has a wallet'
      });
    }

    const wallet = await Wallet.createForUser(req.user.userId);

    res.json({
      success: true,
      message: 'Wallet created successfully',
      wallet: {
        id: wallet._id,
        balance: wallet.balance,
        formattedBalance: wallet.formattedBalance,
        currency: wallet.currency
      }
    });

  } catch (error) {
    console.error('Create wallet error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error creating wallet'
    });
  }
});

module.exports = router;