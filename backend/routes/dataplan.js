// routes/data.js - Enhanced Data Plans Route
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');

// Import from shared configuration
const {
  DATA_PLANS,
  NETWORK_INFO,
  getActiveNetworks,
  getActivePlansForNetwork,
  getPopularPlansForNetwork,
  getPlansByCategory,
  searchPlans,
  getLastModified
} = require('../config/dataPlans');

// Set caching headers helper
const setCacheHeaders = (res, maxAge = 3600) => {
  res.set({
    'Cache-Control': `public, max-age=${maxAge}`,
    'Last-Modified': getLastModified().toUTCString()
  });
};

// GET /api/data/networks - Get all available networks
router.get('/networks', authenticate, async (req, res) => {
  try {
    setCacheHeaders(res, 7200); // Cache for 2 hours
    
    const networks = getActiveNetworks();
    const networksWithStats = networks.map(network => {
      const plans = getActivePlansForNetwork(network.code);
      const popularPlans = getPopularPlansForNetwork(network.code);
      
      return {
        ...network,
        totalPlans: plans.length,
        popularPlans: popularPlans.length,
        priceRange: {
          min: Math.min(...plans.map(p => p.amount)),
          max: Math.max(...plans.map(p => p.amount))
        }
      };
    });

    res.json({
      success: true,
      message: 'Available networks retrieved',
      networks: networksWithStats,
      count: networksWithStats.length,
      lastModified: getLastModified()
    });

  } catch (error) {
    console.error('Networks error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error retrieving networks'
    });
  }
});

// GET /api/data/plans/:network - Get data plans for specific network (ENHANCED)
router.get('/plans/:network', authenticate, async (req, res) => {
  try {
    const { network } = req.params;
    const { category, popular, includeInactive = 'false' } = req.query;

    // Validate network
    const validNetworks = ['mtn', 'airtel', 'glo', '9mobile'];
    if (!validNetworks.includes(network)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid network. Valid networks are: mtn, airtel, glo, 9mobile'
      });
    }

    setCacheHeaders(res);

    // Get plans based on filters
    let plans;
    if (includeInactive === 'true') {
      plans = DATA_PLANS[network] || [];
    } else {
      plans = getActivePlansForNetwork(network);
    }

    // Apply filters
    if (category) {
      plans = plans.filter(plan => plan.category === category);
    }

    if (popular !== undefined) {
      const isPopular = popular === 'true';
      plans = plans.filter(plan => plan.popular === isPopular);
    }

    // Group plans by category for better organization
    const plansByCategory = {
      daily: plans.filter(p => p.category === 'daily'),
      weekly: plans.filter(p => p.category === 'weekly'),
      monthly: plans.filter(p => p.category === 'monthly')
    };

    const networkInfo = NETWORK_INFO[network];

    res.json({
      success: true,
      message: `Data plans retrieved for ${network.toUpperCase()}`,
      network: {
        code: network,
        ...networkInfo
      },
      plans,
      plansByCategory,
      statistics: {
        total: plans.length,
        popular: plans.filter(p => p.popular).length,
        categories: {
          daily: plansByCategory.daily.length,
          weekly: plansByCategory.weekly.length,
          monthly: plansByCategory.monthly.length
        },
        priceRange: plans.length > 0 ? {
          min: Math.min(...plans.map(p => p.amount)),
          max: Math.max(...plans.map(p => p.amount))
        } : { min: 0, max: 0 }
      },
      lastModified: getLastModified()
    });

  } catch (error) {
    console.error('Data plans error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error retrieving data plans'
    });
  }
});

// GET /api/data/plans/:network/popular - Get popular plans for network
router.get('/plans/:network/popular', authenticate, async (req, res) => {
  try {
    const { network } = req.params;

    const validNetworks = ['mtn', 'airtel', 'glo', '9mobile'];
    if (!validNetworks.includes(network)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid network. Valid networks are: mtn, airtel, glo, 9mobile'
      });
    }

    setCacheHeaders(res);

    const popularPlans = getPopularPlansForNetwork(network);
    const networkInfo = NETWORK_INFO[network];

    res.json({
      success: true,
      message: `Popular data plans retrieved for ${network.toUpperCase()}`,
      network: {
        code: network,
        ...networkInfo
      },
      plans: popularPlans,
      count: popularPlans.length,
      lastModified: getLastModified()
    });

  } catch (error) {
    console.error('Popular plans error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error retrieving popular plans'
    });
  }
});

// GET /api/data/plans/:network/categories - Get plans grouped by category
router.get('/plans/:network/categories', authenticate, async (req, res) => {
  try {
    const { network } = req.params;

    const validNetworks = ['mtn', 'airtel', 'glo', '9mobile'];
    if (!validNetworks.includes(network)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid network. Valid networks are: mtn, airtel, glo, 9mobile'
      });
    }

    setCacheHeaders(res);

    const categories = ['daily', 'weekly', 'monthly'];
    const plansByCategory = {};

    categories.forEach(category => {
      plansByCategory[category] = getPlansByCategory(network, category);
    });

    const networkInfo = NETWORK_INFO[network];

    res.json({
      success: true,
      message: `Data plans by category retrieved for ${network.toUpperCase()}`,
      network: {
        code: network,
        ...networkInfo
      },
      categories: plansByCategory,
      summary: {
        daily: plansByCategory.daily.length,
        weekly: plansByCategory.weekly.length,
        monthly: plansByCategory.monthly.length,
        total: Object.values(plansByCategory).reduce((sum, plans) => sum + plans.length, 0)
      },
      lastModified: getLastModified()
    });

  } catch (error) {
    console.error('Categories error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error retrieving plan categories'
    });
  }
});

// GET /api/data/plans/search - Search plans with filters
router.get('/plans/search', authenticate, async (req, res) => {
  try {
    const { 
      network, 
      minAmount, 
      maxAmount, 
      category, 
      popular,
      dataSize
    } = req.query;

    if (!network) {
      return res.status(400).json({
        success: false,
        message: 'Network parameter is required'
      });
    }

    const validNetworks = ['mtn', 'airtel', 'glo', '9mobile'];
    if (!validNetworks.includes(network)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid network. Valid networks are: mtn, airtel, glo, 9mobile'
      });
    }

    setCacheHeaders(res, 1800); // Cache for 30 minutes

    const filters = {};
    if (minAmount) filters.minAmount = parseInt(minAmount);
    if (maxAmount) filters.maxAmount = parseInt(maxAmount);
    if (category) filters.category = category;
    if (popular !== undefined) filters.popular = popular === 'true';

    let plans = searchPlans(network, filters);

    // Additional filter for data size
    if (dataSize) {
      plans = plans.filter(plan => 
        plan.dataSize.toLowerCase().includes(dataSize.toLowerCase())
      );
    }

    const networkInfo = NETWORK_INFO[network];

    res.json({
      success: true,
      message: `Search results for ${network.toUpperCase()}`,
      network: {
        code: network,
        ...networkInfo
      },
      plans,
      filters: {
        network,
        minAmount: filters.minAmount,
        maxAmount: filters.maxAmount,
        category: filters.category,
        popular: filters.popular,
        dataSize
      },
      count: plans.length,
      lastModified: getLastModified()
    });

  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error searching plans'
    });
  }
});

// GET /api/data/plans - Get all data plans (ENHANCED)
router.get('/plans', authenticate, async (req, res) => {
  try {
    const { includeInactive = 'false' } = req.query;
    
    setCacheHeaders(res);

    let allPlans = {};
    let totalCount = 0;
    let popularCount = 0;

    Object.keys(DATA_PLANS).forEach(network => {
      if (includeInactive === 'true') {
        allPlans[network] = DATA_PLANS[network];
      } else {
        allPlans[network] = getActivePlansForNetwork(network);
      }
      
      totalCount += allPlans[network].length;
      popularCount += allPlans[network].filter(p => p.popular).length;
    });

    res.json({
      success: true,
      message: 'All data plans retrieved',
      plans: allPlans,
      networks: getActiveNetworks(),
      statistics: {
        totalPlans: totalCount,
        popularPlans: popularCount,
        networks: Object.keys(allPlans).length
      },
      lastModified: getLastModified()
    });

  } catch (error) {
    console.error('All data plans error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error retrieving all data plans'
    });
  }
});

// GET /api/data/plan/:planId - Get specific plan details (ENHANCED)
router.get('/plan/:planId', authenticate, async (req, res) => {
  try {
    const { planId } = req.params;

    setCacheHeaders(res);

    // Find the plan across all networks
    let foundPlan = null;
    let networkName = null;

    for (const [network, plans] of Object.entries(DATA_PLANS)) {
      const plan = plans.find(p => p.id === planId);
      if (plan) {
        foundPlan = plan;
        networkName = network;
        break;
      }
    }

    if (!foundPlan) {
      return res.status(404).json({
        success: false,
        message: 'Data plan not found'
      });
    }

    // Get similar plans (same category and similar price)
    const networkPlans = getActivePlansForNetwork(networkName);
    const similarPlans = networkPlans.filter(plan => 
      plan.id !== planId && 
      plan.category === foundPlan.category &&
      Math.abs(plan.amount - foundPlan.amount) <= 500
    ).slice(0, 3);

    const networkInfo = NETWORK_INFO[networkName];

    res.json({
      success: true,
      message: 'Data plan retrieved',
      plan: foundPlan,
      network: {
        code: networkName,
        ...networkInfo
      },
      similarPlans,
      lastModified: getLastModified()
    });

  } catch (error) {
    console.error('Single data plan error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error retrieving data plan'
    });
  }
});

module.exports = router;