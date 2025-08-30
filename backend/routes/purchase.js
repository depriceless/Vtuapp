// routes/purchase.js - UPDATED VERSION WITH DATA PURCHASE FIXES
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { authenticate } = require('../middleware/auth');
const User = require('../models/User');
const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const { DATA_PLANS } = require('../config/dataPlans');

// PIN attempt tracking (in-memory storage for simplicity)
const pinAttempts = new Map();

// PIN configuration
const PIN_CONFIG = {
  MAX_ATTEMPTS: 3,
  LOCK_DURATION: 15 * 60 * 1000, // 15 minutes in milliseconds
  PIN_EXPIRY: 24 * 60 * 60 * 1000 // 24 hours for PIN reset
};

// Data plans for validation (should match the data.js route)
// 

// Helper function to get PIN attempt data
const getPinAttemptData = (userId) => {
  if (!pinAttempts.has(userId)) {
    pinAttempts.set(userId, {
      attempts: 0,
      lockedUntil: null,
      lastAttempt: null
    });
  }
  return pinAttempts.get(userId);
};

// Helper function to reset PIN attempts
const resetPinAttempts = (userId) => {
  pinAttempts.set(userId, {
    attempts: 0,
    lockedUntil: null,
    lastAttempt: null
  });
};

// GET /api/purchase/pin-status - Check PIN setup and lock status
router.get('/pin-status', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('+pin');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const isPinSet = Boolean(user.pin && user.isPinSetup);

    const attemptData = getPinAttemptData(req.user.userId);
    const now = new Date();

    let isLocked = false;
    let lockTimeRemaining = 0;

    if (attemptData.lockedUntil && now < attemptData.lockedUntil) {
      isLocked = true;
      lockTimeRemaining = Math.ceil((attemptData.lockedUntil - now) / (1000 * 60));
    } else if (attemptData.lockedUntil && now >= attemptData.lockedUntil) {
      resetPinAttempts(req.user.userId);
    }

    res.json({
      success: true,
      isPinSet: isPinSet,
      hasPinSet: isPinSet,
      isLocked,
      lockTimeRemaining,
      attemptsRemaining: Math.max(0, PIN_CONFIG.MAX_ATTEMPTS - attemptData.attempts)
    });

  } catch (error) {
    console.error('PIN status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error checking PIN status'
    });
  }
});

// POST /api/purchase/validate-pin - Validate transaction PIN (OPTIONAL - can be removed if not using separate validation)
router.post('/validate-pin', authenticate, async (req, res) => {
  try {
    const { pin } = req.body;

    if (!pin || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      return res.status(400).json({
        success: false,
        message: 'PIN must be exactly 4 digits'
      });
    }

    const user = await User.findById(req.user.userId).select('+pin');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (!user.pin || !user.isPinSetup) {
      return res.status(400).json({
        success: false,
        message: 'PIN not set. Please set up your transaction PIN first.'
      });
    }

    const attemptData = getPinAttemptData(req.user.userId);
    const now = new Date();

    // Check if account is locked
    if (attemptData.lockedUntil && now < attemptData.lockedUntil) {
      const remainingMinutes = Math.ceil((attemptData.lockedUntil - now) / (1000 * 60));
      return res.status(423).json({
        success: false,
        message: `Account locked due to too many failed attempts. Try again in ${remainingMinutes} minutes.`
      });
    }

    let isPinValid;
    try {
      isPinValid = await user.comparePin(pin);
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: 'PIN not set. Please set up your transaction PIN first.'
      });
    }

    if (isPinValid) {
      resetPinAttempts(req.user.userId);
      
      res.json({
        success: true,
        message: 'PIN validated successfully'
      });
    } else {
      attemptData.attempts += 1;
      attemptData.lastAttempt = now;

      if (attemptData.attempts >= PIN_CONFIG.MAX_ATTEMPTS) {
        attemptData.lockedUntil = new Date(now.getTime() + PIN_CONFIG.LOCK_DURATION);
        
        res.status(423).json({
          success: false,
          message: `Invalid PIN. Account locked for ${PIN_CONFIG.LOCK_DURATION / (1000 * 60)} minutes due to too many failed attempts.`
        });
      } else {
        const remainingAttempts = PIN_CONFIG.MAX_ATTEMPTS - attemptData.attempts;
        res.status(400).json({
          success: false,
          message: `Invalid PIN. ${remainingAttempts} attempts remaining.`
        });
      }
    }

  } catch (error) {
    console.error('PIN validation error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error validating PIN'
    });
  }
});

// POST /api/purchase - Process any service purchase
router.post('/', authenticate, async (req, res) => {
  try {
    const { type, amount, pin, ...serviceData } = req.body;

    console.log('Purchase request received:', { type, amount, serviceData });

    // Basic validation
    if (!type || !amount || !pin) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: type, amount, pin'
      });
    }

    if (!/^\d{4}$/.test(pin)) {
      return res.status(400).json({
        success: false,
        message: 'PIN must be exactly 4 digits'
      });
    }

    // Different amount limits for different services
    const amountLimits = {
      airtime: { min: 50, max: 500000 },
      data: { min: 50, max: 500000 },
      electricity: { min: 100, max: 100000 },
      education: { min: 500, max: 1000000 },
      print_recharge: { min: 100, max: 50000 },
      transfer: { min: 100, max: 1000000 },
      internet: { min: 500, max: 200000 },
      fund_betting: { min: 100, max: 500000 }
    };

   const validTypes = ['airtime', 'data', 'electricity', 'education', 'print_recharge', 'transfer', 'internet', 'fund_betting'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        message: `Invalid service type. Must be one of: ${validTypes.join(', ')}`
      });
    }

    const limits = amountLimits[type];
    if (amount < limits.min || amount > limits.max) {
      return res.status(400).json({
        success: false,
        message: `Amount must be between ₦${limits.min.toLocaleString()} and ₦${limits.max.toLocaleString()} for ${type}`
      });
    }

    // Get user with +pin field included
    const user = await User.findById(req.user.userId).select('+pin');
    const wallet = await Wallet.findOne({ userId: req.user.userId });

    if (!user || !wallet) {
      return res.status(404).json({
        success: false,
        message: 'User or wallet not found'
      });
    }

    if (!user.pin || !user.isPinSetup) {
      return res.status(400).json({
        success: false,
        message: 'Transaction PIN not set. Please set up your PIN first.'
      });
    }

    // Check account lock status
    const attemptData = getPinAttemptData(req.user.userId);
    const now = new Date();

    if (attemptData.lockedUntil && now < attemptData.lockedUntil) {
      const remainingMinutes = Math.ceil((attemptData.lockedUntil - now) / (1000 * 60));
      return res.status(423).json({
        success: false,
        message: `Account locked. Try again in ${remainingMinutes} minutes.`
      });
    }

    // Validate PIN
    let isPinValid;
    try {
      isPinValid = await user.comparePin(pin);
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: 'PIN not set. Please set up your transaction PIN first.'
      });
    }

    if (!isPinValid) {
      attemptData.attempts += 1;
      attemptData.lastAttempt = now;

      if (attemptData.attempts >= PIN_CONFIG.MAX_ATTEMPTS) {
        attemptData.lockedUntil = new Date(now.getTime() + PIN_CONFIG.LOCK_DURATION);
        return res.status(423).json({
          success: false,
          message: 'Invalid PIN. Account locked due to too many failed attempts.'
        });
      }

      return res.status(400).json({
        success: false,
        message: `Invalid PIN. ${PIN_CONFIG.MAX_ATTEMPTS - attemptData.attempts} attempts remaining.`
      });
    }

    // Check sufficient balance
    if (wallet.balance < amount) {
      return res.status(400).json({
        success: false,
        message: `Insufficient balance. Available: ₦${wallet.balance.toLocaleString()}, Required: ₦${amount.toLocaleString()}`
      });
    }

    // Reset PIN attempts on successful validation
    resetPinAttempts(req.user.userId);

    // Process purchase based on type
    let purchaseResult;
    switch (type) {
      case 'airtime':
        purchaseResult = await processAirtimePurchase({
          ...serviceData,
          amount,
          userId: req.user.userId
        });
        break;
      case 'data':
        // FIXED: Enhanced data purchase processing
        purchaseResult = await processDataPurchase({
          ...serviceData,
          amount,
          userId: req.user.userId
        });
        break;
      case 'electricity':
        purchaseResult = await processElectricityPurchase({
          ...serviceData,
          amount,
          userId: req.user.userId
        });
        break;
      case 'education':
        purchaseResult = await processEducationPurchase({
          ...serviceData,
          amount,
          userId: req.user.userId
        });
        break;
      case 'print_recharge':
        purchaseResult = await processPrintRechargePurchase({
          ...serviceData,
          amount,
          userId: req.user.userId
        });
        break;
      case 'transfer':
        purchaseResult = await processTransferPurchase({
          ...serviceData,
          amount,
          userId: req.user.userId
        });
        break;
      case 'internet':
        purchaseResult = await processInternetPurchase({
          ...serviceData,
          amount,
          userId: req.user.userId
        });
        break;
      case 'fund_betting':
        purchaseResult = await processFundBettingPurchase({
          ...serviceData,
          amount,
          userId: req.user.userId
        });
        break;
      default:
        return res.status(400).json({
          success: false,
          message: 'Unsupported service type'
        });
    }

    if (purchaseResult.success) {
      // Debit wallet using the model method
      const transactionResult = await wallet.debit(
        amount,
        purchaseResult.description,
        purchaseResult.reference
      );

      res.json({
        success: true,
        message: purchaseResult.successMessage,
        transaction: {
          _id: purchaseResult.reference,
          type,
          amount,
          ...purchaseResult.transactionData,
          status: 'completed',
          reference: purchaseResult.reference,
          responseMessage: 'Transaction completed successfully',
          timestamp: new Date()
        },
        newBalance: {
          mainBalance: transactionResult.wallet.balance,
          bonusBalance: 0,
          totalBalance: transactionResult.wallet.balance
        }
      });
    } else {
      // Return failure response
      res.status(400).json({
        success: false,
        message: purchaseResult.errorMessage || 'Purchase failed',
        transaction: {
          _id: purchaseResult.reference,
          type,
          amount,
          ...purchaseResult.transactionData,
          status: 'failed',
          reference: purchaseResult.reference,
          responseMessage: purchaseResult.errorMessage || 'Purchase failed',
          timestamp: new Date()
        }
      });
    }

  } catch (error) {
    console.error('Purchase error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error processing purchase'
    });
  }
});

// ENHANCED Data purchase processing function
async function processDataPurchase({ network, phone, planId, plan, amount, userId }) {
  try {
    console.log('Processing data purchase:', { network, phone, planId, plan, amount });

    // Validate data-specific fields
    if (!network || !phone) {
      throw new Error('Missing required fields: network, phone');
    }

    if (!/^0[789][01]\d{8}$/.test(phone)) {
      throw new Error('Invalid phone number format');
    }

    const validNetworks = ['mtn', 'airtel', 'glo', '9mobile'];
    if (!validNetworks.includes(network)) {
      throw new Error('Invalid network');
    }

    // FIXED: Validate data plan if planId is provided
    let validatedPlan = null;
    if (planId) {
      // Find the plan in our data plans
      const networkPlans = DATA_PLANS[network];
      if (networkPlans) {
        validatedPlan = networkPlans.find(p => p.id === planId);
        if (!validatedPlan) {
          throw new Error(`Invalid plan ID ${planId} for network ${network}`);
        }
        
        // Validate amount matches the plan
        if (validatedPlan.amount !== amount) {
          throw new Error(`Amount mismatch: expected ₦${validatedPlan.amount}, received ₦${amount}`);
        }
      }
    }

    // If no planId provided but plan name is given, try to find by name
    if (!validatedPlan && plan) {
      const networkPlans = DATA_PLANS[network];
      if (networkPlans) {
        validatedPlan = networkPlans.find(p => p.name === plan);
      }
    }

    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    const reference = `DATA_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const isSuccessful = Math.random() > 0.15; // 85% success rate

    if (isSuccessful) {
      const description = validatedPlan ? 
        `Data purchase - ${network.toUpperCase()} ${validatedPlan.name} (${validatedPlan.dataSize}) - ${phone}` :
        `Data purchase - ${network.toUpperCase()} ${plan || 'Data Plan'} - ${phone}`;

      return {
        success: true,
        reference,
        description,
        successMessage: 'Data purchase successful',
        transactionData: {
          network: network.toUpperCase(),
          phone,
          plan: validatedPlan ? validatedPlan.name : plan,
          planId: validatedPlan ? validatedPlan.id : planId,
          dataSize: validatedPlan ? validatedPlan.dataSize : 'N/A',
          validity: validatedPlan ? validatedPlan.validity : 'N/A',
          serviceType: 'data'
        }
      };
    } else {
      return {
        success: false,
        reference,
        errorMessage: 'Data service temporarily unavailable. Please try again.',
        transactionData: {
          network: network.toUpperCase(),
          phone,
          plan: validatedPlan ? validatedPlan.name : plan,
          planId: validatedPlan ? validatedPlan.id : planId,
          serviceType: 'data'
        }
      };
    }
  } catch (error) {
    console.error('Data purchase processing error:', error);
    
    const reference = `DATA_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    return {
      success: false,
      reference,
      errorMessage: error.message,
      transactionData: {
        network: network?.toUpperCase(),
        phone,
        plan,
        planId,
        serviceType: 'data'
      }
    };
  }
}

// Airtime purchase
async function processAirtimePurchase({ network, phone, amount, userId }) {
  // Validate airtime-specific data
  if (!network || !phone) {
    throw new Error('Missing required fields: network, phone');
  }

  if (!/^0[789][01]\d{8}$/.test(phone)) {
    throw new Error('Invalid phone number format');
  }

  const validNetworks = ['mtn', 'airtel', 'glo', '9mobile'];
  if (!validNetworks.includes(network)) {
    throw new Error('Invalid network');
  }

  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 1000));

  const reference = `AIR_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const isSuccessful = Math.random() > 0.1; // 90% success rate

  if (isSuccessful) {
    return {
      success: true,
      reference,
      description: `Airtime purchase - ${network.toUpperCase()} - ${phone}`,
      successMessage: 'Airtime purchase successful',
      transactionData: {
        network: network.toUpperCase(),
        phone,
        serviceType: 'airtime'
      }
    };
  } else {
    return {
      success: false,
      reference,
      errorMessage: 'Network service temporarily unavailable. Please try again.',
      transactionData: {
        network: network.toUpperCase(),
        phone,
        serviceType: 'airtime'
      }
    };
  }
}


// Electricity purchase
async function processElectricityPurchase({ provider, meterNumber, meterType, amount, userId }) {
  // Validate electricity-specific fields
  if (!provider || !meterNumber || !meterType) {
    throw new Error('Missing required fields: provider, meterNumber, meterType');
  }

  const validProviders = ['eko', 'ikeja', 'abuja', 'kano', 'portharcourt'];
  if (!validProviders.includes(provider)) {
    throw new Error('Invalid electricity provider');
  }

  const validMeterTypes = ['prepaid', 'postpaid'];
  if (!validMeterTypes.includes(meterType)) {
    throw new Error('Invalid meter type');
  }

  // Simulate API call
  await new Promise(resolve => setTimeout(resolve, 2500));

  const reference = `ELEC_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const isSuccessful = Math.random() > 0.25; // 75% success rate

  if (isSuccessful) {
    // Generate mock token for prepaid
    const token = meterType === 'prepaid' ? 
      `${Math.random().toString().substr(2, 4)}-${Math.random().toString().substr(2, 4)}-${Math.random().toString().substr(2, 4)}-${Math.random().toString().substr(2, 4)}` : 
      null;

    return {
      success: true,
      reference,
      description: `Electricity - ${provider.toUpperCase()} ${meterType} - ${meterNumber}`,
      successMessage: `Electricity ${meterType === 'prepaid' ? 'token' : 'payment'} successful`,
      transactionData: {
        provider: provider.toUpperCase(),
        meterNumber,
        meterType,
        token,
        serviceType: 'electricity'
      }
    };
  } else {
    return {
      success: false,
      reference,
      errorMessage: 'Electricity service temporarily unavailable. Please try again.',
      transactionData: {
        provider: provider.toUpperCase(),
        meterNumber,
        meterType,
        serviceType: 'electricity'
      }
    };
  }
}

// Education purchase (School fees, WAEC, JAMB, etc.)
async function processEducationPurchase({ provider, studentId, examType, candidateName, amount, userId }) {
  // Validate education-specific fields
  if (!provider) {
    throw new Error('Missing required field: provider');
  }

  const validProviders = ['waec', 'jamb', 'neco', 'nabteb', 'school_fees'];
  if (!validProviders.includes(provider)) {
    throw new Error('Invalid education provider');
  }

  // Validate based on provider type
  if (['waec', 'jamb', 'neco', 'nabteb'].includes(provider)) {
    if (!examType) {
      throw new Error('Exam type is required for examination payments');
    }
  }

  if (provider === 'school_fees' && !studentId) {
    throw new Error('Student ID is required for school fees payment');
  }

  // Simulate API call
  await new Promise(resolve => setTimeout(resolve, 2000));

  const reference = `EDU_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const isSuccessful = Math.random() > 0.15; // 85% success rate

  if (isSuccessful) {
    let description;
    if (provider === 'school_fees') {
      description = `School Fees Payment - ${studentId}`;
    } else {
      description = `${provider.toUpperCase()} ${examType || ''} - ${candidateName || 'Candidate'}`.trim();
    }

    return {
      success: true,
      reference,
      description,
      successMessage: `${provider === 'school_fees' ? 'School fees' : 'Examination'} payment successful`,
      transactionData: {
        provider: provider.toUpperCase(),
        studentId,
        examType,
        candidateName,
        serviceType: 'education'
      }
    };
  } else {
    return {
      success: false,
      reference,
      errorMessage: 'Education service temporarily unavailable. Please try again.',
      transactionData: {
        provider: provider.toUpperCase(),
        studentId,
        examType,
        candidateName,
        serviceType: 'education'
      }
    };
  }
}

// Print recharge purchase
async function processPrintRechargePurchase({ provider, printerId, printerType, amount, userId }) {
  // Validate print recharge fields
  if (!provider || !printerId) {
    throw new Error('Missing required fields: provider, printerId');
  }

  const validProviders = ['epins', 'printivo', 'campus_print', 'quickprint'];
  if (!validProviders.includes(provider)) {
    throw new Error('Invalid print provider');
  }

  const validPrinterTypes = ['laser', 'inkjet', 'photo', '3d'];
  if (printerType && !validPrinterTypes.includes(printerType)) {
    throw new Error('Invalid printer type');
  }

  // Simulate API call
  await new Promise(resolve => setTimeout(resolve, 1500));

  const reference = `PRINT_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const isSuccessful = Math.random() > 0.1; // 90% success rate

  if (isSuccessful) {
    // Generate print credit code
    const creditCode = `PC${Math.random().toString(36).substr(2, 8).toUpperCase()}`;

    return {
      success: true,
      reference,
      description: `Print Recharge - ${provider.toUpperCase()} - ${printerId}`,
      successMessage: 'Print recharge successful',
      transactionData: {
        provider: provider.toUpperCase(),
        printerId,
        printerType,
        creditCode,
        serviceType: 'print_recharge'
      }
    };
  } else {
    return {
      success: false,
      reference,
      errorMessage: 'Print service temporarily unavailable. Please try again.',
      transactionData: {
        provider: provider.toUpperCase(),
        printerId,
        printerType,
        serviceType: 'print_recharge'
      }
    };
  }
}

// Transfer purchase (Bank transfer, wallet transfer)
async function processTransferPurchase({ transferType, bankCode, accountNumber, accountName, walletId, amount, userId }) {
  // Validate transfer fields
  if (!transferType) {
    throw new Error('Missing required field: transferType');
  }

  const validTransferTypes = ['bank_transfer', 'wallet_transfer'];
  if (!validTransferTypes.includes(transferType)) {
    throw new Error('Invalid transfer type');
  }

  if (transferType === 'bank_transfer') {
    if (!bankCode || !accountNumber || !accountName) {
      throw new Error('Missing required fields for bank transfer: bankCode, accountNumber, accountName');
    }

    // Validate account number format (10 digits for Nigerian banks)
    if (!/^\d{10}$/.test(accountNumber)) {
      throw new Error('Invalid account number format');
    }
  }

  if (transferType === 'wallet_transfer') {
    if (!walletId) {
      throw new Error('Missing required field for wallet transfer: walletId');
    }
  }

  // Simulate API call
  await new Promise(resolve => setTimeout(resolve, 3000));

  const reference = `TRANS_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const isSuccessful = Math.random() > 0.05; // 95% success rate

  if (isSuccessful) {
    let description;
    if (transferType === 'bank_transfer') {
      description = `Bank Transfer to ${accountName} - ${accountNumber}`;
    } else {
      description = `Wallet Transfer to ${walletId}`;
    }

    return {
      success: true,
      reference,
      description,
      successMessage: 'Transfer completed successfully',
      transactionData: {
        transferType,
        bankCode,
        accountNumber,
        accountName,
        walletId,
        serviceType: 'transfer'
      }
    };
  } else {
    return {
      success: false,
      reference,
      errorMessage: 'Transfer failed. Please check recipient details and try again.',
      transactionData: {
        transferType,
        bankCode,
        accountNumber,
        accountName,
        walletId,
        serviceType: 'transfer'
      }
    };
  }
}

// Internet purchase (ISP services)
async function processInternetPurchase({ provider, plan, customerNumber, planType, amount, userId }) {
  // Validate internet fields
  if (!provider || !plan || !customerNumber) {
    throw new Error('Missing required fields: provider, plan, customerNumber');
  }

  const validProviders = ['spectranet', 'smile', 'swift', 'ipnx', 'coollink'];
  if (!validProviders.includes(provider)) {
    throw new Error('Invalid internet provider');
  }

  const validPlanTypes = ['monthly', 'weekly', 'daily', 'yearly'];
  if (planType && !validPlanTypes.includes(planType)) {
    throw new Error('Invalid plan type');
  }

  // Simulate API call
  await new Promise(resolve => setTimeout(resolve, 2500));

  const reference = `NET_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const isSuccessful = Math.random() > 0.2; // 80% success rate

  if (isSuccessful) {
    return {
      success: true,
      reference,
      description: `Internet - ${provider.toUpperCase()} ${plan} - ${customerNumber}`,
      successMessage: 'Internet subscription successful',
      transactionData: {
        provider: provider.toUpperCase(),
        plan,
        customerNumber,
        planType,
        serviceType: 'internet'
      }
    };
  } else {
    return {
      success: false,
      reference,
      errorMessage: 'Internet service temporarily unavailable. Please try again.',
      transactionData: {
        provider: provider.toUpperCase(),
        plan,
        customerNumber,
        planType,
        serviceType: 'internet'
      }
    };
  }
}

// Fund betting purchase
async function processFundBettingPurchase({ provider, customerId, customerName, amount, userId }) {
  // Validate betting fields
  if (!provider || !customerId) {
    throw new Error('Missing required fields: provider, customerId');
  }

  const validProviders = ['bet9ja', 'sportybet', 'nairabet', 'betway', '1xbet', 'betking', 'merrybet'];
  if (!validProviders.includes(provider)) {
    throw new Error('Invalid betting provider');
  }

  // Simulate API call
  await new Promise(resolve => setTimeout(resolve, 2000));

  const reference = `BET_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const isSuccessful = Math.random() > 0.1; // 90% success rate

  if (isSuccessful) {
    return {
      success: true,
      reference,
      description: `Betting Fund - ${provider.toUpperCase()} - ${customerId}`,
      successMessage: 'Betting account funded successfully',
      transactionData: {
        provider: provider.toUpperCase(),
        customerId,
        customerName,
        serviceType: 'fund_betting'
      }
    };
  } else {
    return {
      success: false,
      reference,
      errorMessage: 'Betting service temporarily unavailable. Please try again.',
      transactionData: {
        provider: provider.toUpperCase(),
        customerId,
        customerName,
        serviceType: 'fund_betting'
      }
    };
  }
}





// POST /api/purchase/generate - Generate recharge PINs (Updated to save transactions)
router.post('/generate', authenticate, async (req, res) => {
  try {
    const { network, type, denomination, quantity, pin } = req.body;

    console.log('Recharge PIN generation request:', { network, type, denomination, quantity });

    // Basic validation
    if (!network || !type || !denomination || !quantity || !pin) {
      console.log('❌ Validation failed: Missing required fields');
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: network, type, denomination, quantity, pin'
      });
    }

    if (!/^\d{4}$/.test(pin)) {
      console.log('❌ Validation failed: Invalid PIN format');
      return res.status(400).json({
        success: false,
        message: 'PIN must be exactly 4 digits'
      });
    }

    // Validate quantity
    const qty = parseInt(quantity);
    if (isNaN(qty) || qty < 1 || qty > 100) {
      console.log('❌ Validation failed: Invalid quantity');
      return res.status(400).json({
        success: false,
        message: 'Quantity must be between 1 and 100'
      });
    }

    // Validate denomination
    const validDenominations = [100, 200, 500, 1000, 1500, 2000];
    if (!validDenominations.includes(denomination)) {
      console.log('❌ Validation failed: Invalid denomination');
      return res.status(400).json({
        success: false,
        message: 'Invalid denomination'
      });
    }

    // Validate network
    const validNetworks = ['mtn', 'airtel', 'glo', '9mobile'];
    if (!validNetworks.includes(network)) {
      console.log('❌ Validation failed: Invalid network');
      return res.status(400).json({
        success: false,
        message: 'Invalid network'
      });
    }

    console.log('✅ All validations passed');

    // Calculate total amount
    const totalAmount = denomination * qty;
    console.log('💰 Total amount calculated:', totalAmount);

    // Get user and check PIN
    console.log('🔍 Fetching user and wallet data...');
    const user = await User.findById(req.user.userId).select('+pin');
    const wallet = await Wallet.findOne({ userId: req.user.userId });

    if (!user || !wallet) {
      console.log('❌ User or wallet not found');
      return res.status(404).json({
        success: false,
        message: 'User or wallet not found'
      });
    }

    if (!user.pin || !user.isPinSetup) {
      console.log('❌ PIN not set up');
      return res.status(400).json({
        success: false,
        message: 'Transaction PIN not set. Please set up your PIN first.'
      });
    }

    // Check account lock status
    console.log('🔒 Checking account lock status...');
    const attemptData = getPinAttemptData(req.user.userId);
    const now = new Date();

    if (attemptData.lockedUntil && now < attemptData.lockedUntil) {
      const remainingMinutes = Math.ceil((attemptData.lockedUntil - now) / (1000 * 60));
      console.log('❌ Account is locked for', remainingMinutes, 'minutes');
      return res.status(423).json({
        success: false,
        message: `Account locked. Try again in ${remainingMinutes} minutes.`
      });
    }

    console.log('✅ Account is not locked');

    // Validate PIN
    console.log('🔑 Validating PIN...');
    let isPinValid;
    try {
      isPinValid = await user.comparePin(pin);
      console.log('PIN validation result:', isPinValid);
    } catch (error) {
      console.log('❌ PIN validation error:', error.message);
      return res.status(400).json({
        success: false,
        message: 'PIN not set. Please set up your transaction PIN first.'
      });
    }

    if (!isPinValid) {
      console.log('❌ Invalid PIN provided');
      attemptData.attempts += 1;
      attemptData.lastAttempt = now;

      if (attemptData.attempts >= PIN_CONFIG.MAX_ATTEMPTS) {
        attemptData.lockedUntil = new Date(now.getTime() + PIN_CONFIG.LOCK_DURATION);
        return res.status(423).json({
          success: false,
          message: 'Invalid PIN. Account locked due to too many failed attempts.'
        });
      }

      return res.status(400).json({
        success: false,
        message: `Invalid PIN. ${PIN_CONFIG.MAX_ATTEMPTS - attemptData.attempts} attempts remaining.`
      });
    }

    console.log('✅ PIN validated successfully');

    // Check balance
    console.log('💳 Current wallet balance:', wallet.balance);
    console.log('💳 Required amount:', totalAmount);
    
    if (wallet.balance < totalAmount) {
      console.log('❌ Insufficient balance');
      return res.status(400).json({
        success: false,
        message: `Insufficient balance. Available: ₦${wallet.balance.toLocaleString()}, Required: ₦${totalAmount.toLocaleString()}`
      });
    }

    console.log('✅ Sufficient balance available');

    // Reset PIN attempts on success
    resetPinAttempts(req.user.userId);
    console.log('✅ PIN attempts reset');

    // Generate recharge PINs
    console.log('🎯 Generating recharge PINs...');
    const pins = [];
    for (let i = 0; i < qty; i++) {
   const generatedPin = {
  pin: Math.random().toString().substr(2, 15), // Just the number, no prefix
  serial: Math.random().toString().substr(2, 12) // Keep serial as is
};
      pins.push(generatedPin);
      console.log(`Generated PIN ${i + 1}:`, { pin: generatedPin.pin, serial: generatedPin.serial });
    }

    // Create unique transaction reference
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 12).toUpperCase();
    const reference = `RECHARGE_${timestamp}_${random}`;
    console.log('📋 Transaction reference:', reference);

    // Store previous balance
    const previousBalance = wallet.balance;

    // Create the PIN description with actual PINs included
    const pinList = pins.map(p => `PIN: ${p.pin} (Serial: ${p.serial})`).join(' | ');
    const description = `${network.toUpperCase()} ${type.toUpperCase()} Recharge - ${qty} card(s) x ₦${denomination} = ₦${totalAmount} | ${pinList}`;
    // Debit wallet with the PIN-inclusive description
    console.log('💸 Debiting wallet...');
    let transactionResult;
    try {
      transactionResult = await wallet.debit(
        totalAmount,
        description,
        reference
      );
      console.log('✅ Wallet debited successfully');
      console.log('New balance:', transactionResult.wallet.balance);
    } catch (debitError) {
      console.log('❌ Wallet debit failed:', debitError.message);
      return res.status(500).json({
        success: false,
        message: 'Failed to process payment. Please try again.'
      });
    }

    console.log('✅ Transaction completed successfully');

    // The wallet.debit() method should have already created a transaction
    // So we don't need to create another one to avoid duplicates

    // Prepare response
    const response = {
      success: true,
      message: 'Recharge PINs generated successfully',
      transaction: {
        _id: reference,
        network: network.toUpperCase(),
        type: type.toUpperCase(),
        amount: totalAmount,
        quantity: qty,
        denomination,
        pins,
        status: 'completed',
        createdAt: new Date(),
        balanceAfter: transactionResult.wallet.balance
      },
      newBalance: {
        amount: transactionResult.wallet.balance,
        currency: 'NGN',
        lastUpdated: new Date().toISOString()
      }
    };

    console.log('📤 Sending response');
    res.json(response);

  } catch (error) {
    console.error('❌ Recharge PIN generation error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Server error generating recharge PINs',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});



// GET /api/purchase/history - Get recharge transaction history (FIXED)
router.get('/history', authenticate, async (req, res) => {
  try {
    console.log('Fetching recharge history for user:', req.user.userId);

    // Query transactions
    const rechargeTransactions = await Transaction.find({
      userId: req.user.userId,
      $or: [
        { description: { $regex: /recharge/i } },
        { reference: { $regex: /^(RC_|RECHARGE_)/i } }
      ]
    })
    .populate('walletId', 'balance')
    .sort({ createdAt: -1 })
    .limit(50);

    console.log(`Found ${rechargeTransactions.length} recharge transactions`);

    // Transform the data and extract PINs from description
    const formattedTransactions = rechargeTransactions.map((tx, index) => {
      let pins = [];
      let network = 'UNKNOWN';
      let serviceType = 'unknown';
      let quantity = 1;
      let denomination = tx.amount;

      console.log(`\n--- Processing Transaction ${index + 1} ---`);
      console.log('Description:', tx.description);

      // Extract data from new format descriptions (RECHARGE_ prefix transactions)
      if (tx.description && tx.description.includes('PIN:')) {
        console.log('Found PIN in description, extracting...');
        
        // Extract PINs and serials from description - FIXED regex
const pinMatches = tx.description.match(/PIN: (\d+) \(Serial: (\d+)\)/g);
        console.log('PIN matches found:', pinMatches);
        if (pinMatches) {
  pins = pinMatches.map(match => {
    // Use non-global regex for individual matching
    const pinMatch = match.match(/^PIN: (\d+) \(Serial: (\d+)\)$/);
    if (pinMatch) {
      return {
        pin: pinMatch[1],
        serial: pinMatch[2]
      };
    }
    return null;
  }).filter(Boolean); // Remove any null entries
}
        // Extract network and service type
        const networkMatch = tx.description.match(/^(\w+) (\w+) Recharge/);
        if (networkMatch) {
          network = networkMatch[1];
          serviceType = networkMatch[2];
          console.log('Extracted network and service:', network, serviceType);
        }

        // Extract quantity and denomination
        const qtyMatch = tx.description.match(/(\d+) card\(s\) x ₦(\d+)/);
        if (qtyMatch) {
          quantity = parseInt(qtyMatch[1]);
          denomination = parseInt(qtyMatch[2]);
          console.log('Extracted quantity and denomination:', quantity, denomination);
        }
      } else {
        console.log('No PIN found in description, using fallback');
        // Fallback for old format transactions
        network = extractNetworkFromDescription(tx.description);
        serviceType = extractTypeFromDescription(tx.description);
        pins = [{ 
          pin: 'Not Available', 
          serial: tx.reference || 'Not Available' 
        }];
        console.log('❌ Using fallback for old format');
      }

      const formatted = {
        _id: tx._id,
        network: network,
        type: serviceType.toLowerCase(),
        amount: tx.amount,
        quantity: quantity,
        denomination: denomination,
        pins: pins,
        status: tx.status,
        createdAt: tx.createdAt,
        balanceAfter: tx.newBalance,
        reference: tx.reference
      };

      console.log(`Final formatted transaction:`, {
        reference: tx.reference,
        network: formatted.network,
        type: formatted.type,
        pins: formatted.pins
      });
      return formatted;
    });

    res.json({
      success: true,
      data: {
        transactions: formattedTransactions
      }
    });

  } catch (error) {
    console.error('History fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching transaction history'
    });
  }
});

// Helper function to extract network from description (for legacy transactions)
function extractNetworkFromDescription(description) {
  if (!description) return 'UNKNOWN';
  const desc = description.toUpperCase();
  if (desc.includes('MTN')) return 'MTN';
  if (desc.includes('AIRTEL')) return 'AIRTEL';
  if (desc.includes('GLO')) return 'GLO';
  if (desc.includes('9MOBILE')) return '9MOBILE';
  return 'UNKNOWN';
}

// Helper function to extract type from description (for legacy transactions)
function extractTypeFromDescription(description) {
  if (!description) return 'unknown';
  const desc = description.toLowerCase();
  if (desc.includes('airtime')) return 'airtime';
  if (desc.includes('data')) return 'data';
  return 'unknown';
}



module.exports = router;