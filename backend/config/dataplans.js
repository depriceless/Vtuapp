// config/dataPlans.js - Shared Data Plans Configuration
const DATA_PLANS = {
  mtn: [
    {
      id: 'mtn_100mb_1day',
      name: '100MB Daily',
      amount: 100,
      validity: '1 Day',
      dataSize: '100MB',
      network: 'mtn',
      description: '100MB data valid for 1 day',
      status: 'active',
      category: 'daily',
      popular: false,
      lastUpdated: new Date('2024-01-01')
    },
    {
      id: 'mtn_200mb_3days',
      name: '200MB 3-Day',
      amount: 200,
      validity: '3 Days',
      dataSize: '200MB',
      network: 'mtn',
      description: '200MB data valid for 3 days',
      status: 'active',
      category: 'weekly',
      popular: false,
      lastUpdated: new Date('2024-01-01')
    },
    {
      id: 'mtn_500mb_7days',
      name: '500MB Weekly',
      amount: 300,
      validity: '7 Days',
      dataSize: '500MB',
      network: 'mtn',
      description: '500MB data valid for 7 days',
      status: 'active',
      category: 'weekly',
      popular: true,
      lastUpdated: new Date('2024-01-01')
    },
    {
      id: 'mtn_1gb_30days',
      name: '1GB Monthly',
      amount: 500,
      validity: '30 Days',
      dataSize: '1GB',
      network: 'mtn',
      description: '1GB data valid for 30 days',
      status: 'active',
      category: 'monthly',
      popular: true,
      lastUpdated: new Date('2024-01-01')
    },
    {
      id: 'mtn_2gb_30days',
      name: '2GB Monthly',
      amount: 1000,
      validity: '30 Days',
      dataSize: '2GB',
      network: 'mtn',
      description: '2GB data valid for 30 days',
      status: 'active',
      category: 'monthly',
      popular: true,
      lastUpdated: new Date('2024-01-01')
    },
    {
      id: 'mtn_3gb_30days',
      name: '3GB Monthly',
      amount: 1500,
      validity: '30 Days',
      dataSize: '3GB',
      network: 'mtn',
      description: '3GB data valid for 30 days',
      status: 'active',
      category: 'monthly',
      popular: false,
      lastUpdated: new Date('2024-01-01')
    },
    {
      id: 'mtn_5gb_30days',
      name: '5GB Monthly',
      amount: 2500,
      validity: '30 Days',
      dataSize: '5GB',
      network: 'mtn',
      description: '5GB data valid for 30 days',
      status: 'active',
      category: 'monthly',
      popular: false,
      lastUpdated: new Date('2024-01-01')
    },
    {
      id: 'mtn_10gb_30days',
      name: '10GB Monthly',
      amount: 5000,
      validity: '30 Days',
      dataSize: '10GB',
      network: 'mtn',
      description: '10GB data valid for 30 days',
      status: 'active',
      category: 'monthly',
      popular: false,
      lastUpdated: new Date('2024-01-01')
    }
  ],
  airtel: [
    {
      id: 'airtel_100mb_1day',
      name: '100MB Daily',
      amount: 100,
      validity: '1 Day',
      dataSize: '100MB',
      network: 'airtel',
      description: '100MB data valid for 1 day',
      status: 'active',
      category: 'daily',
      popular: false,
      lastUpdated: new Date('2024-01-01')
    },
    {
      id: 'airtel_200mb_3days',
      name: '200MB 3-Day',
      amount: 200,
      validity: '3 Days',
      dataSize: '200MB',
      network: 'airtel',
      description: '200MB data valid for 3 days',
      status: 'active',
      category: 'weekly',
      popular: false,
      lastUpdated: new Date('2024-01-01')
    },
    {
      id: 'airtel_500mb_14days',
      name: '500MB Bi-Weekly',
      amount: 300,
      validity: '14 Days',
      dataSize: '500MB',
      network: 'airtel',
      description: '500MB data valid for 14 days',
      status: 'active',
      category: 'weekly',
      popular: true,
      lastUpdated: new Date('2024-01-01')
    },
    {
      id: 'airtel_1gb_30days',
      name: '1GB Monthly',
      amount: 500,
      validity: '30 Days',
      dataSize: '1GB',
      network: 'airtel',
      description: '1GB data valid for 30 days',
      status: 'active',
      category: 'monthly',
      popular: true,
      lastUpdated: new Date('2024-01-01')
    },
    {
      id: 'airtel_2gb_30days',
      name: '2GB Monthly',
      amount: 1000,
      validity: '30 Days',
      dataSize: '2GB',
      network: 'airtel',
      description: '2GB data valid for 30 days',
      status: 'active',
      category: 'monthly',
      popular: true,
      lastUpdated: new Date('2024-01-01')
    },
    {
      id: 'airtel_3gb_30days',
      name: '3GB Monthly',
      amount: 1500,
      validity: '30 Days',
      dataSize: '3GB',
      network: 'airtel',
      description: '3GB data valid for 30 days',
      status: 'active',
      category: 'monthly',
      popular: false,
      lastUpdated: new Date('2024-01-01')
    },
    {
      id: 'airtel_5gb_30days',
      name: '5GB Monthly',
      amount: 2500,
      validity: '30 Days',
      dataSize: '5GB',
      network: 'airtel',
      description: '5GB data valid for 30 days',
      status: 'active',
      category: 'monthly',
      popular: false,
      lastUpdated: new Date('2024-01-01')
    },
    {
      id: 'airtel_10gb_30days',
      name: '10GB Monthly',
      amount: 5000,
      validity: '30 Days',
      dataSize: '10GB',
      network: 'airtel',
      description: '10GB data valid for 30 days',
      status: 'active',
      category: 'monthly',
      popular: false,
      lastUpdated: new Date('2024-01-01')
    }
  ],
  glo: [
    {
      id: 'glo_100mb_1day',
      name: '100MB Daily',
      amount: 100,
      validity: '1 Day',
      dataSize: '100MB',
      network: 'glo',
      description: '100MB data valid for 1 day',
      status: 'active',
      category: 'daily',
      popular: false,
      lastUpdated: new Date('2024-01-01')
    },
    {
      id: 'glo_200mb_5days',
      name: '200MB 5-Day',
      amount: 200,
      validity: '5 Days',
      dataSize: '200MB',
      network: 'glo',
      description: '200MB data valid for 5 days',
      status: 'active',
      category: 'weekly',
      popular: false,
      lastUpdated: new Date('2024-01-01')
    },
    {
      id: 'glo_500mb_30days',
      name: '500MB Monthly',
      amount: 300,
      validity: '30 Days',
      dataSize: '500MB',
      network: 'glo',
      description: '500MB data valid for 30 days',
      status: 'active',
      category: 'monthly',
      popular: true,
      lastUpdated: new Date('2024-01-01')
    },
    {
      id: 'glo_1gb_30days',
      name: '1GB Monthly',
      amount: 500,
      validity: '30 Days',
      dataSize: '1GB',
      network: 'glo',
      description: '1GB data valid for 30 days',
      status: 'active',
      category: 'monthly',
      popular: true,
      lastUpdated: new Date('2024-01-01')
    },
    {
      id: 'glo_2gb_30days',
      name: '2GB Monthly',
      amount: 1000,
      validity: '30 Days',
      dataSize: '2GB',
      network: 'glo',
      description: '2GB data valid for 30 days',
      status: 'active',
      category: 'monthly',
      popular: true,
      lastUpdated: new Date('2024-01-01')
    },
    {
      id: 'glo_3gb_30days',
      name: '3GB Monthly',
      amount: 1500,
      validity: '30 Days',
      dataSize: '3GB',
      network: 'glo',
      description: '3GB data valid for 30 days',
      status: 'active',
      category: 'monthly',
      popular: false,
      lastUpdated: new Date('2024-01-01')
    },
    {
      id: 'glo_5gb_30days',
      name: '5GB Monthly',
      amount: 2500,
      validity: '30 Days',
      dataSize: '5GB',
      network: 'glo',
      description: '5GB data valid for 30 days',
      status: 'active',
      category: 'monthly',
      popular: false,
      lastUpdated: new Date('2024-01-01')
    },
    {
      id: 'glo_10gb_30days',
      name: '10GB Monthly',
      amount: 5000,
      validity: '30 Days',
      dataSize: '10GB',
      network: 'glo',
      description: '10GB data valid for 30 days',
      status: 'active',
      category: 'monthly',
      popular: false,
      lastUpdated: new Date('2024-01-01')
    }
  ],
  '9mobile': [
    {
      id: '9mobile_100mb_1day',
      name: '100MB Daily',
      amount: 100,
      validity: '1 Day',
      dataSize: '100MB',
      network: '9mobile',
      description: '100MB data valid for 1 day',
      status: 'active',
      category: 'daily',
      popular: false,
      lastUpdated: new Date('2024-01-01')
    },
    {
      id: '9mobile_200mb_2days',
      name: '200MB 2-Day',
      amount: 200,
      validity: '2 Days',
      dataSize: '200MB',
      network: '9mobile',
      description: '200MB data valid for 2 days',
      status: 'active',
      category: 'weekly',
      popular: false,
      lastUpdated: new Date('2024-01-01')
    },
    {
      id: '9mobile_500mb_7days',
      name: '500MB Weekly',
      amount: 300,
      validity: '7 Days',
      dataSize: '500MB',
      network: '9mobile',
      description: '500MB data valid for 7 days',
      status: 'active',
      category: 'weekly',
      popular: true,
      lastUpdated: new Date('2024-01-01')
    },
    {
      id: '9mobile_1gb_30days',
      name: '1GB Monthly',
      amount: 500,
      validity: '30 Days',
      dataSize: '1GB',
      network: '9mobile',
      description: '1GB data valid for 30 days',
      status: 'active',
      category: 'monthly',
      popular: true,
      lastUpdated: new Date('2024-01-01')
    },
    {
      id: '9mobile_2gb_30days',
      name: '2GB Monthly',
      amount: 1000,
      validity: '30 Days',
      dataSize: '2GB',
      network: '9mobile',
      description: '2GB data valid for 30 days',
      status: 'active',
      category: 'monthly',
      popular: true,
      lastUpdated: new Date('2024-01-01')
    },
    {
      id: '9mobile_3gb_30days',
      name: '3GB Monthly',
      amount: 1500,
      validity: '30 Days',
      dataSize: '3GB',
      network: '9mobile',
      description: '3GB data valid for 30 days',
      status: 'active',
      category: 'monthly',
      popular: false,
      lastUpdated: new Date('2024-01-01')
    },
    {
      id: '9mobile_5gb_30days',
      name: '5GB Monthly',
      amount: 2500,
      validity: '30 Days',
      dataSize: '5GB',
      network: '9mobile',
      description: '5GB data valid for 30 days',
      status: 'active',
      category: 'monthly',
      popular: false,
      lastUpdated: new Date('2024-01-01')
    },
    {
      id: '9mobile_10gb_30days',
      name: '10GB Monthly',
      amount: 5000,
      validity: '30 Days',
      dataSize: '10GB',
      network: '9mobile',
      description: '10GB data valid for 30 days',
      status: 'active',
      category: 'monthly',
      popular: false,
      lastUpdated: new Date('2024-01-01')
    }
  ]
};

// Network metadata
const NETWORK_INFO = {
  mtn: {
    name: 'MTN',
    code: 'mtn',
    status: 'active',
    color: '#FFCC00',
    logo: '/images/networks/mtn.png',
    lastUpdated: new Date('2024-01-01')
  },
  airtel: {
    name: 'Airtel',
    code: 'airtel',
    status: 'active',
    color: '#E60000',
    logo: '/images/networks/airtel.png',
    lastUpdated: new Date('2024-01-01')
  },
  glo: {
    name: 'Glo',
    code: 'glo',
    status: 'active',
    color: '#52C41A',
    logo: '/images/networks/glo.png',
    lastUpdated: new Date('2024-01-01')
  },
  '9mobile': {
    name: '9mobile',
    code: '9mobile',
    status: 'active',
    color: '#00A651',
    logo: '/images/networks/9mobile.png',
    lastUpdated: new Date('2024-01-01')
  }
};

// Utility functions
const getActiveNetworks = () => {
  return Object.entries(NETWORK_INFO)
    .filter(([, info]) => info.status === 'active')
    .map(([code, info]) => ({ code, ...info }));
};

const getActivePlansForNetwork = (network) => {
  const plans = DATA_PLANS[network] || [];
  return plans.filter(plan => plan.status === 'active');
};

const getPopularPlansForNetwork = (network) => {
  const plans = getActivePlansForNetwork(network);
  return plans.filter(plan => plan.popular);
};

const getPlansByCategory = (network, category) => {
  const plans = getActivePlansForNetwork(network);
  return plans.filter(plan => plan.category === category);
};

const searchPlans = (network, filters = {}) => {
  let plans = getActivePlansForNetwork(network);
  
  if (filters.minAmount) {
    plans = plans.filter(plan => plan.amount >= filters.minAmount);
  }
  
  if (filters.maxAmount) {
    plans = plans.filter(plan => plan.amount <= filters.maxAmount);
  }
  
  if (filters.category) {
    plans = plans.filter(plan => plan.category === filters.category);
  }
  
  if (filters.popular !== undefined) {
    plans = plans.filter(plan => plan.popular === filters.popular);
  }
  
  return plans;
};

const getLastModified = () => {
  let lastModified = new Date(0);
  
  Object.values(DATA_PLANS).forEach(networkPlans => {
    networkPlans.forEach(plan => {
      if (plan.lastUpdated > lastModified) {
        lastModified = plan.lastUpdated;
      }
    });
  });
  
  return lastModified;
};

module.exports = {
  DATA_PLANS,
  NETWORK_INFO,
  getActiveNetworks,
  getActivePlansForNetwork,
  getPopularPlansForNetwork,
  getPlansByCategory,
  searchPlans,
  getLastModified
};