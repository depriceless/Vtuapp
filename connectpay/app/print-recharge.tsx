import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
  RefreshControl
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';

const API_BASE_URL = 'http://localhost:5000/api';

interface UserBalance {
  total: number;
  mainBalance: number;
  bonusBalance: number;
  main: number;
  bonus: number;
  amount: number;
  currency: string;
  lastUpdated: string;
}

interface Transaction {
  _id: string;
  network: string;
  type: string;
  amount: number;
  quantity: number;
  denomination: number;
  pins: Array<{ pin: string; serial: string }>;
  status: string;
  createdAt: string;
  balanceAfter: number;
}

interface PinStatus {
  isPinSet: boolean;
  hasPinSet: boolean;
  isLocked: boolean;
  lockTimeRemaining: number;
  attemptsRemaining: number;
}

// Enhanced API service with better error handling
class ApiService {
  private static instance: ApiService;
  private authToken: string | null = null;

  static getInstance(): ApiService {
    if (!ApiService.instance) {
      ApiService.instance = new ApiService();
    }
    return ApiService.instance;
  }

  private async getAuthToken(): Promise<string> {
    if (this.authToken) return this.authToken;

    try {
      const tokenKeys = ['userToken', 'authToken', 'token', 'access_token'];

      for (const key of tokenKeys) {
        const token = await AsyncStorage.getItem(key);
        console.log(`Checking storage key "${key}":`, token ? `Found (${token.length} chars)` : 'Not found');

        if (token && token.trim() !== '' && token !== 'undefined' && token !== 'null') {
          const cleanToken = token.trim();
          const tokenParts = cleanToken.split('.');
          if (tokenParts.length === 3) {
            console.log(`Found valid JWT token with key: ${key}`);
            this.authToken = cleanToken;
            return cleanToken;
          }
        }
      }

      console.log('No valid JWT token found in any storage key');
      throw new Error('No authentication token found');
    } catch (error) {
      console.error('Error getting auth token:', error);
      throw new Error('Authentication required');
    }
  }

  private async makeRequest(endpoint: string, options: RequestInit = {}, retryCount = 0): Promise<any> {
    console.log(`API Request: ${endpoint}`);
    
    try {
      const token = await this.getAuthToken();
      console.log('Token obtained for API request');

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const requestConfig = {
        method: 'GET',
        ...options,
        signal: controller.signal,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...options.headers,
        },
      };

      const fullUrl = `${API_BASE_URL}${endpoint}`;
      console.log('Request URL:', fullUrl);
      console.log('Request config:', { ...requestConfig, headers: { ...requestConfig.headers, Authorization: 'Bearer [TOKEN]' } });

      const response = await fetch(fullUrl, requestConfig);
      clearTimeout(timeoutId);

      console.log('Response status:', response.status, response.ok ? 'Success' : 'Error');

      let responseText = '';
      try {
        responseText = await response.text();
        console.log('Response text length:', responseText.length);
      } catch (textError) {
        console.error('Failed to read response text:', textError);
        throw new Error('Unable to read server response');
      }

      let data = {};
      if (responseText.trim()) {
        try {
          data = JSON.parse(responseText);
          console.log('JSON parsed successfully, response data:', data);
        } catch (parseError) {
          console.error('JSON parse error:', parseError);
          console.log('Raw response preview:', responseText.substring(0, 200));
          throw new Error(`Invalid JSON response from server. Status: ${response.status}`);
        }
      }

      if (response.status === 401) {
        console.error('401 Unauthorized - clearing tokens');
        const tokenKeys = ['userToken', 'authToken', 'token', 'access_token'];
        for (const key of tokenKeys) {
          await AsyncStorage.removeItem(key);
        }
        this.authToken = null;
        throw new Error('Session expired. Please login again.');
      }

      if (!response.ok) {
        const errorMessage = data?.message || data?.error || `HTTP ${response.status}: ${response.statusText}`;
        console.error('API Error:', errorMessage);
        
        if (endpoint.includes('/recharge/generate') && data && typeof data === 'object') {
          const error = new Error(errorMessage);
          (error as any).responseData = data;
          (error as any).httpStatus = response.status;
          throw error;
        }
        
        throw new Error(errorMessage);
      }

      console.log('API request successful');
      return data;

    } catch (error: any) {
      console.error(`API Error for ${endpoint}:`, error.message);

      if (retryCount < 2 && (error.name === 'AbortError' || error.message.includes('network'))) {
        console.log(`Retrying request (attempt ${retryCount + 1})`);
        await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
        return this.makeRequest(endpoint, options, retryCount + 1);
      }

      if (error.name === 'TypeError' && error.message.includes('Network request failed')) {
        throw new Error('Network connection failed. Please check your internet connection.');
      }

      if (error.message.includes('Authentication') || 
          error.message.includes('Session expired') ||
          error.responseData) {
        throw error;
      }

      throw error;
    }
  }

  async generatePins(data: any): Promise<any> {
    return this.makeRequest('/recharge/generate', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getHistory(): Promise<any> {
    return this.makeRequest('/recharge/history');
  }

  async getBalance(): Promise<any> {
    return this.makeRequest('/balance');
  }

  async checkPinStatus(): Promise<any> {
    return this.makeRequest('/purchase/pin-status');
  }

  clearAuth(): void {
    this.authToken = null;
  }
}

export default function PrintRecharge() {
  const [activeTab, setActiveTab] = useState<'generate' | 'history'>('generate');
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);
  const [selectedNetwork, setSelectedNetwork] = useState<string | null>(null);
  const [cardType, setCardType] = useState<'airtime' | 'data'>('airtime');
  const [denomination, setDenomination] = useState<number | null>(null);
  const [quantity, setQuantity] = useState<string>('1');
  const [pin, setPin] = useState('');
  const [userBalance, setUserBalance] = useState<UserBalance | null>(null);
  const [pinStatus, setPinStatus] = useState<PinStatus | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [isValidatingPin, setIsValidatingPin] = useState(false);
  const [pinError, setPinError] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [generatedPins, setGeneratedPins] = useState<Array<{ pin: string; serial: string }>>([]);

  // Networks
  const networks = [
    { id: 'mtn', label: 'MTN', logo: require('../assets/images/mtnlogo.jpg') },
    { id: 'airtel', label: 'AIRTEL', logo: require('../assets/images/Airtelogo.png') },
    { id: 'glo', label: 'GLO', logo: require('../assets/images/glologo.png') },
    { id: '9mobile', label: '9MOBILE', logo: require('../assets/images/9mobilelogo.jpg') },
  ];

  // Enhanced denominations based on network
  const getDenominations = useCallback((network: string | null) => {
    const networkDenominations: Record<string, number[]> = {
      mtn: [100, 200, 500, 1000, 1500, 2000],
      airtel: [100, 200, 500, 1000, 2000],
      glo: [100, 200, 500, 1000],
      '9mobile': [100, 200, 500, 1000]
    };
    return network ? networkDenominations[network] || [100, 200, 500, 1000] : [100, 200, 500, 1000];
  }, []);

  const denominations = useMemo(() => getDenominations(selectedNetwork), [selectedNetwork, getDenominations]);

  // Validation
  const totalAmount = useMemo(() => {
    if (!denomination || !quantity) return 0;
    const qty = parseInt(quantity) || 1;
    return denomination * Math.max(1, Math.min(100, qty));
  }, [denomination, quantity]);

  const hasEnoughBalance = useMemo(() => {
    if (!userBalance) return false;
    
    const availableBalance = userBalance.total || 
                            userBalance.amount || 
                            userBalance.mainBalance || 
                            userBalance.main || 
                            0;
    
    console.log('Balance check:', {
      totalAmount,
      availableBalance,
      userBalance,
      hasEnough: totalAmount <= availableBalance
    });
    
    return totalAmount <= availableBalance;
  }, [userBalance, totalAmount]);

  const canProceed = useMemo(() => {
    const qty = parseInt(quantity) || 0;
    return selectedNetwork && cardType && denomination && qty > 0 && qty <= 100 && hasEnoughBalance && !authError;
  }, [selectedNetwork, cardType, denomination, quantity, hasEnoughBalance, authError]);

  const isPinValid = useMemo(() => 
    pin.length === 4 && /^\d{4}$/.test(pin),
    [pin]
  );

  // Helper function to get balance amount consistently
  const getBalanceAmount = useCallback((balance: UserBalance | null): number => {
    if (!balance) return 0;
    return balance.total || balance.amount || balance.mainBalance || balance.main || 0;
  }, []);

  // Load data on mount
  useEffect(() => {
    const initializeData = async () => {
      setTimeout(() => {
        fetchUserBalance();
        checkPinStatusAPI();
      }, 1000);
    };

    initializeData();
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (activeTab === 'history') {
        loadTransactionHistory();
      } else {
        fetchUserBalance();
      }
    }, [activeTab])
  );

  useEffect(() => {
    if (currentStep === 2) {
      fetchUserBalance();
    }
  }, [currentStep]);

  useEffect(() => {
    if (currentStep === 3) {
      setPin('');
      setPinError('');
      checkPinStatusAPI();
    }
  }, [currentStep]);

  const fetchUserBalance = useCallback(async () => {
    setIsLoadingBalance(true);
    try {
      console.log("Fetching balance from /balance");
      setAuthError(null);
      const balanceData = await ApiService.getInstance().getBalance();

      if (balanceData.success && balanceData.balance) {
        const balanceAmount = parseFloat(balanceData.balance.amount) || 0;
        
        const realBalance: UserBalance = {
          main: balanceAmount,
          bonus: 0,
          total: balanceAmount,
          amount: balanceAmount,
          mainBalance: balanceAmount,
          bonusBalance: 0,
          currency: balanceData.balance.currency || "NGN",
          lastUpdated: balanceData.balance.lastUpdated || new Date().toISOString(),
        };

        setUserBalance(realBalance);
        await AsyncStorage.setItem("userBalance", JSON.stringify(realBalance));
        console.log("Balance fetched and stored:", realBalance);
      } else {
        throw new Error(balanceData.message || "Balance fetch failed");
      }
    } catch (error: any) {
      console.error('Balance fetch error:', error);
      if (error.message.includes('Authentication') || error.message.includes('token')) {
        setAuthError('Session expired. Please login again.');
        ApiService.getInstance().clearAuth();
      }

      try {
        const cachedBalance = await AsyncStorage.getItem("userBalance");
        if (cachedBalance) {
          const parsedBalance = JSON.parse(cachedBalance);
          setUserBalance({
            ...parsedBalance,
            lastUpdated: parsedBalance.lastUpdated || new Date().toISOString(),
          });
          console.log("Using cached balance:", parsedBalance);
        } else {
          setUserBalance(null);
        }
      } catch (cacheError) {
        console.error("Cache error:", cacheError);
        setUserBalance(null);
      }
    } finally {
      setIsLoadingBalance(false);
    }
  }, []);

  const checkPinStatusAPI = useCallback(async () => {
    try {
      console.log('Checking PIN status...');
      const response = await ApiService.getInstance().checkPinStatus();
      console.log('PIN status response:', response);
      
      if (response.success) {
        setPinStatus(response);
      } else {
        console.log('PIN status check failed:', response);
      }
    } catch (error: any) {
      console.error('Error checking PIN status:', error);
      if (error.message.includes('Authentication') || error.message.includes('token')) {
        setAuthError('Session expired. Please login again.');
        ApiService.getInstance().clearAuth();
      }
    }
  }, []);

  const loadTransactionHistory = useCallback(async () => {
    setIsLoading(true);
    try {
      setAuthError(null);
      const response = await ApiService.getInstance().getHistory();
      if (response.success) {
        setTransactions(response.data?.transactions || []);
      }
    } catch (error: any) {
      console.error('History load error:', error);
      if (error.message.includes('Authentication') || error.message.includes('token')) {
        setAuthError('Session expired. Please login again.');
        ApiService.getInstance().clearAuth();
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (activeTab === 'history') {
      await loadTransactionHistory();
    } else {
      await fetchUserBalance();
    }
    setRefreshing(false);
  }, [activeTab, loadTransactionHistory, fetchUserBalance]);

  // Enhanced PIN generation with better debugging
  const generateRechargePins = useCallback(async () => {
    console.log('=== RECHARGE PIN GENERATION START ===');
    console.log('Current state:', {
      selectedNetwork,
      cardType,
      denomination,
      quantity,
      pin: pin ? '****' : 'empty',
      totalAmount,
      hasEnoughBalance,
      userBalance: userBalance ? getBalanceAmount(userBalance) : 'null'
    });
    
    // Validate inputs
    if (!isPinValid) {
      console.log('❌ PIN invalid:', pin);
      setPinError('PIN must be exactly 4 digits');
      return;
    }

    const qty = parseInt(quantity);
    if (isNaN(qty) || qty < 1 || qty > 100) {
      console.log('❌ Quantity invalid:', quantity);
      setPinError('Quantity must be between 1 and 100');
      return;
    }

    if (!selectedNetwork || !denomination) {
      console.log('❌ Missing fields:', { selectedNetwork, denomination });
      setPinError('Please complete all fields');
      return;
    }

    if (!hasEnoughBalance) {
      console.log('❌ Insufficient balance');
      setPinError('Insufficient balance for this transaction');
      return;
    }

    console.log('✅ Validation passed, starting PIN generation...');
    setIsProcessing(true);
    setIsValidatingPin(true);
    setPinError('');

    try {
      const requestData = {
        network: selectedNetwork,
        type: cardType,
        denomination,
        quantity: qty,
        pin,
      };

      console.log('📦 Sending request with payload:', {
        ...requestData,
        pin: '****' // Hide PIN in logs
      });

      // Add timeout wrapper
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Request timeout after 30 seconds')), 30000)
      );

      const apiPromise = ApiService.getInstance().generatePins(requestData);
      
      const response = await Promise.race([apiPromise, timeoutPromise]) as any;
      
      console.log('📊 Raw response received:', response);
      console.log('📊 Response type:', typeof response);
      console.log('📊 Response keys:', response ? Object.keys(response) : 'no keys');

      // Handle different response formats
      if (response && response.success === true) {
        console.log('🎉 PIN generation marked as successful!');
        
        // Extract and store generated PINs - check multiple possible response structures
        let pins = [];
        
        // Try different possible response structures
        if (response.pins && Array.isArray(response.pins)) {
          pins = response.pins;
        } else if (response.data?.pins && Array.isArray(response.data.pins)) {
          pins = response.data.pins;
        } else if (response.transaction?.pins && Array.isArray(response.transaction.pins)) {
          pins = response.transaction.pins;
        } else if (response.result?.pins && Array.isArray(response.result.pins)) {
          pins = response.result.pins;
        } else if (response.recharge?.pins && Array.isArray(response.recharge.pins)) {
          pins = response.recharge.pins;
        } else {
          // Log the full response structure to help debug
          console.log('🔍 Full response structure for PIN extraction:', JSON.stringify(response, null, 2));
          
          // Try to find pins anywhere in the response object
          const findPins = (obj) => {
            if (Array.isArray(obj)) {
              // Check if this array contains pin-like objects
              if (obj.length > 0 && obj[0] && (obj[0].pin || obj[0].serial)) {
                return obj;
              }
            }
            if (obj && typeof obj === 'object') {
              for (const key in obj) {
                if (key.toLowerCase().includes('pin') && Array.isArray(obj[key])) {
                  return obj[key];
                }
                const result = findPins(obj[key]);
                if (result && Array.isArray(result) && result.length > 0) {
                  return result;
                }
              }
            }
            return null;
          };
          
          const foundPins = findPins(response);
          if (foundPins && foundPins.length > 0) {
            pins = foundPins;
          }
        }

        console.log('🎉 Extracted PINs:', pins);
        console.log('🎉 PINs count:', pins.length);
        
        // Validate PIN structure and ensure we have the PINs even if backend fails later
        if (pins.length > 0) {
          pins.forEach((pin, index) => {
            console.log(`PIN ${index + 1}:`, pin);
          });
          
          // Store PINs immediately in case of later errors
          setGeneratedPins(pins);
          
          // Update balance if provided
          if (response.newBalance) {
            console.log('💰 Updating balance from response:', response.newBalance);
            const balanceAmount = response.newBalance.amount || 
                                 response.newBalance.totalBalance || 
                                 response.newBalance.mainBalance || 0;
            
            const updatedBalance: UserBalance = {
              main: balanceAmount,
              bonus: 0,
              total: balanceAmount,
              amount: balanceAmount,
              mainBalance: balanceAmount,
              bonusBalance: 0,
              currency: response.newBalance.currency || "NGN",
              lastUpdated: response.newBalance.lastUpdated || new Date().toISOString(),
            };

            setUserBalance(updatedBalance);
            await AsyncStorage.setItem("userBalance", JSON.stringify(updatedBalance));
            console.log('✅ Balance updated successfully:', updatedBalance);
          }
          
          setCurrentStep(4); // Move to success step
          console.log('🎉 Moving to PIN display step with', pins.length, 'PINs');
        } else {
          console.warn('⚠️ No PINs found in response');
          // Still show success but with warning
          setGeneratedPins([]);
          setCurrentStep(4);
        }
      } else if (response && response.success === false) {
        console.log('❌ Server returned failure:', response.message || response.error);
        const errorMsg = response.message || response.error || 'Failed to generate PINs';
        setPinError(errorMsg);
      } else {
        console.log('⚠️ Unexpected response format:', response);
        
        // Try to extract PINs even from unexpected response format
        let pins = [];
        const findPins = (obj) => {
          if (Array.isArray(obj)) {
            if (obj.length > 0 && obj[0] && (obj[0].pin || obj[0].serial)) {
              return obj;
            }
          }
          if (obj && typeof obj === 'object') {
            for (const key in obj) {
              if (key.toLowerCase().includes('pin') && Array.isArray(obj[key])) {
                return obj[key];
              }
              const result = findPins(obj[key]);
              if (result && Array.isArray(result) && result.length > 0) {
                return result;
              }
            }
          }
          return null;
        };
        
        const foundPins = findPins(response);
        if (foundPins && foundPins.length > 0) {
          console.log('🎉 Found PINs in unexpected response format:', foundPins);
          setGeneratedPins(foundPins);
          setCurrentStep(4);
        } else {
          setPinError('Unexpected server response format');
        }
      }
    } catch (error: any) {
      console.error('💥 PIN generation error caught:', error);
      console.error('💥 Error name:', error.name);
      console.error('💥 Error message:', error.message);
      console.error('💥 Error stack:', error.stack);
      
      // Check if this might be a partial success (PINs generated but transaction failed)
      if (error.responseData) {
        console.log('🔍 Checking error response data for PINs:', error.responseData);
        
        // Try to extract PINs from error response
        let pins = [];
        const findPins = (obj) => {
          if (Array.isArray(obj)) {
            if (obj.length > 0 && obj[0] && (obj[0].pin || obj[0].serial)) {
              return obj;
            }
          }
          if (obj && typeof obj === 'object') {
            for (const key in obj) {
              if (key.toLowerCase().includes('pin') && Array.isArray(obj[key])) {
                return obj[key];
              }
              const result = findPins(obj[key]);
              if (result && Array.isArray(result) && result.length > 0) {
                return result;
              }
            }
          }
          return null;
        };
        
        const foundPins = findPins(error.responseData);
        if (foundPins && foundPins.length > 0) {
          console.log('🎉 Found PINs in error response! Partial success scenario:', foundPins);
          setGeneratedPins(foundPins);
          setCurrentStep(4);
          
          // Show warning about potential balance discrepancy
          Alert.alert(
            'PINs Generated with Warning',
            'Your PINs were generated successfully, but there may have been an issue with the transaction recording. Please check your balance and transaction history.',
            [{ text: 'OK' }]
          );
          return;
        }
      }
      
      let errorMessage = 'Failed to generate PINs';
      
      if (error.message) {
        errorMessage = error.message;
        console.log('📝 Using error message:', errorMessage);
      }
      
      // Categorize errors
      if (errorMessage.includes('timeout')) {
        setPinError('Request timed out. Please check your connection and try again.');
      } else if (errorMessage.includes('locked') || errorMessage.includes('attempts')) {
        setPinError(errorMessage);
      } else if (errorMessage.includes('PIN')) {
        setPinError(errorMessage);
      } else if (errorMessage.includes('insufficient') || errorMessage.includes('balance')) {
        setPinError('Insufficient balance for this transaction');
      } else if (errorMessage.includes('network') || errorMessage.includes('server') || errorMessage.includes('fetch')) {
        setPinError('Network error. Please check your connection and try again');
      } else if (errorMessage.includes('Authentication') || errorMessage.includes('token')) {
        setAuthError('Session expired. Please login again.');
        ApiService.getInstance().clearAuth();
        setPinError('Session expired. Please login again.');
      } else if (errorMessage.includes('description') || errorMessage.includes('exceed') || errorMessage.includes('500 characters')) {
        // Handle the specific error you're encountering - PINs were likely generated
        setPinError('PINs generated successfully but transaction recording failed. Check your transaction history or contact support if balance was debited.');
        
        // Try to refresh balance and history since PINs may have been generated
        setTimeout(() => {
          fetchUserBalance();
          if (activeTab === 'history') {
            loadTransactionHistory();
          }
        }, 2000);
      } else {
        setPinError(errorMessage);
      }

      console.log('📝 Final error message set:', errorMessage);
    } finally {
      console.log('🔄 Cleaning up - setting loading states to false');
      setIsProcessing(false);
      setIsValidatingPin(false);
      console.log('=== RECHARGE PIN GENERATION END ===');
    }
  }, [isPinValid, quantity, selectedNetwork, denomination, cardType, pin, totalAmount, hasEnoughBalance, userBalance, fetchUserBalance, activeTab, loadTransactionHistory, getBalanceAmount]);

  // Input handlers
  const handleQuantityChange = useCallback((text: string) => {
    // Allow empty string so user can delete and type new numbers
    if (text === '') {
      setQuantity('');
      return;
    }
    
    const numericValue = text.replace(/[^0-9]/g, '');
    
    // Don't auto-clamp while user is typing, just validate the input
    if (numericValue === '' || numericValue === '0') {
      setQuantity('1');
    } else if (parseInt(numericValue) > 100) {
      setQuantity('100');
    } else {
      setQuantity(numericValue);
    }
  }, []);

  const handlePinChange = useCallback((text: string) => {
    const numericPin = text.replace(/\D/g, '').substring(0, 4);
    setPin(numericPin);
    if (pinError && numericPin.length === 4 && /^\d{4}$/.test(numericPin)) {
      setPinError('');
    }
  }, [pinError]);

  // Reset denomination when network changes
  useEffect(() => {
    if (selectedNetwork && denomination && !denominations.includes(denomination)) {
      setDenomination(null);
    }
  }, [selectedNetwork, denomination, denominations]);

  // Render functions
  const renderGenerateTab = () => (
    <ScrollView 
      style={styles.scrollContent}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.section}>
        <Text style={styles.label}>Select Network</Text>
        <View style={styles.networkRow}>
          {networks.map((net) => (
            <TouchableOpacity
              key={net.id}
              style={[
                styles.networkCard,
                selectedNetwork === net.id && styles.networkSelected,
              ]}
              onPress={() => setSelectedNetwork(net.id)}
            >
              <Image source={net.logo} style={styles.networkLogo} />
              <Text style={styles.networkLabel}>{net.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Card Type</Text>
        <View style={styles.cardTypeRow}>
          <TouchableOpacity
            style={[
              styles.cardTypeBtn,
              cardType === 'airtime' && styles.cardTypeSelected,
            ]}
            onPress={() => setCardType('airtime')}
          >
            <Text style={[
              styles.cardTypeText,
              cardType === 'airtime' && styles.cardTypeTextSelected
            ]}>
              Airtime
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.cardTypeBtn,
              cardType === 'data' && styles.cardTypeSelected,
            ]}
            onPress={() => setCardType('data')}
          >
            <Text style={[
              styles.cardTypeText,
              cardType === 'data' && styles.cardTypeTextSelected
            ]}>
              Data
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Denomination</Text>
        <View style={styles.denominationGrid}>
          {denominations.map((amount) => (
            <TouchableOpacity
              key={amount}
              style={[
                styles.denominationBtn,
                denomination === amount && styles.denominationSelected,
              ]}
              onPress={() => setDenomination(amount)}
            >
              <Text style={[
                styles.denominationText,
                denomination === amount && styles.denominationTextSelected
              ]}>
                ₦{amount}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Quantity</Text>
        <TextInput
          style={[styles.input, (!quantity || parseInt(quantity) < 1) && styles.inputError]}
          keyboardType="numeric"
          placeholder="Enter quantity (1-100)"
          value={quantity}
          onChangeText={handleQuantityChange}
          maxLength={3}
        />
        {(!quantity || parseInt(quantity) < 1) && (
          <Text style={styles.inputErrorText}>Please enter a valid quantity (1-100)</Text>
        )}
      </View>

      {denomination && quantity && (
        <View style={styles.section}>
          <Text style={styles.label}>Total Amount</Text>
          <Text style={styles.totalAmount}>
            ₦{totalAmount.toLocaleString()}
          </Text>
        </View>
      )}

      <TouchableOpacity
        style={[styles.proceedBtn, !canProceed && styles.proceedDisabled]}
        disabled={!canProceed}
        onPress={() => setCurrentStep(2)}
      >
        <Text style={styles.proceedText}>
          {authError ? 'Please Login' : 
           !hasEnoughBalance ? 'Insufficient Balance' :
           canProceed ? `Proceed to Summary • ₦${totalAmount.toLocaleString()}` :
           'Complete all fields'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );

  const renderSummaryStep = () => (
    <ScrollView style={styles.scrollContent}>
      <View style={styles.balanceCard}>
        <View style={styles.balanceHeader}>
          <Text style={styles.balanceTitle}>Wallet Balance</Text>
          <TouchableOpacity 
            style={styles.refreshBtn} 
            onPress={fetchUserBalance}
            disabled={isLoadingBalance}
          >
            {isLoadingBalance ? (
              <ActivityIndicator size="small" color="#ff3b30" />
            ) : (
              <Text style={styles.refreshText}>🔄</Text>
            )}
          </TouchableOpacity>
        </View>

        {userBalance ? (
          <>
            <Text style={styles.totalBalance}>
              ₦{getBalanceAmount(userBalance).toLocaleString()}
            </Text>

            <Text style={styles.lastUpdated}>
              Last updated: {new Date(userBalance.lastUpdated || Date.now()).toLocaleTimeString()}
            </Text>

            {totalAmount > 0 && (
              <View style={styles.transactionPreview}>
                <Text style={styles.previewLabel}>After purchase:</Text>
                <Text style={[
                  styles.previewAmount,
                  (getBalanceAmount(userBalance) - totalAmount) < 0 ? styles.insufficientPreview : styles.sufficientPreview
                ]}>
                  ₦{Math.max(0, getBalanceAmount(userBalance) - totalAmount).toLocaleString()}
                </Text>
              </View>
            )}

            {totalAmount > getBalanceAmount(userBalance) && (
              <View style={styles.insufficientBalanceWarning}>
                <Text style={styles.warningText}>
                  ⚠️ Insufficient balance for this transaction
                </Text>
              </View>
            )}
          </>
        ) : (
          <View style={styles.loadingBalance}>
            <Text style={styles.noBalanceText}>
              {isLoadingBalance ? 'Loading your balance...' : 'Unable to load balance'}
            </Text>
            {!isLoadingBalance && (
              <TouchableOpacity 
                style={styles.retryBtn}
                onPress={fetchUserBalance}
              >
                <Text style={styles.retryBtnText}>Tap to Retry</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Purchase Summary</Text>

        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Network:</Text>
          <Text style={styles.summaryValue}>
            {networks.find(n => n.id === selectedNetwork)?.label}
          </Text>
        </View>

        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Type:</Text>
          <Text style={styles.summaryValue}>{cardType?.toUpperCase()}</Text>
        </View>

        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Denomination:</Text>
          <Text style={styles.summaryValue}>₦{denomination?.toLocaleString()}</Text>
        </View>

        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Quantity:</Text>
          <Text style={styles.summaryValue}>{quantity}</Text>
        </View>

        <View style={styles.summaryDivider} />

        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Total:</Text>
          <Text style={[styles.summaryValue, styles.summaryTotal]}>
            ₦{totalAmount.toLocaleString()}
          </Text>
        </View>

        {userBalance && (
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Balance After:</Text>
            <Text style={[
              styles.summaryValue, 
              styles.summaryBalance,
              (getBalanceAmount(userBalance) - totalAmount) < 0 ? styles.negativeBalance : {}
            ]}>
              ₦{Math.max(0, getBalanceAmount(userBalance) - totalAmount).toLocaleString()}
            </Text>
          </View>
        )}
      </View>

      <TouchableOpacity
        style={[styles.proceedBtn, (!hasEnoughBalance || authError) && styles.proceedDisabled]}
        disabled={!hasEnoughBalance || !!authError}
        onPress={() => setCurrentStep(3)}
      >
        <Text style={styles.proceedText}>
          {authError ? 'Please Login' : !hasEnoughBalance ? 'Insufficient Balance' : 'Enter PIN to Pay'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.proceedBtn, styles.backBtn]}
        onPress={() => setCurrentStep(1)}
      >
        <Text style={[styles.proceedText, styles.backBtnText]}>← Back</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  const renderPinStep = () => (
    <ScrollView style={styles.scrollContent}>
      {pinStatus?.isLocked && (
        <View style={styles.lockedCard}>
          <Text style={styles.lockedTitle}>🔒 Account Locked</Text>
          <Text style={styles.lockedText}>
            Too many failed PIN attempts. Please try again in {pinStatus.lockTimeRemaining} minutes.
          </Text>
          <TouchableOpacity 
            style={styles.refreshBtn}
            onPress={checkPinStatusAPI}
          >
            <Text style={styles.refreshText}>🔄 Check Status</Text>
          </TouchableOpacity>
        </View>
      )}

      {!pinStatus?.isPinSet && (
        <View style={styles.noPinCard}>
          <Text style={styles.noPinTitle}>PIN Required</Text>
          <Text style={styles.noPinText}>
            You need to set up a 4-digit transaction PIN in your account settings before making purchases.
          </Text>
        </View>
      )}

      {pinStatus?.isPinSet && !pinStatus?.isLocked && (
        <>
          <View style={styles.pinSummaryCard}>
            <Text style={styles.pinSummaryTitle}>Confirm Transaction</Text>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Network:</Text>
              <Text style={styles.summaryValue}>
                {networks.find((n) => n.id === selectedNetwork)?.label}
              </Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Type:</Text>
              <Text style={styles.summaryValue}>{cardType?.toUpperCase()}</Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Quantity:</Text>
              <Text style={styles.summaryValue}>{quantity} cards</Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Amount:</Text>
              <Text style={[styles.summaryValue, styles.summaryAmount]}>
                ₦{totalAmount.toLocaleString()}
              </Text>
            </View>
          </View>

          <View style={styles.pinCard}>
            <Text style={styles.pinTitle}>Enter Your 4-Digit PIN</Text>

            {pinStatus?.attemptsRemaining < 3 && (
              <Text style={styles.attemptsWarning}>
                Warning: {pinStatus.attemptsRemaining} attempts remaining
              </Text>
            )}

            <View style={styles.pinInputContainer}>
              <TextInput
                style={[styles.pinInput, pinError ? styles.pinInputError : {}]}
                value={pin}
                onChangeText={handlePinChange}
                keyboardType="numeric"
                secureTextEntry={true}
                placeholder="****"
                maxLength={4}
                autoFocus={true}
              />
            </View>

            {pinError ? (
              <Text style={styles.pinError}>{pinError}</Text>
            ) : (
              <Text style={styles.pinHelp}>
                Enter your 4-digit transaction PIN to generate recharge PINs
              </Text>
            )}

            <View style={styles.pinDotsContainer}>
              {[0, 1, 2, 3].map((index) => (
                <View
                  key={index}
                  style={[
                    styles.pinDot,
                    pin.length > index && styles.pinDotFilled,
                    pinError && styles.pinDotError
                  ]}
                />
              ))}
            </View>
          </View>

          <TouchableOpacity
            style={[
              styles.proceedBtn,
              (!isPinValid || isValidatingPin || isProcessing) && styles.proceedDisabled
            ]}
            disabled={!isPinValid || isValidatingPin || isProcessing}
            onPress={generateRechargePins}
          >
            {isValidatingPin || isProcessing ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={[styles.proceedText, { marginLeft: 8 }]}>
                  {isProcessing ? 'Generating PINs...' : 'Validating PIN...'}
                </Text>
              </View>
            ) : (
              <Text style={styles.proceedText}>
                Generate PINs • ₦{totalAmount.toLocaleString()}
              </Text>
            )}
          </TouchableOpacity>
        </>
      )}

      <TouchableOpacity
        style={[styles.proceedBtn, styles.backBtn]}
        onPress={() => setCurrentStep(2)}
        disabled={isValidatingPin || isProcessing}
      >
        <Text style={[styles.proceedText, styles.backBtnText]}>← Back to Summary</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  const renderSuccessStep = () => (
    <ScrollView style={styles.scrollContent}>
      <View style={styles.successCard}>
        <Text style={styles.successTitle}>✅ PINs Generated Successfully!</Text>
        
        <View style={styles.successSummary}>
          <Text style={styles.successSummaryText}>
            Network: {networks.find(n => n.id === selectedNetwork)?.label} • 
            {cardType?.toUpperCase()} • 
            {quantity} cards • 
            ₦{totalAmount.toLocaleString()}
          </Text>
        </View>

        <Text style={styles.pinsTitle}>Your Recharge PINs:</Text>
        
        {generatedPins.length > 0 ? (
          generatedPins.map((pinData, index) => (
            <View key={index} style={styles.generatedPinCard}>
              <Text style={styles.generatedPinLabel}>Card #{index + 1}</Text>
              <View style={styles.pinDataRow}>
                <Text style={styles.pinLabel}>PIN:</Text>
                <Text style={styles.pinValue}>{pinData.pin || 'N/A'}</Text>
              </View>
              <View style={styles.pinDataRow}>
                <Text style={styles.pinLabel}>Serial:</Text>
                <Text style={styles.serialValue}>{pinData.serial || 'N/A'}</Text>
              </View>
            </View>
          ))
        ) : (
          <View style={styles.noPinsCard}>
            <Text style={styles.noPinsText}>
              PINs were generated successfully but are not displayed here. 
              Please check the History tab to view your PINs.
            </Text>
            <TouchableOpacity
              style={styles.refreshBtn}
              onPress={() => {
                setActiveTab('history');
                setCurrentStep(1);
                setSelectedNetwork(null);
                setDenomination(null);
                setQuantity('1');
                setPin('');
                setPinError('');
                setGeneratedPins([]);
              }}
            >
              <Text style={styles.refreshText}>Go to History</Text>
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity
          style={styles.proceedBtn}
          onPress={() => {
            setCurrentStep(1);
            setSelectedNetwork(null);
            setDenomination(null);
            setQuantity('1');
            setPin('');
            setPinError('');
            setGeneratedPins([]);
            fetchUserBalance();
            if (activeTab === 'history') {
              loadTransactionHistory();
            }
          }}
        >
          <Text style={styles.proceedText}>Generate More PINs</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.proceedBtn, styles.historyBtn]}
          onPress={() => {
            setActiveTab('history');
            setCurrentStep(1);
            setSelectedNetwork(null);
            setDenomination(null);
            setQuantity('1');
            setPin('');
            setPinError('');
            setGeneratedPins([]);
          }}
        >
          <Text style={styles.proceedText}>View History</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  const renderHistoryTab = () => (
    <ScrollView 
      style={styles.scrollContent}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
        />
      }
    >
      {isLoading ? (
        <ActivityIndicator size="large" style={styles.loader} />
      ) : transactions.length > 0 ? (
        transactions.map((transaction) => (
          <View key={transaction._id} style={styles.transactionCard}>
            <View style={styles.transactionHeader}>
              <Text style={styles.transactionNetwork}>{transaction.network.toUpperCase()}</Text>
              <Text style={styles.transactionAmount}>₦{transaction.amount.toLocaleString()}</Text>
            </View>
            <Text style={styles.transactionType}>{transaction.type} PIN • {transaction.quantity} cards</Text>

            {transaction.pins.map((pinData, index) => (
              <View key={index} style={styles.pinContainer}>
                <Text style={styles.pinCode}>{pinData.pin}</Text>
                <Text style={styles.pinSerial}>Serial: {pinData.serial}</Text>
              </View>
            ))}

            <Text style={styles.transactionDate}>
              {new Date(transaction.createdAt).toLocaleDateString()} • Balance: ₦{transaction.balanceAfter.toLocaleString()}
            </Text>
          </View>
        ))
      ) : (
        <Text style={styles.noHistory}>No recharge PINs generated yet</Text>
      )}

      {authError && (
        <View style={styles.section}>
          <Text style={styles.pinError}>{authError}</Text>
        </View>
      )}
    </ScrollView>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>Recharge Card</Text>
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'generate' && styles.tabActive]}
          onPress={() => {
            setActiveTab('generate');
            setCurrentStep(1);
          }}
        >
          <Text style={[styles.tabText, activeTab === 'generate' && styles.tabTextActive]}>
            Generate PIN
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'history' && styles.tabActive]}
          onPress={() => setActiveTab('history')}
        >
          <Text style={[styles.tabText, activeTab === 'history' && styles.tabTextActive]}>
            History
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'generate' ? (
        currentStep === 1 ? renderGenerateTab() :
        currentStep === 2 ? renderSummaryStep() :
        currentStep === 3 ? renderPinStep() :
        renderSuccessStep()
      ) : (
        renderHistoryTab()
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  header: {
    backgroundColor: '#ff3b30',
    padding: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : 16,
    alignItems: 'center',
  },
  headerText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  tab: {
    flex: 1,
    padding: 16,
    alignItems: 'center',
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#ff3b30',
  },
  tabText: {
    color: '#666',
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#ff3b30',
    fontWeight: '600',
  },
  scrollContent: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  networkRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  networkCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  networkSelected: {
    borderColor: '#ff3b30',
    backgroundColor: '#fff5f5',
  },
  networkLogo: {
    width: 40,
    height: 40,
    resizeMode: 'contain',
    marginBottom: 4,
  },
  networkLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  cardTypeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  cardTypeBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  cardTypeSelected: {
    borderColor: '#ff3b30',
    backgroundColor: '#fff5f5',
  },
  cardTypeText: {
    color: '#666',
    fontWeight: '500',
  },
  cardTypeTextSelected: {
    color: '#ff3b30',
    fontWeight: '600',
  },
  denominationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  denominationBtn: {
    width: '30%',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  denominationSelected: {
    borderColor: '#ff3b30',
    backgroundColor: '#fff5f5',
  },
  denominationText: {
    color: '#666',
    fontWeight: '500',
  },
  denominationTextSelected: {
    color: '#ff3b30',
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  inputError: {
    borderColor: '#ff3b30',
    backgroundColor: '#fff5f5',
  },
  inputErrorText: {
    color: '#ff3b30',
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
  },
  totalAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ff3b30',
  },
  proceedBtn: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#ff3b30',
    alignItems: 'center',
    marginVertical: 8,
  },
  proceedDisabled: {
    backgroundColor: '#ccc',
  },
  proceedText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  backBtn: {
    backgroundColor: '#6c757d',
  },
  backBtnText: {
    color: '#fff',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  balanceCard: {
    padding: 20,
    borderRadius: 16,
    backgroundColor: '#fff',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    borderLeftWidth: 4,
    borderLeftColor: '#ff3b30',
  },
  balanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  balanceTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  refreshBtn: {
    padding: 4,
  },
  refreshText: {
    fontSize: 16,
    color: '#ff3b30',
  },
  totalBalance: {
    fontSize: 32,
    fontWeight: '700',
    color: '#28a745',
    textAlign: 'center',
    marginBottom: 16,
  },
  lastUpdated: {
    fontSize: 11,
    color: '#999',
    textAlign: 'center',
    marginTop: 8,
  },
  transactionPreview: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  previewLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  previewAmount: {
    fontSize: 16,
    fontWeight: '600',
  },
  sufficientPreview: {
    color: '#28a745',
  },
  insufficientPreview: {
    color: '#dc3545',
  },
  insufficientBalanceWarning: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#fff3cd',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ffeaa7',
  },
  warningText: {
    color: '#856404',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  loadingBalance: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  noBalanceText: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 12,
  },
  retryBtn: {
    backgroundColor: '#ff3b30',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  retryBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },

  summaryCard: {
    padding: 20,
    borderRadius: 16,
    backgroundColor: '#fff',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
    color: '#333',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  summaryLabel: {
    fontWeight: '600',
    color: '#666',
  },
  summaryValue: {
    fontWeight: '600',
    color: '#333',
  },
  summaryTotal: {
    fontSize: 18,
    color: '#ff3b30',
  },
  summaryBalance: {
    color: '#28a745',
  },
  negativeBalance: {
    color: '#dc3545',
  },
  summaryAmount: {
    fontSize: 16,
    color: '#ff3b30',
  },
  summaryDivider: {
    height: 1,
    backgroundColor: '#eee',
    marginVertical: 12,
  },

  pinCard: {
    padding: 24,
    borderRadius: 16,
    backgroundColor: '#fff',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    alignItems: 'center',
  },
  pinTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  pinInputContainer: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 16,
  },
  pinInput: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    letterSpacing: 8,
    borderWidth: 2,
    borderColor: '#ddd',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: '#f8f9fa',
    width: 150,
  },
  pinInputError: {
    borderColor: '#ff3b30',
    backgroundColor: '#fff5f5',
  },
  pinError: {
    color: '#ff3b30',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
    fontWeight: '500',
  },
  pinHelp: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  pinDotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 20,
  },
  pinDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#e0e0e0',
    borderWidth: 2,
    borderColor: '#ddd',
  },
  pinDotFilled: {
    backgroundColor: '#ff3b30',
    borderColor: '#ff3b30',
  },
  pinDotError: {
    backgroundColor: '#ff6b6b',
    borderColor: '#ff3b30',
  },

  pinSummaryCard: {
    padding: 20,
    borderRadius: 16,
    backgroundColor: '#fff',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    borderTopWidth: 4,
    borderTopColor: '#ff3b30',
  },
  pinSummaryTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },

  attemptsWarning: {
    color: '#ff8c00',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 16,
    backgroundColor: '#fff3cd',
    padding: 8,
    borderRadius: 8,
  },

  lockedCard: {
    padding: 20,
    borderRadius: 16,
    backgroundColor: '#fff',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    borderLeftWidth: 4,
    borderLeftColor: '#dc3545',
  },
  lockedTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#dc3545',
    textAlign: 'center',
    marginBottom: 12,
  },
  lockedText: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
  },

  noPinCard: {
    padding: 20,
    borderRadius: 16,
    backgroundColor: '#fff',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    borderLeftWidth: 4,
    borderLeftColor: '#ff8c00',
  },
  noPinTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ff8c00',
    textAlign: 'center',
    marginBottom: 12,
  },
  noPinText: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
  },

  // New success step styles
  successCard: {
    padding: 24,
    borderRadius: 16,
    backgroundColor: '#fff',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    borderLeftWidth: 4,
    borderLeftColor: '#28a745',
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#28a745',
    textAlign: 'center',
    marginBottom: 16,
  },
  successSummary: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  successSummaryText: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '500',
  },
  pinsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  generatedPinCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#ff3b30',
  },
  generatedPinLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  pinDataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  pinLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  pinValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ff3b30',
    letterSpacing: 2,
  },
  serialValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  historyBtn: {
    backgroundColor: '#6c757d',
  },
  noPinsCard: {
    backgroundColor: '#fff3cd',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#ff8c00',
    alignItems: 'center',
  },
  noPinsText: {
    color: '#856404',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 12,
    fontWeight: '500',
  },

  loader: {
    marginTop: 40,
  },
  noHistory: {
    textAlign: 'center',
    color: '#666',
    marginTop: 40,
    fontSize: 16,
  },
  transactionCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  transactionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  transactionNetwork: {
    fontWeight: 'bold',
    color: '#333',
  },
  transactionAmount: {
    fontWeight: 'bold',
    color: '#ff3b30',
  },
  transactionType: {
    color: '#666',
    marginBottom: 12,
  },
  pinContainer: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  pinCode: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  pinSerial: {
    color: '#666',
    fontSize: 12,
  },
  transactionDate: {
    color: '#999',
    fontSize: 12,
    marginTop: 8,
  },
});