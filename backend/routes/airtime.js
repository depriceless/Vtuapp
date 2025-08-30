// routes/airtime.js - Airtime Configuration & Status Routes
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');

// Airtime configuration for different networks
const AIRTIME_CONFIG = {
  mtn: {
    name: 'MTN',
    code: 'mtn',
    status: 'active',
    color: '#FFCC00',
    logo: '/images/networks/mtn.png',
    limits: {
      min: 50,
      max: 500000
    },
    denominations: [50, 100, 200, 500, 1000, 1500, 2000, 5000, 10000],
    popularDenominations: [100, 200, 500, 1000],
    processingTime: '5-15 seconds',
    successRate: 95,
    restrictions: [],
    lastUpdated: new Date('2024-01-01')
  },
  airtel: {
    name: 'Airtel',
    code: 'airtel',
    status: 'active',
    color: '#E60000',
    logo: '/images/networks/airtel.png',
    limits: {
      min: 50,
      max: 500000
    },
    denominations: [50, 100, 200, 500, 1000, 1500, 2000, 5000, 10000],
    popularDenominations: [100, 200, 500, 1000],
    processingTime: '5-20 seconds',
    successRate: 92,
    restrictions: [],
    lastUpdated: new Date('2024-01-01')
  },
  glo: {
    name: 'Glo',
    code: 'glo',
    status: 'active',
    color: '#52C41A',
    logo: '/images/networks/glo.png',
    limits: {
      min: 50,
      max: 500000
    },
    denominations: [50, 100, 200, 500, 1000, 1500, 2000, 5000, 10000],
    popularDenominations: [100, 200, 500, 1000],
    processingTime: '10-30 seconds',
    successRate: 88,
    restrictions: ['May have delays during peak hours'],
    lastUpdated: new Date('2024-01-01')
  },
  '9mobile': {
    name: '9mobile',
    code: '9mobile',
    status: 'active',
    color: '#00A651',
    logo: '/images/networks/9mobile.png',
    limits: {
      min: 50,
      max: 500000
    },
    denominations: [50, 100, 200, 500, 1000, 1500, 2000, 5000, 10000],
    popularDenominations: [100, 200, 500, 1000],
    processingTime: '5-25 seconds',
    successRate: 90,
    restrictions: [],
    lastUpdated: new Date('2024-01-01')
  }
};

// Set caching headers helper
const setCacheHeaders = (res, maxAge = 3600) => {
  const lastModified = Math.max(...Object.values(AIRTIME_CONFIG).map(n => n.lastUpdated.getTime()));
  res.set({
    'Cache-Control': `public, max-age=${maxAge}`,
    'Last-Modified': new Date(lastModified).toUTCString()
  });
};

// GET /api/airtime/networks - Get all airtime networks with status
router.get('/networks', authenticate, async (req, res) => {
  try {
    setCacheHeaders(res, 7200); // Cache for 2 hours

    const networks = Object.values(AIRTIME_CONFIG)
      .filter(network => network.status === 'active')
      .map(network => ({
        code: network.code,
        name: network.name,
        status: network.status,
        color: network.color,
        logo: network.logo,
        successRate: network.successRate,
        processingTime: network.processingTime,
        restrictions: network.restrictions
      }));

    res.json({
      success: true,
      message: 'Airtime networks retrieved',
      networks,
      count: networks.length,
      lastModified: new Date(Math.max(...Object.values(AIRTIME_CONFIG).map(n => n.lastUpdated.getTime())))
    });

  } catch (error) {
    console.error('Airtime networks error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error retrieving airtime networks'
    });
  }
});

// GET /api/airtime/networks/status - Get network status for airtime
router.get('/networks/status', authenticate, async (req, res) => {
  try {
    setCacheHeaders(res, 300); // Cache for 5 minutes (status changes frequently)

    // Simulate real-time network status checking
    const networkStatus = {};
    
    for (const [code, config] of Object.entries(AIRTIME_CONFIG)) {
      // Simulate network health check
      const isOnline = Math.random() > 0.05; // 95% uptime simulation
      const responseTime = Math.floor(Math.random() * 20) + 5; // 5-25 seconds
      
      networkStatus[code] = {
        name: config.name,
        code: config.code,
        status: isOnline ? 'online' : 'offline',
        responseTime: `${responseTime} seconds`,
        successRate: config.successRate,
        lastChecked: new Date(),
        issues: isOnline ? [] : ['Temporary service disruption']
      };
    }

    res.json({
      success: true,
      message: 'Network status retrieved',
      networks: networkStatus,
      summary: {
        total: Object.keys(networkStatus).length,
        online: Object.values(networkStatus).filter(n => n.status === 'online').length,
        offline: Object.values(networkStatus).filter(n => n.status === 'offline').length
      },
      lastChecked: new Date()
    });

  } catch (error) {
    console.error('Network status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error checking network status'
    });
  }
});

// GET /api/airtime/denominations/:network - Get available denominations for network
router.get('/denominations/:network', authenticate, async (req, res) => {
  try {
    const { network } = req.params;

    // Validate network
    if (!AIRTIME_CONFIG[network]) {
      return res.status(400).json({
        success: false,
        message: 'Invalid network. Valid networks are: mtn, airtel, glo, 9mobile'
      });
    }

    setCacheHeaders(res, 7200); // Cache for 2 hours

    const networkConfig = AIRTIME_CONFIG[network];

    res.json({
      success: true,
      message: `Airtime denominations retrieved for ${networkConfig.name}`,
      network: {
        code: network,
        name: networkConfig.name,
        color: networkConfig.color,
        logo: networkConfig.logo
      },
      limits: networkConfig.limits,
      denominations: networkConfig.denominations,
      popularDenominations: networkConfig.popularDenominations,
      restrictions: networkConfig.restrictions,
      processingTime: networkConfig.processingTime,
      successRate: networkConfig.successRate,
      lastUpdated: networkConfig.lastUpdated
    });

  } catch (error) {
    console.error('Denominations error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error retrieving denominations'
    });
  }
});

// GET /api/airtime/denominations - Get denominations for all networks
router.get('/denominations', authenticate, async (req, res) => {
  try {
    setCacheHeaders(res, 7200); // Cache for 2 hours

    const allDenominations = {};
    let globalLimits = {
      min: Infinity,
      max: 0
    };

    Object.entries(AIRTIME_CONFIG).forEach(([code, config]) => {
      allDenominations[code] = {
        name: config.name,
        limits: config.limits,
        denominations: config.denominations,
        popularDenominations: config.popularDenominations,
        restrictions: config.restrictions
      };

      // Calculate global limits
      globalLimits.min = Math.min(globalLimits.min, config.limits.min);
      globalLimits.max = Math.max(globalLimits.max, config.limits.max);
    });

    res.json({
      success: true,
      message: 'All airtime denominations retrieved',
      networks: allDenominations,
      globalLimits,
      commonDenominations: [100, 200, 500, 1000, 2000, 5000], // Most common across networks
      lastModified: new Date(Math.max(...Object.values(AIRTIME_CONFIG).map(n => n.lastUpdated.getTime())))
    });

  } catch (error) {
    console.error('All denominations error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error retrieving all denominations'
    });
  }
});

// GET /api/airtime/history - Get airtime-specific purchase history
router.get('/history', authenticate, async (req, res) => {
  try {
    const { network, limit = 20, page = 1 } = req.query;
    
    const Transaction = require('../models/Transaction');

    // Build query for airtime transactions only
    const query = {
      userId: req.user.userId,
      $or: [
        { description: { $regex: /airtime purchase/i } },
        { reference: { $regex: /^AIR_/i } }
      ]
    };

    // Add network filter if specified
    if (network) {
      query.description = { $regex: new RegExp(`airtime purchase.*${network}`, 'i') };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const transactions = await Transaction.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip);

    const totalTransactions = await Transaction.countDocuments(query);

    // Extract network and phone from each transaction
    const formattedTransactions = transactions.map(tx => {
      // Extract network from description
      const networkMatch = tx.description.match(/Airtime purchase - (\w+) - (0\d{10})/);
      
      return {
        _id: tx._id,
        reference: tx.reference,
        network: networkMatch ? networkMatch[1] : 'UNKNOWN',
        phone: networkMatch ? networkMatch[2] : 'Unknown',
        amount: tx.amount,
        status: tx.status,
        createdAt: tx.createdAt,
        balanceAfter: tx.newBalance
      };
    });

    res.json({
      success: true,
      message: 'Airtime purchase history retrieved',
      transactions: formattedTransactions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalTransactions,
        pages: Math.ceil(totalTransactions / parseInt(limit))
      },
      statistics: {
        totalSpent: formattedTransactions.reduce((sum, tx) => sum + tx.amount, 0),
        successfulTransactions: formattedTransactions.filter(tx => tx.status === 'completed').length,
        failedTransactions: formattedTransactions.filter(tx => tx.status === 'failed').length
      }
    });

  } catch (error) {
    console.error('Airtime history error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error retrieving airtime history'
    });
  }
});

// POST /api/airtime/validate-phone - Enhanced phone validation (optional upgrade)
router.post('/validate-phone', authenticate, async (req, res) => {
  try {
    const { phone, network } = req.body;

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: 'Phone number is required'
      });
    }

    // Basic format validation
    if (!/^0[789][01]\d{8}$/.test(phone)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid phone number format. Must be 11 digits starting with 070, 080, 081, 090, or 091'
      });
    }

    // If network is provided, validate it matches the phone number
    let detectedNetwork = null;
    const firstFourDigits = phone.substring(0, 4);
    
    // Network detection logic (basic implementation)
    const networkPrefixes = {
      mtn: ['0803', '0806', '0703', '0706', '0813', '0816', '0810', '0814', '0903', '0906'],
      airtel: ['0802', '0808', '0708', '0812', '0701', '0902', '0907', '0901'],
      glo: ['0805', '0807', '0705', '0815', '0811', '0905'],
      '9mobile': ['0809', '0818', '0817', '0909', '0908']
    };

    for (const [net, prefixes] of Object.entries(networkPrefixes)) {
      if (prefixes.includes(firstFourDigits)) {
        detectedNetwork = net;
        break;
      }
    }

    // Check if provided network matches detected network
    let networkMismatch = false;
    if (network && detectedNetwork && network !== detectedNetwork) {
      networkMismatch = true;
    }

    const networkConfig = detectedNetwork ? AIRTIME_CONFIG[detectedNetwork] : null;

    res.json({
      success: true,
      message: 'Phone number validation completed',
      phone,
      detectedNetwork,
      networkInfo: networkConfig ? {
        name: networkConfig.name,
        code: networkConfig.code,
        color: networkConfig.color,
        limits: networkConfig.limits
      } : null,
      validation: {
        isValid: true,
        networkMismatch,
        warnings: networkMismatch ? ['Provided network does not match detected network'] : []
      }
    });

  } catch (error) {
    console.error('Phone validation error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error validating phone number'
    });
  }
});

module.exports = router;