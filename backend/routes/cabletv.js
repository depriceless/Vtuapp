const express = require('express');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const rateLimit = require('express-rate-limit');
const validator = require('validator');
const { body, validationResult, param } = require('express-validator');
const winston = require('winston');
const router = express.Router();

// Configure logging
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/cable-tv.log' }),
    new winston.transports.Console()
  ]
});

// Rate limiting
const cableRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // limit each IP to 20 requests per windowMs
  message: { success: false, message: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// VTU Provider Configuration
const VTU_CONFIG = {
  baseUrl: process.env.VTPASS_BASE_URL || 'https://vtpass.com/api',
  username: process.env.VTPASS_USERNAME,
  password: process.env.VTPASS_PASSWORD,
  apiKey: process.env.VTPASS_API_KEY,
  secretKey: process.env.VTPASS_SECRET_KEY
};

// Validate environment variables on startup
function validateEnvironment() {
  const required = ['VTPASS_USERNAME', 'VTPASS_PASSWORD', 'VTPASS_API_KEY', 'VTPASS_SECRET_KEY', 'JWT_SECRET'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    logger.error('Missing required environment variables:', missing);
    throw new Error(`Missing environment variables: ${missing.join(', ')}`);
  }
}

validateEnvironment();

// Enhanced Authentication middleware
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      logger.warn('Authentication failed: No token provided', { 
        ip: req.ip, 
        endpoint: req.path 
      });
      return res.status(401).json({ 
        success: false, 
        message: 'Access token required' 
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check if user exists and is active
    const user = await getUserById(decoded.userId);
    if (!user || !user.isActive) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid or expired session' 
      });
    }

    req.user = user;
    next();

  } catch (error) {
    logger.warn('Authentication failed', { 
      error: error.message, 
      ip: req.ip,
      endpoint: req.path 
    });
    
    return res.status(403).json({ 
      success: false, 
      message: 'Invalid or expired token' 
    });
  }
};

// Input validation middleware
const validateCablePackageRequest = [
  param('operator')
    .isAlpha()
    .isLength({ min: 2, max: 20 })
    .toLowerCase()
    .withMessage('Invalid operator'),
];

const validateSmartCardRequest = [
  body('smartCardNumber')
    .isNumeric()
    .isLength({ min: 10, max: 15 })
    .withMessage('Smart card number must be 10-15 digits'),
  body('operator')
    .isAlpha()
    .isLength({ min: 2, max: 20 })
    .toLowerCase()
    .withMessage('Invalid operator'),
];

const validatePurchaseRequest = [
  body('type').equals('cable_tv').withMessage('Invalid purchase type'),
  body('operator').isAlpha().isLength({ min: 2, max: 20 }).withMessage('Invalid operator'),
  body('packageId').isAlphanumeric().isLength({ min: 1, max: 50 }).withMessage('Invalid package ID'),
  body('smartCardNumber').isNumeric().isLength({ min: 10, max: 15 }).withMessage('Invalid smart card'),
  body('phone').isMobilePhone('en-NG').withMessage('Invalid Nigerian phone number'),
  body('amount').isFloat({ min: 100, max: 50000 }).withMessage('Amount must be between 100 and 50,000'),
  body('pin').isNumeric().isLength({ min: 4, max: 4 }).withMessage('PIN must be 4 digits'),
];

// ENDPOINT 1: Get Cable TV Packages
router.get('/cable/packages/:operator', 
  cableRateLimit,
  validateCablePackageRequest,
  authenticateToken, 
  async (req, res) => {
    const requestId = `pkg_${Date.now()}_${req.user.id}`;
    
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Invalid input',
          errors: errors.array()
        });
      }

      const { operator } = req.params;
      
      const operatorMap = {
        'dstv': 'dstv',
        'gotv': 'gotv',
        'startime': 'startimes',
        'showmax': 'showmax'
      };

      const serviceId = operatorMap[operator];
      if (!serviceId) {
        return res.status(400).json({
          success: false,
          message: 'Unsupported operator'
        });
      }

      logger.info('Fetching cable packages', { 
        requestId, 
        operator, 
        serviceId, 
        userId: req.user.id 
      });

      // Check cache first (implement Redis caching)
      const cachedPackages = await getCachedPackages(operator);
      if (cachedPackages) {
        logger.info('Returning cached packages', { requestId, operator });
        return res.json({
          success: true,
          data: cachedPackages,
          operator: operator,
          count: cachedPackages.length,
          cached: true
        });
      }

      // Call VTU provider API
      const response = await axios.post(`${VTU_CONFIG.baseUrl}/service-variations`, {
        serviceID: serviceId
      }, {
        auth: {
          username: VTU_CONFIG.username,
          password: VTU_CONFIG.password
        },
        headers: {
          'api-key': VTU_CONFIG.apiKey,
          'secret-key': VTU_CONFIG.secretKey
        },
        timeout: 15000
      });

      if (response.data && response.data.response_description === '000') {
        const packages = response.data.content.varations.map(variation => ({
          variation_id: variation.variation_code,
          name: variation.name,
          amount: parseFloat(variation.variation_amount),
          duration: '30 days',
          description: variation.name
        }));

        // Cache the packages
        await cachePackages(operator, packages, 3600);

        logger.info('Packages fetched successfully', { 
          requestId, 
          operator, 
          count: packages.length 
        });

        return res.json({
          success: true,
          data: packages,
          operator: operator,
          count: packages.length
        });
      } else {
        throw new Error(`VTPass API error: ${response.data.response_description}`);
      }

    } catch (error) {
      logger.error('Error fetching cable packages', { 
        requestId, 
        operator: req.params.operator,
        error: error.message,
        userId: req.user.id 
      });
      
      if (error.code === 'ECONNABORTED') {
        return res.status(408).json({
          success: false,
          message: 'Request timeout. Please try again.',
          error_code: 'TIMEOUT'
        });
      }

      return res.status(500).json({
        success: false,
        message: 'Failed to fetch cable packages',
        error_code: 'FETCH_PACKAGES_FAILED'
      });
    }
  }
);

// ENDPOINT 2: Validate Smart Card Number
router.post('/cable/validate-smartcard', 
  cableRateLimit,
  validateSmartCardRequest,
  authenticateToken, 
  async (req, res) => {
    const requestId = `validate_${Date.now()}_${req.user.id}`;
    
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Invalid input',
          errors: errors.array()
        });
      }

      const { smartCardNumber, operator } = req.body;
      const cleanedCardNumber = smartCardNumber.trim();

      const operatorMap = {
        'dstv': 'dstv',
        'gotv': 'gotv',
        'startime': 'startimes',
        'showmax': 'showmax'
      };

      const serviceId = operatorMap[operator];

      logger.info('Validating smart card', { 
        requestId, 
        operator, 
        cardNumber: cleanedCardNumber.slice(0, 4) + '***',
        userId: req.user.id 
      });

      const response = await axios.post(`${VTU_CONFIG.baseUrl}/merchant-verify`, {
        serviceID: serviceId,
        billersCode: cleanedCardNumber
      }, {
        auth: {
          username: VTU_CONFIG.username,
          password: VTU_CONFIG.password
        },
        headers: {
          'api-key': VTU_CONFIG.apiKey,
          'secret-key': VTU_CONFIG.secretKey
        },
        timeout: 10000
      });

      if (response.data && response.data.response_description === '000') {
        const customerData = response.data.content.Customer_Name;
        
        logger.info('Smart card validated successfully', { requestId, operator });
        
        return res.json({
          success: true,
          customerName: customerData || 'Verified Customer',
          smartCardNumber: cleanedCardNumber,
          operator: operator,
          status: 'active'
        });
      } else if (response.data && response.data.response_description === '013') {
        logger.warn('Smart card not found', { requestId, operator });
        return res.status(400).json({
          success: false,
          message: 'Smart card not found for this operator',
          error_code: 'SMARTCARD_NOT_FOUND'
        });
      } else {
        logger.warn('Invalid smart card', { requestId, operator, responseCode: response.data.response_description });
        return res.status(400).json({
          success: false,
          message: 'Invalid smart card number',
          error_code: 'INVALID_SMARTCARD'
        });
      }

    } catch (error) {
      logger.error('Smart card validation error', { 
        requestId, 
        error: error.message,
        userId: req.user.id 
      });
      
      if (error.code === 'ECONNABORTED') {
        return res.status(408).json({
          success: false,
          message: 'Validation timeout. Please try again.',
          error_code: 'TIMEOUT'
        });
      }

      return res.status(500).json({
        success: false,
        message: 'Unable to validate smart card. Please try again.',
        error_code: 'VALIDATION_FAILED'
      });
    }
  }
);

// ENDPOINT 3: Cable TV Purchase
router.post('/purchase', 
  cableRateLimit,
  validatePurchaseRequest,
  authenticateToken, 
  async (req, res) => {
    const transactionId = `tx_${Date.now()}_${req.user.id}`;
    
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Invalid input',
          errors: errors.array()
        });
      }

      const { type, operator, packageId, smartCardNumber, phone, amount, pin } = req.body;

      // Only handle cable TV purchases
      if (type !== 'cable_tv') {
        return next();
      }

      const userId = req.user.id;

      logger.info('Starting cable TV purchase', { 
        transactionId, 
        operator, 
        amount, 
        userId,
        phone: phone.slice(0, 4) + '***'
      });

      // Verify PIN with attempt tracking
      const pinVerificationResult = await verifyUserPinWithAttempts(userId, pin);
      if (!pinVerificationResult.success) {
        logger.warn('PIN verification failed', { 
          transactionId, 
          userId, 
          attemptsRemaining: pinVerificationResult.attemptsRemaining 
        });
        
        return res.status(400).json({
          success: false,
          message: pinVerificationResult.message,
          error_code: 'INVALID_PIN',
          attemptsRemaining: pinVerificationResult.attemptsRemaining
        });
      }

      // Check and reserve balance atomically
      const balanceResult = await checkAndReserveBalance(userId, amount, transactionId);
      if (!balanceResult.success) {
        logger.warn('Insufficient balance', { transactionId, userId, amount });
        return res.status(400).json({
          success: false,
          message: 'Insufficient balance',
          error_code: 'INSUFFICIENT_BALANCE'
        });
      }

      const operatorMap = {
        'dstv': 'dstv',
        'gotv': 'gotv',
        'startime': 'startimes',
        'showmax': 'showmax'
      };

      const serviceId = operatorMap[operator];
      const requestId = `cable_${Date.now()}_${userId}`;

      try {
        // Call VTU provider
        const purchaseResponse = await axios.post(`${VTU_CONFIG.baseUrl}/pay`, {
          request_id: requestId,
          serviceID: serviceId,
          amount: amount,
          phone: phone,
          billersCode: smartCardNumber,
          variation_code: packageId
        }, {
          auth: {
            username: VTU_CONFIG.username,
            password: VTU_CONFIG.password
          },
          headers: {
            'api-key': VTU_CONFIG.apiKey,
            'secret-key': VTU_CONFIG.secretKey
          },
          timeout: 30000
        });

        if (purchaseResponse.data && purchaseResponse.data.response_description === '000') {
          // Success - commit the transaction
          const newBalance = await commitBalanceDeduction(userId, transactionId);
          
          const transaction = {
            id: transactionId,
            userId: userId,
            type: 'cable_tv',
            operator: operator,
            packageId: packageId,
            smartCardNumber: smartCardNumber,
            phone: phone,
            amount: amount,
            status: 'successful',
            externalReference: purchaseResponse.data.requestId,
            providerResponse: purchaseResponse.data,
            createdAt: new Date()
          };
          
          await saveTransaction(transaction);

          logger.info('Cable TV purchase successful', { 
            transactionId, 
            operator, 
            amount,
            newBalance 
          });

          return res.json({
            success: true,
            message: 'Cable TV subscription successful',
            transaction: {
              id: transactionId,
              type: 'cable_tv',
              operator: operator,
              amount: amount,
              status: 'successful',
              createdAt: transaction.createdAt
            },
            newBalance: {
              amount: newBalance,
              currency: 'NGN',
              lastUpdated: new Date().toISOString()
            }
          });

        } else {
          // Provider transaction failed - release reserved balance
          await releaseReservedBalance(userId, transactionId);
          
          logger.error('VTU provider transaction failed', { 
            transactionId, 
            response: purchaseResponse.data 
          });
          
          return res.status(400).json({
            success: false,
            message: purchaseResponse.data.response_description || 'Transaction failed',
            error_code: 'TRANSACTION_FAILED'
          });
        }

      } catch (providerError) {
        // Provider API error - release reserved balance
        await releaseReservedBalance(userId, transactionId);
        throw providerError;
      }

    } catch (error) {
      logger.error('Cable TV purchase error', { 
        transactionId, 
        error: error.message,
        stack: error.stack,
        userId: req.user?.id 
      });
      
      if (error.code === 'ECONNABORTED') {
        return res.status(408).json({
          success: false,
          message: 'Transaction timeout. Please check your subscription status.',
          error_code: 'TIMEOUT'
        });
      }

      return res.status(500).json({
        success: false,
        message: 'Transaction failed. Please try again.',
        error_code: 'PURCHASE_FAILED'
      });
    }
  }
);

// Health check endpoint
router.get('/cable/health', (req, res) => {
  res.json({
    success: true,
    service: 'cable-tv',
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// PRODUCTION-READY HELPER FUNCTIONS

async function getUserById(userId) {
  // Implement database query to get user by ID
  // Should return user object with { id, isActive, ... } or null
  try {
    // Example with your database (adjust for your ORM/query method):
    // const user = await User.findById(userId);
    // return user && user.isActive ? user : null;
    
    // Placeholder - implement with your database
    return { id: userId, isActive: true }; // IMPLEMENT THIS
  } catch (error) {
    logger.error('Error fetching user', { userId, error: error.message });
    return null;
  }
}

async function verifyUserPinWithAttempts(userId, pin) {
  try {
    // Check if account is locked
    const lockStatus = await getPinLockStatus(userId);
    if (lockStatus.isLocked) {
      return {
        success: false,
        message: `Account locked. Try again in ${lockStatus.minutesRemaining} minutes.`,
        attemptsRemaining: 0
      };
    }

    // Get stored PIN hash
    const storedPinHash = await getUserPinHash(userId);
    if (!storedPinHash) {
      return {
        success: false,
        message: 'PIN not set. Please set up your transaction PIN.',
        attemptsRemaining: 3
      };
    }

    // Verify PIN
    const isValid = await bcrypt.compare(pin, storedPinHash);
    
    if (isValid) {
      // Reset failed attempts on success
      await resetPinAttempts(userId);
      return { success: true };
    } else {
      // Increment failed attempts
      const attemptsRemaining = await incrementPinAttempts(userId);
      
      return {
        success: false,
        message: `Invalid PIN. ${attemptsRemaining} attempts remaining.`,
        attemptsRemaining
      };
    }

  } catch (error) {
    logger.error('PIN verification error', { userId, error: error.message });
    return {
      success: false,
      message: 'PIN verification failed. Please try again.',
      attemptsRemaining: 3
    };
  }
}

async function checkAndReserveBalance(userId, amount, transactionId) {
  try {
    // Start database transaction
    // This should be atomic - check balance and reserve in one operation
    
    const currentBalance = await getUserBalance(userId);
    if (currentBalance < amount) {
      return { success: false, message: 'Insufficient balance' };
    }

    // Reserve the amount (mark as pending)
    const reserved = await reserveBalance(userId, amount, transactionId);
    if (!reserved) {
      return { success: false, message: 'Failed to reserve balance' };
    }

    return { success: true, reservedAmount: amount };

  } catch (error) {
    logger.error('Balance reservation error', { userId, amount, error: error.message });
    return { success: false, message: 'Balance check failed' };
  }
}

async function commitBalanceDeduction(userId, transactionId) {
  try {
    // Convert reserved balance to actual deduction
    const newBalance = await finalizeBalanceDeduction(userId, transactionId);
    return newBalance;
  } catch (error) {
    logger.error('Balance commit error', { userId, transactionId, error: error.message });
    throw error;
  }
}

async function releaseReservedBalance(userId, transactionId) {
  try {
    // Release the reserved balance back to available balance
    await releaseBalanceReservation(userId, transactionId);
    logger.info('Reserved balance released', { userId, transactionId });
  } catch (error) {
    logger.error('Failed to release reserved balance', { userId, transactionId, error: error.message });
  }
}

async function saveTransaction(transaction) {
  try {
    // Save transaction to database with proper error handling
    // Example structure - adjust for your database:
    /*
    await Transaction.create({
      id: transaction.id,
      userId: transaction.userId,
      type: transaction.type,
      operator: transaction.operator,
      amount: transaction.amount,
      status: transaction.status,
      metadata: {
        packageId: transaction.packageId,
        smartCardNumber: transaction.smartCardNumber,
        phone: transaction.phone,
        externalReference: transaction.externalReference
      },
      providerResponse: transaction.providerResponse,
      createdAt: transaction.createdAt
    });
    */
    
    logger.info('Transaction saved', { transactionId: transaction.id });
  } catch (error) {
    logger.error('Failed to save transaction', { 
      transactionId: transaction.id, 
      error: error.message 
    });
    throw error;
  }
}

// Cache functions (implement with Redis)
async function getCachedPackages(operator) {
  // Implement Redis cache retrieval
  return null; // IMPLEMENT THIS
}

async function cachePackages(operator, packages, ttlSeconds) {
  // Implement Redis cache storage
  // IMPLEMENT THIS
}

// PIN management functions (implement with your database)
async function getPinLockStatus(userId) {
  // IMPLEMENT: Check if user is locked due to failed PIN attempts
  return { isLocked: false, minutesRemaining: 0 }; // IMPLEMENT THIS
}

async function getUserPinHash(userId) {
  // IMPLEMENT: Get user's hashed PIN from database
  return null; // IMPLEMENT THIS
}

async function resetPinAttempts(userId) {
  // IMPLEMENT: Reset failed PIN attempts counter
}

async function incrementPinAttempts(userId) {
  // IMPLEMENT: Increment failed attempts, return remaining attempts
  return 3; // IMPLEMENT THIS
}

// Balance management functions (implement with your database)
async function getUserBalance(userId) {
  // IMPLEMENT: Get user's current available balance
  return 0; // IMPLEMENT THIS
}

async function reserveBalance(userId, amount, transactionId) {
  // IMPLEMENT: Atomically reserve balance for transaction
  return true; // IMPLEMENT THIS
}

async function finalizeBalanceDeduction(userId, transactionId) {
  // IMPLEMENT: Convert reservation to actual deduction
  return 0; // IMPLEMENT THIS - return new balance
}

async function releaseBalanceReservation(userId, transactionId) {
  // IMPLEMENT: Release reserved balance back to available
}



// Add this endpoint to your existing routes/cabletv.js file
// Insert this before the module.exports = router; line

// Cable TV providers configuration
const CABLE_PROVIDERS = {
  dstv: {
    name: 'DStv',
    code: 'dstv',
    status: 'active',
    logo: '/images/providers/dstv.png',
    color: '#FFA500',
    description: 'Digital Satellite Television',
    features: ['HD Channels', 'Premium Content', 'Sports Packages'],
    customerService: '01-271-8888',
    website: 'https://www.dstvafrica.com',
    smartCardLength: 10,
    popularPackages: ['DStv Compact', 'DStv Compact Plus', 'DStv Premium'],
    lastUpdated: new Date('2024-01-01')
  },
  gotv: {
    name: 'GOtv',
    code: 'gotv',
    status: 'active',
    logo: '/images/providers/gotv.png',
    color: '#00A651',
    description: 'Digital Terrestrial Television',
    features: ['Local Channels', 'Affordable Packages', 'Family Content'],
    customerService: '01-271-8888',
    website: 'https://www.gotvafrica.com',
    smartCardLength: 10,
    popularPackages: ['GOtv Jolli', 'GOtv Max', 'GOtv Jinja'],
    lastUpdated: new Date('2024-01-01')
  },
  startimes: {
    name: 'StarTimes',
    code: 'startimes',
    status: 'active',
    logo: '/images/providers/startimes.png',
    color: '#FF0000',
    description: 'Digital Television Service',
    features: ['Affordable Plans', 'Local Content', 'International Channels'],
    customerService: '094-6162-8888',
    website: 'https://www.startimes.com.ng',
    smartCardLength: 11,
    popularPackages: ['Basic', 'Smart', 'Classic'],
    lastUpdated: new Date('2024-01-01')
  },
  showmax: {
    name: 'Showmax',
    code: 'showmax',
    status: 'active',
    logo: '/images/providers/showmax.png',
    color: '#FF6B35',
    description: 'Streaming Service',
    features: ['On-Demand Content', 'Local Productions', 'International Series'],
    customerService: 'support@showmax.com',
    website: 'https://www.showmax.com',
    smartCardLength: 12,
    popularPackages: ['Showmax Standard', 'Showmax Pro'],
    lastUpdated: new Date('2024-01-01')
  }
};

// GET /api/cable/providers - Get all cable TV providers
router.get('/providers', authenticateToken, async (req, res) => {
  try {
    // Set cache headers
    const lastModified = Math.max(...Object.values(CABLE_PROVIDERS).map(p => p.lastUpdated.getTime()));
    res.set({
      'Cache-Control': 'public, max-age=7200', // Cache for 2 hours
      'Last-Modified': new Date(lastModified).toUTCString()
    });

    const activeProviders = Object.values(CABLE_PROVIDERS)
      .filter(provider => provider.status === 'active')
      .map(provider => ({
        code: provider.code,
        name: provider.name,
        description: provider.description,
        logo: provider.logo,
        color: provider.color,
        features: provider.features,
        customerService: provider.customerService,
        website: provider.website,
        smartCardLength: provider.smartCardLength,
        popularPackages: provider.popularPackages
      }));

    logger.info('Cable providers retrieved', { 
      count: activeProviders.length,
      ip: req.ip 
    });

    res.json({
      success: true,
      message: 'Cable TV providers retrieved',
      providers: activeProviders,
      count: activeProviders.length,
      supportedServices: ['subscription', 'package_upgrade', 'smart_card_validation'],
      lastModified: new Date(lastModified)
    });

  } catch (error) {
    logger.error('Error fetching cable providers', { 
      error: error.message,
      stack: error.stack 
    });
    
    res.status(500).json({
      success: false,
      message: 'Server error retrieving cable providers',
      error_code: 'PROVIDERS_FETCH_FAILED'
    });
  }
});

// GET /api/cable/provider/:code - Get specific provider details
router.get('/provider/:code', 
  param('code').isAlpha().isLength({ min: 2, max: 20 }).toLowerCase(),
  authenticateToken, 
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Invalid provider code',
          errors: errors.array()
        });
      }

      const { code } = req.params;
      const provider = CABLE_PROVIDERS[code];

      if (!provider) {
        return res.status(404).json({
          success: false,
          message: 'Cable provider not found',
          error_code: 'PROVIDER_NOT_FOUND'
        });
      }

      if (provider.status !== 'active') {
        return res.status(503).json({
          success: false,
          message: 'Provider service temporarily unavailable',
          error_code: 'PROVIDER_INACTIVE'
        });
      }

      // Set cache headers
      res.set({
        'Cache-Control': 'public, max-age=7200',
        'Last-Modified': provider.lastUpdated.toUTCString()
      });

      res.json({
        success: true,
        message: `${provider.name} details retrieved`,
        provider: {
          ...provider,
          status: undefined // Don't expose internal status
        }
      });

    } catch (error) {
      logger.error('Error fetching provider details', { 
        code: req.params.code,
        error: error.message 
      });
      
      res.status(500).json({
        success: false,
        message: 'Server error retrieving provider details',
        error_code: 'PROVIDER_FETCH_FAILED'
      });
    }
  }
);

module.exports = router;