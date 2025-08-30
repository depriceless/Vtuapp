import React, { useState, useEffect } from 'react';
import internetsucessmodal from './internetsucessmodal';

import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  StyleSheet,
  ScrollView,
  Modal,
  FlatList,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import * as Contacts from 'expo-contacts';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Your Replit API base URL
const API_BASE_URL = 'http://localhost:5000/api';

interface Contact {
  id: string;
  name: string;
  phoneNumbers: { number: string }[];
}

interface RecentNumber {
  number: string;
  name?: string;
  timestamp: number;
}

interface UserBalance {
  main: number;
  bonus: number;
  total: number;
  lastUpdated: number;
}

interface PinStatus {
  isPinSet: boolean;
  hasPinSet: boolean;
  isLocked: boolean;
  lockTimeRemaining: number;
  attemptsRemaining: number;
}

interface InternetPlan {
  id: string;
  name: string;
  dataSize: string;
  speed: string;
  validity: string;
  amount: number;
  description?: string;
}

interface InternetProvider {
  id: string;
  label: string;
  logo: any;
  plans: InternetPlan[];
}

export default function BuyInternet() {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<InternetPlan | null>(null);
  const [customerNumber, setCustomerNumber] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [pin, setPin] = useState('');
  const [contactsList, setContactsList] = useState<Contact[]>([]);
  const [recentNumbers, setRecentNumbers] = useState<RecentNumber[]>([]);
  const [userBalance, setUserBalance] = useState<UserBalance | null>(null);
  const [pinStatus, setPinStatus] = useState<PinStatus | null>(null);
  const [showContactsModal, setShowContactsModal] = useState(false);
  const [showRecentsModal, setShowRecentsModal] = useState(false);
  const [showPlansModal, setShowPlansModal] = useState(false);
  const [isLoadingContacts, setIsLoadingContacts] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [isValidatingPin, setIsValidatingPin] = useState(false);
  const [pinError, setPinError] = useState('');

  // Success modal state
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successData, setSuccessData] = useState(null);

  // Internet Service Providers with their plans
 const internetProviders: InternetProvider[] = [
  {
    id: 'spectranet',
    label: 'SPECTRANET',
    logo: require('../assets/images/spectranet-logo.jpeg'),
    plans: [
      { id: 'spec_1gb_month', name: '1GB Monthly', dataSize: '1GB', speed: '10Mbps', validity: '30 days', amount: 2500 },
      { id: 'spec_5gb_month', name: '5GB Monthly', dataSize: '5GB', speed: '10Mbps', validity: '30 days', amount: 8000 },
      { id: 'spec_10gb_month', name: '10GB Monthly', dataSize: '10GB', speed: '20Mbps', validity: '30 days', amount: 15000 },
      { id: 'spec_20gb_month', name: '20GB Monthly', dataSize: '20GB', speed: '20Mbps', validity: '30 days', amount: 25000 },
      { id: 'spec_unlimited', name: 'Unlimited Weekly', dataSize: 'Unlimited', speed: '5Mbps', validity: '7 days', amount: 5000 },
    ]
  },
  {
    id: 'smile',
    label: 'SMILE',
    logo: require('../assets/images/smile-logo.jpeg'),
    plans: [
      { id: 'smile_2gb_month', name: '2GB Monthly', dataSize: '2GB', speed: '10Mbps', validity: '30 days', amount: 3000 },
      { id: 'smile_6gb_month', name: '6GB Monthly', dataSize: '6GB', speed: '10Mbps', validity: '30 days', amount: 8500 },
      { id: 'smile_12gb_month', name: '12GB Monthly', dataSize: '12GB', speed: '15Mbps', validity: '30 days', amount: 15500 },
      { id: 'smile_25gb_month', name: '25GB Monthly', dataSize: '25GB', speed: '20Mbps', validity: '30 days', amount: 28000 },
      { id: 'smile_unlimited_week', name: 'Unlimited Weekly', dataSize: 'Unlimited', speed: '8Mbps', validity: '7 days', amount: 4500 },
    ]
  },
];

    

  // ---------- Validation ----------
  const isCustomerNumberValid = customerNumber.length >= 6 && /^[A-Za-z0-9]+$/.test(customerNumber);
  const amount = selectedPlan?.amount || 0;
  const hasEnoughBalance = userBalance ? amount <= userBalance.total : true;
  const canProceed = isCustomerNumberValid && selectedProvider && selectedPlan && hasEnoughBalance;
  const isPinValid = pin.length === 4 && /^\d{4}$/.test(pin);

  // Load data on mount
  useEffect(() => {
    loadRecentNumbers();
    loadFormState();

    const debugTokenStorage = async () => {
      console.log('🐛 DEBUG: Checking token storage...');
      const tokenKeys = ['userToken', 'authToken', 'token', 'access_token'];

      for (const key of tokenKeys) {
        const value = await AsyncStorage.getItem(key);
        console.log(`🐛 ${key}:`, value ? `"${value}"` : 'null');
      }
    };

    debugTokenStorage();

    setTimeout(() => {
      fetchUserBalance();
      checkPinStatus();
    }, 2000);
  }, []);

  // Refresh balance when stepping to review page
  useEffect(() => {
    if (currentStep === 2) {
      fetchUserBalance();
    }
  }, [currentStep]);

  // Clear PIN when stepping to PIN entry
  useEffect(() => {
    if (currentStep === 3) {
      setPin('');
      setPinError('');
      checkPinStatus();
    }
  }, [currentStep]);

  // Save form state whenever it changes
  useEffect(() => {
    saveFormState();
  }, [customerNumber, selectedProvider, selectedPlan]);

  // ---------- API Helper Functions ----------
  const getAuthToken = async () => {
    try {
      const tokenKeys = ['userToken', 'authToken', 'token', 'access_token'];

      for (const key of tokenKeys) {
        const token = await AsyncStorage.getItem(key);
        console.log(`🔍 Checking storage key "${key}":`, token ? `Found (${token.length} chars)` : 'Not found');

        if (token && token.trim() !== '' && token !== 'undefined' && token !== 'null') {
          const cleanToken = token.trim();

          const tokenParts = cleanToken.split('.');
          if (tokenParts.length === 3) {
            console.log(`✅ Found valid JWT token with key: ${key}`);
            console.log(`🔑 Token preview: ${cleanToken.substring(0, 30)}...`);
            return cleanToken;
          } else {
            console.log(`⚠️ Token from "${key}" is not a valid JWT format (${tokenParts.length} parts)`);
          }
        }
      }

      console.log('❌ No valid JWT token found in any storage key');
      throw new Error('No authentication token found');
    } catch (error) {
      console.error('❌ Error getting auth token:', error);
      throw new Error('Authentication required');
    }
  };

  const makeApiRequest = async (endpoint, options = {}) => {
    console.log(`🔵 API Request: ${endpoint}`);
    
    try {
      const token = await getAuthToken();
      console.log('🔑 Token obtained for API request');

      const requestConfig = {
        method: 'GET',
        ...options,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...options.headers,
        },
      };

      const fullUrl = `${API_BASE_URL}${endpoint}`;
      console.log('🌐 Request URL:', fullUrl);
      console.log('📤 Method:', requestConfig.method);

      if (requestConfig.body) {
        console.log('📄 Request has body, length:', requestConfig.body.length);
      }

      const response = await fetch(fullUrl, requestConfig);
      console.log('📊 Response status:', response.status, response.ok ? '✅' : '❌');

      let responseText = '';
      try {
        responseText = await response.text();
      } catch (textError) {
        console.error('❌ Failed to read response text:', textError);
        throw new Error('Unable to read server response');
      }

      let data = {};
      if (responseText.trim()) {
        try {
          data = JSON.parse(responseText);
          console.log('✅ JSON parsed, success:', data.success);
        } catch (parseError) {
          console.error('❌ JSON parse error:', parseError);
          console.log('📄 Raw response preview:', responseText.substring(0, 200));
          throw new Error(`Invalid JSON response from server. Status: ${response.status}`);
        }
      } else {
        console.log('⚠️ Empty response received');
      }

      if (response.status === 401) {
        console.error('❌ 401 Unauthorized - clearing tokens');
        const tokenKeys = ['userToken', 'authToken', 'token', 'access_token'];
        for (const key of tokenKeys) {
          await AsyncStorage.removeItem(key);
        }
        throw new Error('Session expired. Please login again.');
      }

      if (!response.ok) {
        const errorMessage = data?.message || data?.error || `HTTP ${response.status}: ${response.statusText}`;
        console.error(`❌ API Error:`, errorMessage);
        
        if (endpoint === '/purchase' && data && typeof data === 'object') {
          const error = new Error(errorMessage);
          (error as any).responseData = data;
          (error as any).httpStatus = response.status;
          throw error;
        }
        
        throw new Error(errorMessage);
      }

      console.log('✅ API request successful');
      return data;

    } catch (error) {
      console.error(`💥 API Error for ${endpoint}:`, error.message);

      if (error.name === 'TypeError' && error.message.includes('Network request failed')) {
        throw new Error('Network connection failed. Please check your internet connection.');
      }

      if (error.message.includes('Authentication') || 
          error.message.includes('Session expired') ||
          error.responseData) {
        throw error;
      }

      throw new Error(error.message || 'Request failed');
    }
  };

  // ---------- PIN Functions ----------
  const checkPinStatus = async () => {
    try {
      console.log('🔄 Checking PIN status...');
      const token = await getAuthToken();
      console.log('🔑 Using token for PIN status:', token.substring(0, 30) + '...');
      
      const response = await makeApiRequest('/purchase/pin-status');
      console.log('✅ PIN status response:', JSON.stringify(response, null, 2));
      
      if (response.success) {
        setPinStatus(response);
      } else {
        console.log('⚠️ PIN status check failed:', response);
      }
    } catch (error) {
      console.error('❌ Error checking PIN status:', error);
    }
  };

  const fetchUserBalance = async () => {
    setIsLoadingBalance(true);
    try {
      console.log("🔄 Fetching balance from /balance");
      const balanceData = await makeApiRequest("/balance");

      if (balanceData.success && balanceData.balance) {
        const balanceAmount = parseFloat(balanceData.balance.amount) || 0;
        
        const realBalance = {
          main: balanceAmount,
          bonus: 0,
          total: balanceAmount,
          amount: balanceAmount,
          currency: balanceData.balance.currency || "NGN",
          lastUpdated: balanceData.balance.lastUpdated || new Date().toISOString(),
        };

        setUserBalance(realBalance);
        await AsyncStorage.setItem("userBalance", JSON.stringify(realBalance));
        console.log("✅ Balance fetched and stored:", realBalance);
      } else {
        throw new Error(balanceData.message || "Balance fetch failed");
      }
    } catch (error) {
      console.error("❌ Balance fetch error:", error);
      
      try {
        const cachedBalance = await AsyncStorage.getItem("userBalance");
        if (cachedBalance) {
          const parsedBalance = JSON.parse(cachedBalance);
          setUserBalance({
            ...parsedBalance,
            lastUpdated: parsedBalance.lastUpdated || new Date().toISOString(),
          });
          console.log("✅ Using cached balance:", parsedBalance);
        } else {
          setUserBalance(null);
        }
      } catch (cacheError) {
        console.error("❌ Cache error:", cacheError);
        setUserBalance(null);
      }
    } finally {
      setIsLoadingBalance(false);
    }
  };

  const saveFormState = async () => {
    try {
      const formState = { 
        customerNumber, 
        selectedProvider, 
        selectedPlan: selectedPlan ? {
          id: selectedPlan.id,
          name: selectedPlan.name,
          amount: selectedPlan.amount
        } : null 
      };
      await AsyncStorage.setItem('internetFormState', JSON.stringify(formState));
    } catch (error) {
      console.log('Error saving form state:', error);
    }
  };

  const loadFormState = async () => {
    try {
      const savedState = await AsyncStorage.getItem('internetFormState');
      if (savedState) {
        const { customerNumber: savedNumber, selectedProvider: savedProvider, selectedPlan: savedPlan } = JSON.parse(savedState);
        setCustomerNumber(savedNumber || '');
        setSelectedProvider(savedProvider || null);
        
        if (savedPlan && savedProvider) {
          const provider = internetProviders.find(p => p.id === savedProvider);
          const plan = provider?.plans.find(p => p.id === savedPlan.id);
          setSelectedPlan(plan || null);
        }
      }
    } catch (error) {
      console.log('Error loading form state:', error);
    }
  };

  const saveRecentNumber = async (number: string, name?: string) => {
    try {
      const recent = await AsyncStorage.getItem('recentInternetNumbers');
      let recentList: RecentNumber[] = recent ? JSON.parse(recent) : [];

      recentList = recentList.filter(item => item.number !== number);
      recentList.unshift({
        number,
        name,
        timestamp: Date.now()
      });
      recentList = recentList.slice(0, 10);

      await AsyncStorage.setItem('recentInternetNumbers', JSON.stringify(recentList));
      setRecentNumbers(recentList);
    } catch (error) {
      console.log('Error saving recent number:', error);
    }
  };

  const loadRecentNumbers = async () => {
    try {
      const recent = await AsyncStorage.getItem('recentInternetNumbers');
      if (recent) {
        setRecentNumbers(JSON.parse(recent));
      }
    } catch (error) {
      console.log('Error loading recent numbers:', error);
    }
  };

  // ---------- Contact Selection ----------
  const selectContact = async () => {
    setIsLoadingContacts(true);
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status === 'granted') {
        const { data } = await Contacts.getContactsAsync({
          fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Name],
          pageSize: 100,
          sort: Contacts.SortTypes.FirstName,
        });
        const validContacts = data.filter(
          c => c.phoneNumbers && c.phoneNumbers.length > 0
        );
        if (validContacts.length > 0) {
          setContactsList(validContacts);
          setShowContactsModal(true);
        } else {
          Alert.alert('No contacts', 'No contacts with phone numbers found.');
        }
      } else {
        Alert.alert('Permission denied', 'Cannot access contacts without permission.');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to load contacts. Please try again.');
    } finally {
      setIsLoadingContacts(false);
    }
  };

  const showRecentNumbers = () => {
    if (recentNumbers.length > 0) {
      setShowRecentsModal(true);
    } else {
      Alert.alert('No recent numbers', 'You haven\'t made any recent internet subscriptions.');
    }
  };

  const handleContactSelect = (number: string, name?: string) => {
    const cleaned = number.replace(/\D/g, '');
    let formattedNumber = '';

    if (cleaned.length === 10 && cleaned.startsWith('0')) {
      formattedNumber = cleaned;
    } else if (cleaned.length === 10) {
      formattedNumber = '0' + cleaned;
    } else if (cleaned.length === 11 && cleaned.startsWith('0')) {
      formattedNumber = cleaned;
    } else if (cleaned.length === 13 && cleaned.startsWith('234')) {
      formattedNumber = '0' + cleaned.substring(3);
    } else {
      // For internet, also accept alphanumeric customer IDs
      setCustomerNumber(number);
      setCustomerName(name || '');
      setShowContactsModal(false);
      setShowRecentsModal(false);
      return;
    }

    setCustomerNumber(formattedNumber);
    setCustomerName(name || '');
    setShowContactsModal(false);
    setShowRecentsModal(false);
  };

  const showPlanSelection = () => {
    if (!selectedProvider) {
      Alert.alert('Select Provider', 'Please select an internet provider first.');
      return;
    }
    setShowPlansModal(true);
  };

  const handlePlanSelect = (plan: InternetPlan) => {
    setSelectedPlan(plan);
    setShowPlansModal(false);
  };

  // ---------- Purchase Processing ----------
  const validatePinAndPurchase = async () => {
    console.log('=== INTERNET PAYMENT START ===');
    
    if (!isPinValid) {
      console.log('❌ PIN invalid:', pin);
      setPinError('PIN must be exactly 4 digits');
      return;
    }

    console.log('✅ Starting internet payment process...');
    setIsValidatingPin(true);
    setIsProcessingPayment(true);
    setPinError('');

    try {
      console.log('📦 Internet payment payload:', {
        type: 'internet',
        provider: selectedProvider,
        plan: selectedPlan?.name,
        planType: 'monthly', // Default to monthly
        customerNumber: customerNumber,
        amount: amount,
        pinProvided: !!pin
      });

      const response = await makeApiRequest('/purchase', {
        method: 'POST',
        body: JSON.stringify({
          type: 'internet',
          provider: selectedProvider,
          plan: selectedPlan?.name,
          planType: 'monthly',
          customerNumber: customerNumber,
          amount: amount,
          pin: pin,
        }),
      });

      console.log('📊 Internet purchase response:', response);

      if (response.success === true) {
        console.log('🎉 Internet payment successful!');
        
        await saveRecentNumber(customerNumber, customerName);
        
        if (response.newBalance) {
          const balanceAmount = response.newBalance.amount || 
                               response.newBalance.totalBalance || 
                               response.newBalance.mainBalance || 0;
          
          const updatedBalance = {
            main: balanceAmount,
            bonus: 0,
            total: balanceAmount,
            amount: balanceAmount,
            currency: response.newBalance.currency || "NGN",
            lastUpdated: response.newBalance.lastUpdated || new Date().toISOString(),
          };

          setUserBalance(updatedBalance);
          await AsyncStorage.setItem("userBalance", JSON.stringify(updatedBalance));
          console.log('💰 Balance updated:', updatedBalance);
        }

        await AsyncStorage.removeItem('internetFormState');

        const providerName = internetProviders.find(p => p.id === selectedProvider)?.label || selectedProvider?.toUpperCase();
        setSuccessData({
          transaction: response.transaction || {},
          providerName,
          customerNumber,
          plan: selectedPlan,
          amount: response.transaction?.amount || amount,
          newBalance: response.newBalance
        });

        setTimeout(() => {
          setShowSuccessModal(true);
        }, 300);

      } else {
        console.log('❌ Internet payment failed:', response.message);
        
        if (response.message && response.message.toLowerCase().includes('pin')) {
          setPinError(response.message);
        }
        
        Alert.alert('Transaction Failed', response.message || 'Payment could not be processed');
      }

    } catch (error) {
      console.error('💥 Internet payment error:', error);
      
      if (error.message.includes('locked') || error.message.includes('attempts')) {
        setPinError(error.message);
      } else if (error.message.includes('PIN')) {
        setPinError(error.message);
      } else {
        Alert.alert('Payment Error', error.message || 'Unable to process payment. Please try again.');
      }

    } finally {
      setIsValidatingPin(false);
      setIsProcessingPayment(false);
      console.log('=== INTERNET PAYMENT END ===');
    }
  };

  // Success modal handlers
  const handleCloseSuccessModal = () => {
    console.log('User closed success modal');
    setShowSuccessModal(false);
    setSuccessData(null);
  };

  const handleBuyMoreInternet = () => {
    console.log('User selected: Buy More Internet');
    setShowSuccessModal(false);
    setSuccessData(null);

    setCurrentStep(1);
    setCustomerNumber('');
    setCustomerName('');
    setSelectedProvider(null);
    setSelectedPlan(null);
    setPin('');
    setPinError('');
  };

  return (
    <View style={styles.container}>
      {/* Fixed Header */}
      <View style={styles.header}>
        <Text style={styles.headerText}>Internet Subscription</Text>
      </View>

      {/* STEP 1: FORM */}
      {currentStep === 1 && (
        <ScrollView
          style={styles.scrollContent}
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Recent Numbers Section */}
          <View style={styles.section}>
            <Text style={styles.label}>Quick Access</Text>
            <View style={styles.buttonRow}>
              <TouchableOpacity 
                style={[styles.actionBtn, { flex: 1, marginRight: 8 }]} 
                onPress={selectContact}
                disabled={isLoadingContacts}
              >
                {isLoadingContacts ? (
                  <ActivityIndicator size="small" color="#555" />
                ) : (
                  <Text style={styles.actionBtnText}>📞 Contacts</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.actionBtn, { flex: 1, marginLeft: 8 }]} 
                onPress={showRecentNumbers}
              >
                <Text style={styles.actionBtnText}>🕐 Recent ({recentNumbers.length})</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Provider Selection */}
          <View style={styles.section}>
            <Text style={styles.label}>Select Internet Provider</Text>
            <View style={styles.providerGrid}>
              {internetProviders.map((provider) => (
                <TouchableOpacity
                  key={provider.id}
                  style={[
                    styles.providerCard,
                    selectedProvider === provider.id && styles.providerSelected,
                  ]}
                  onPress={() => {
                    setSelectedProvider(provider.id);
                    setSelectedPlan(null); // Reset plan when provider changes
                  }}
                >
                  <Image source={provider.logo} style={styles.providerLogo} />
                  <Text style={styles.providerLabel}>{provider.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Plan Selection */}
          <View style={styles.section}>
            <Text style={styles.label}>Select Plan</Text>
            {selectedProvider ? (
              <TouchableOpacity
                style={[
                  styles.planSelector,
                  selectedPlan && styles.planSelected
                ]}
                onPress={showPlanSelection}
              >
                {selectedPlan ? (
                  <View style={styles.selectedPlanContent}>
                    <View style={styles.planMainInfo}>
                      <Text style={styles.planName}>{selectedPlan.name}</Text>
                      <Text style={styles.planPrice}>₦{selectedPlan.amount.toLocaleString()}</Text>
                    </View>
                    <View style={styles.planDetails}>
                      <Text style={styles.planDetail}>{selectedPlan.dataSize} • {selectedPlan.speed} • {selectedPlan.validity}</Text>
                    </View>
                  </View>
                ) : (
                  <Text style={styles.planSelectorText}>Tap to select a plan</Text>
                )}
                <Text style={styles.planSelectorArrow}>›</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.planDisabled}>
                <Text style={styles.planDisabledText}>Select a provider first</Text>
              </View>
            )}
          </View>

          {/* Customer Number */}
          <View style={styles.section}>
            <Text style={styles.label}>Customer ID / Phone Number</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter customer ID or phone number"
              value={customerNumber}
              onChangeText={setCustomerNumber}
              autoCapitalize="none"
            />
            {customerNumber !== '' && !isCustomerNumberValid && (
              <Text style={styles.error}>Enter valid customer ID or phone number (minimum 6 characters)</Text>
            )}
            {customerNumber !== '' && isCustomerNumberValid && (
              <Text style={styles.success}>✓ Valid customer identifier</Text>
            )}
          </View>

          {/* Customer Name (Optional) */}
          <View style={styles.section}>
            <Text style={styles.label}>Customer Name (Optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter customer name for reference"
              value={customerName}
              onChangeText={setCustomerName}
              autoCapitalize="words"
            />
          </View>

          {/* Proceed Button */}
          <TouchableOpacity
            style={[styles.proceedBtn, !canProceed && styles.proceedDisabled]}
            disabled={!canProceed}
            onPress={() => setCurrentStep(2)}
          >
            <Text style={styles.proceedText}>
              Review Purchase {canProceed && selectedPlan && `• ₦${selectedPlan.amount.toLocaleString()}`}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* STEP 2: REVIEW/SUMMARY */}
      {currentStep === 2 && (
        <ScrollView
          style={styles.scrollContent}
          contentContainerStyle={{ paddingBottom: 40 }}
        >
          {/* Balance Card */}
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
                  ₦{Number(userBalance.total || userBalance.amount || 0).toLocaleString()}
                </Text>

                <Text style={styles.lastUpdated}>
                  Last updated: {new Date(userBalance.lastUpdated || Date.now()).toLocaleTimeString()}
                </Text>

                {selectedPlan && (
                  <View style={styles.transactionPreview}>
                    <Text style={styles.previewLabel}>After purchase:</Text>
                    <Text style={[
                      styles.previewAmount,
                      (userBalance.total - selectedPlan.amount) < 0 ? styles.insufficientPreview : styles.sufficientPreview
                    ]}>
                      ₦{Math.max(0, (userBalance.total || userBalance.amount || 0) - selectedPlan.amount).toLocaleString()}
                    </Text>
                  </View>
                )}

                {selectedPlan && selectedPlan.amount > (userBalance.total || userBalance.amount || 0) && (
                  <View style={styles.insufficientBalanceWarning}>
                    <Text style={styles.warningText}>
                      ⚠️ Insufficient balance for this transaction
                    </Text>
                    <TouchableOpacity 
                      style={styles.topUpBtn}
                      onPress={() => {/* Navigate to top-up */}}
                    >
                      <Text style={styles.topUpBtnText}>Top Up Wallet</Text>
                    </TouchableOpacity>
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
        
          {/* Summary Card */}
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Purchase Summary</Text>

            {/* Provider */}
            {selectedProvider && (
              <View style={styles.summaryRow}>
                <View style={styles.summaryLeft}>
                  <Image
                    source={internetProviders.find((p) => p.id === selectedProvider)?.logo}
                    style={styles.summaryLogo}
                  />
                  <Text style={styles.summaryText}>
                    {internetProviders.find((p) => p.id === selectedProvider)?.label} Internet
                  </Text>
                </View>
              </View>
            )}

            {/* Plan Details */}
            {selectedPlan && (
              <>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Plan:</Text>
                  <Text style={styles.summaryValue}>{selectedPlan.name}</Text>
                </View>

                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Data Size:</Text>
                  <Text style={styles.summaryValue}>{selectedPlan.dataSize}</Text>
                </View>

                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Speed:</Text>
                  <Text style={styles.summaryValue}>{selectedPlan.speed}</Text>
                </View>

                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Validity:</Text>
                  <Text style={styles.summaryValue}>{selectedPlan.validity}</Text>
                </View>
              </>
            )}

            {/* Customer Details */}
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Customer ID:</Text>
              <Text style={styles.summaryValue}>{customerNumber}</Text>
            </View>

            {customerName && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Customer Name:</Text>
                <Text style={styles.summaryValue}>{customerName}</Text>
              </View>
            )}

            <View style={styles.summaryDivider} />

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total:</Text>
              <Text style={[styles.summaryValue, styles.summaryTotal]}>
                ₦{selectedPlan?.amount.toLocaleString()}
              </Text>
            </View>

            {userBalance && selectedPlan && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Balance After:</Text>
                <Text style={[
                  styles.summaryValue, 
                  styles.summaryBalance,
                  (userBalance.total - selectedPlan.amount) < 0 ? styles.negativeBalance : {}
                ]}>
                  ₦{Math.max(0, userBalance.total - selectedPlan.amount).toLocaleString()}
                </Text>
              </View>
            )}
          </View>

          {/* Proceed to PIN Button */}
          <TouchableOpacity
            style={[
              styles.proceedBtn, 
              !hasEnoughBalance && styles.proceedDisabled
            ]}
            disabled={!hasEnoughBalance}
            onPress={() => setCurrentStep(3)}
          >
            <Text style={styles.proceedText}>
              {!hasEnoughBalance ? 'Insufficient Balance' : 'Enter PIN to Pay'}
            </Text>
          </TouchableOpacity>

          {/* Back Button */}
          <TouchableOpacity
            style={[styles.proceedBtn, styles.backBtn]}
            onPress={() => setCurrentStep(1)}
          >
            <Text style={[styles.proceedText, styles.backBtnText]}>← Edit Details</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* STEP 3: PIN ENTRY */}
      {currentStep === 3 && (
        <ScrollView
          style={styles.scrollContent}
          contentContainerStyle={{ paddingBottom: 40 }}
        >
          {/* PIN Status Check */}
          {pinStatus?.isLocked && (
            <View style={styles.lockedCard}>
              <Text style={styles.lockedTitle}>🔒 Account Locked</Text>
              <Text style={styles.lockedText}>
                Too many failed PIN attempts. Please try again in {pinStatus.lockTimeRemaining} minutes.
              </Text>
              <TouchableOpacity 
                style={styles.refreshBtn}
                onPress={checkPinStatus}
              >
                <Text style={styles.refreshText}>🔄 Check Status</Text>
              </TouchableOpacity>
            </View>
          )}

          {!pinStatus?.isPinSet && (
            <View style={styles.noPinCard}>
              <Text style={styles.noPinTitle}>📱 PIN Required</Text>
              <Text style={styles.noPinText}>
                You need to set up a 4-digit transaction PIN in your account settings before making purchases.
              </Text>
            </View>
          )}

          {pinStatus?.isPinSet && !pinStatus?.isLocked && (
            <>
              {/* Transaction Summary */}
              <View style={styles.pinSummaryCard}>
                <Text style={styles.pinSummaryTitle}>Confirm Internet Subscription</Text>

                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Provider:</Text>
                  <Text style={styles.summaryValue}>
                    {internetProviders.find((p) => p.id === selectedProvider)?.label}
                  </Text>
                </View>

                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Plan:</Text>
                  <Text style={styles.summaryValue}>{selectedPlan?.name}</Text>
                </View>

                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Customer ID:</Text>
                  <Text style={styles.summaryValue}>{customerNumber}</Text>
                </View>

                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Amount:</Text>
                  <Text style={[styles.summaryValue, styles.summaryAmount]}>
                    ₦{selectedPlan?.amount.toLocaleString()}
                  </Text>
                </View>
              </View>

              {/* PIN Entry */}
              <View style={styles.pinCard}>
                <Text style={styles.pinTitle}>Enter Your 4-Digit PIN</Text>

                {pinStatus?.attemptsRemaining < 3 && (
                  <Text style={styles.attemptsWarning}>
                    ⚠️ {pinStatus.attemptsRemaining} attempts remaining
                  </Text>
                )}

                <View style={styles.pinInputContainer}>
                  <TextInput
                    style={[styles.pinInput, pinError ? styles.pinInputError : {}]}
                    value={pin}
                    onChangeText={(text) => {
                      setPin(text.replace(/\D/g, '').substring(0, 4));
                      setPinError('');
                    }}
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
                    Enter your 4-digit transaction PIN to complete this purchase
                  </Text>
                )}

                {/* PIN Dots Display */}
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

              {/* Confirm Payment Button */}
              <TouchableOpacity
                style={[
                  styles.proceedBtn,
                  (!isPinValid || isValidatingPin || isProcessingPayment) && styles.proceedDisabled
                ]}
                disabled={!isPinValid || isValidatingPin || isProcessingPayment}
                onPress={validatePinAndPurchase}
              >
                {isValidatingPin || isProcessingPayment ? (
                  <View style={styles.loadingRow}>
                    <ActivityIndicator size="small" color="#fff" />
                    <Text style={[styles.proceedText, { marginLeft: 8 }]}>
                      {isProcessingPayment ? 'Processing Payment...' : 'Validating PIN...'}
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.proceedText}>
                    Confirm Payment • ₦{selectedPlan?.amount.toLocaleString()}
                  </Text>
                )}
              </TouchableOpacity>
            </>
          )}

          {/* Back Button */}
          <TouchableOpacity
            style={[styles.proceedBtn, styles.backBtn]}
            onPress={() => setCurrentStep(2)}
            disabled={isValidatingPin || isProcessingPayment}
          >
            <Text style={[styles.proceedText, styles.backBtnText]}>← Back to Summary</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* Contacts Modal */}
      <Modal visible={showContactsModal} animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Contact</Text>
            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setShowContactsModal(false)}
            >
              <Text style={styles.modalCloseBtnText}>✕</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={contactsList}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.contactItem}
                onPress={() => handleContactSelect(item.phoneNumbers[0].number, item.name)}
              >
                <View style={styles.contactInfo}>
                  <Text style={styles.contactName}>{item.name}</Text>
                  <Text style={styles.contactNumber}>{item.phoneNumbers[0].number}</Text>
                </View>
              </TouchableOpacity>
            )}
          />
        </View>
      </Modal>

      {/* Recent Numbers Modal */}
      <Modal visible={showRecentsModal} animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Recent Customers</Text>
            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setShowRecentsModal(false)}
            >
              <Text style={styles.modalCloseBtnText}>✕</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={recentNumbers}
            keyExtractor={(item) => item.number + item.timestamp}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.contactItem}
                onPress={() => handleContactSelect(item.number, item.name)}
              >
                <View style={styles.contactInfo}>
                  <Text style={styles.contactName}>
                    {item.name || 'Unknown'}
                  </Text>
                  <Text style={styles.contactNumber}>{item.number}</Text>
                </View>
                <Text style={styles.recentTime}>
                  {new Date(item.timestamp).toLocaleDateString()}
                </Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <Text style={styles.emptyText}>No recent customers found</Text>
            }
          />
        </View>
      </Modal>

      {/* Plans Modal */}
      <Modal visible={showPlansModal} animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {selectedProvider && internetProviders.find(p => p.id === selectedProvider)?.label} Plans
            </Text>
            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setShowPlansModal(false)}
            >
              <Text style={styles.modalCloseBtnText}>✕</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={selectedProvider ? internetProviders.find(p => p.id === selectedProvider)?.plans || [] : []}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.planItem,
                  selectedPlan?.id === item.id && styles.planItemSelected
                ]}
                onPress={() => handlePlanSelect(item)}
              >
                <View style={styles.planItemContent}>
                  <View style={styles.planHeader}>
                    <Text style={styles.planItemName}>{item.name}</Text>
                    <Text style={styles.planItemPrice}>₦{item.amount.toLocaleString()}</Text>
                  </View>
                  <View style={styles.planItemDetails}>
                    <Text style={styles.planItemDetail}>📊 {item.dataSize}</Text>
                    <Text style={styles.planItemDetail}>⚡ {item.speed}</Text>
                    <Text style={styles.planItemDetail}>📅 {item.validity}</Text>
                  </View>
                  {item.description && (
                    <Text style={styles.planItemDescription}>{item.description}</Text>
                  )}
                </View>
              </TouchableOpacity>
            )}
            showsVerticalScrollIndicator={false}
          />
        </View>
      </Modal>

      {/* Success Modal */}
      {showSuccessModal && successData && (
        <SuccessModal
          visible={showSuccessModal}
          onClose={handleCloseSuccessModal}
          onBuyMore={handleBuyMoreInternet}
          transaction={successData.transaction}
          networkName={successData.providerName}
          phone={successData.customerNumber}
          amount={successData.amount}
          newBalance={successData.newBalance}
          serviceType="internet"
          planDetails={successData.plan}
        />
      )}
    </View>
  );
}

// ---------- Styles ----------
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },

  header: {
    backgroundColor: '#ff3b30',
    paddingVertical: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : 16,
    alignItems: 'center',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  headerText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },

  scrollContent: { 
    marginTop: Platform.OS === 'ios' ? 90 : 60,
    flex: 1 
  },

  section: { margin: 16, marginBottom: 24 },
  label: { 
    fontSize: 16, 
    fontWeight: '600', 
    marginBottom: 8, 
    color: '#333' 
  },

  buttonRow: { flexDirection: 'row' },
  actionBtn: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  actionBtnText: { color: '#555', fontSize: 14, fontWeight: '500' },

  // Provider Grid Styles
  providerGrid: { 
    flexDirection: 'row', 
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8
  },
  providerCard: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    width: '48%',
    backgroundColor: '#fff',
    minHeight: 80,
  },
  providerSelected: { 
    borderColor: '#ff3b30', 
    backgroundColor: '#fff5f5',
    borderWidth: 2 
  },
  providerLogo: { width: 40, height: 40, resizeMode: 'contain', marginBottom: 4 },
  providerLabel: { fontSize: 10, fontWeight: '600', color: '#666', textAlign: 'center' },

  // Plan Selection Styles
  planSelector: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 16,
    backgroundColor: '#fff',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  planSelected: {
    borderColor: '#ff3b30',
    backgroundColor: '#fff5f5',
    borderWidth: 2,
  },
  planSelectorText: {
    color: '#666',
    fontSize: 16,
  },
  planSelectorArrow: {
    color: '#999',
    fontSize: 18,
    fontWeight: 'bold',
  },
  planDisabled: {
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 12,
    padding: 16,
    backgroundColor: '#f8f9fa',
  },
  planDisabledText: {
    color: '#999',
    fontSize: 16,
    textAlign: 'center',
  },
  selectedPlanContent: {
    flex: 1,
  },
  planMainInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  planName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  planPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ff3b30',
  },
  planDetails: {
    marginTop: 4,
  },
  planDetail: {
    fontSize: 12,
    color: '#666',
  },

  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  error: { 
    color: '#ff3b30', 
    fontSize: 12, 
    marginTop: 6,
    fontWeight: '500' 
  },
  success: {
    color: '#28a745',
    fontSize: 12,
    marginTop: 6,
    fontWeight: '500'
  },

  proceedBtn: {
    margin: 16,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#ff3b30',
    alignItems: 'center',
    shadowColor: '#ff3b30',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  proceedDisabled: { 
    backgroundColor: '#ccc',
    shadowOpacity: 0,
    elevation: 0,
  },
  proceedText: { 
    color: '#fff', 
    fontSize: 16, 
    fontWeight: '600' 
  },

  backBtn: {
    backgroundColor: '#6c757d',
    marginTop: 8,
    shadowColor: '#6c757d',
  },
  backBtnText: {
    color: '#fff',
  },

  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  summaryCard: {
    margin: 16,
    padding: 20,
    borderRadius: 16,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  summaryTitle: { 
    fontSize: 18, 
    fontWeight: '700', 
    marginBottom: 16, 
    textAlign: 'center',
    color: '#333' 
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  summaryLogo: { 
    width: 30, 
    height: 30, 
    resizeMode: 'contain', 
    marginRight: 8 
  },
  summaryLabel: { 
    fontWeight: '600', 
    fontSize: 14, 
    color: '#666',
    flex: 1,
  },
  summaryText: { fontSize: 14, color: '#333', fontWeight: '500' },
  summaryValue: { 
    fontSize: 14, 
    color: '#333', 
    fontWeight: '600',
    textAlign: 'right',
    maxWidth: '60%',
  },
  summaryAmount: { fontSize: 16, color: '#ff3b30' },
  summaryDivider: {
    height: 1,
    backgroundColor: '#eee',
    marginVertical: 12,
  },
  summaryTotal: {
    fontSize: 18,
    color: '#ff3b30',
    fontWeight: '700',
  },

  // Balance Card Styles (same as airtime)
  balanceCard: {
    margin: 16,
    padding: 20,
    borderRadius: 16,
    backgroundColor: '#fff',
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
    marginBottom: 8,
  },
  topUpBtn: {
    backgroundColor: '#ff3b30',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignSelf: 'center',
  },
  topUpBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
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
  summaryBalance: {
    fontSize: 16,
    fontWeight: '600',
    color: '#28a745',
  },
  negativeBalance: {
    color: '#dc3545',
  },

  // PIN Entry Styles (same as airtime)
  pinCard: {
    margin: 16,
    padding: 24,
    borderRadius: 16,
    backgroundColor: '#fff',
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
    margin: 16,
    padding: 20,
    borderRadius: 16,
    backgroundColor: '#fff',
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

  // Account Locked Styles
  lockedCard: {
    margin: 16,
    padding: 20,
    borderRadius: 16,
    backgroundColor: '#fff',
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

  // No PIN Set Styles
  noPinCard: {
    margin: 16,
    padding: 20,
    borderRadius: 16,
    backgroundColor: '#fff',
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

  // Modal Styles
  modalContainer: { 
    flex: 1, 
    backgroundColor: '#fff',
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: { 
    fontSize: 18, 
    fontWeight: 'bold', 
    color: '#333' 
  },
  modalCloseBtn: {
    padding: 8,
  },
  modalCloseBtnText: {
    fontSize: 18,
    color: '#666',
    fontWeight: 'bold',
  },

  contactItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  contactInfo: {
    flex: 1,
  },
  contactName: { 
    fontSize: 16, 
    fontWeight: '500', 
    color: '#333',
    marginBottom: 2,
  },
  contactNumber: { 
    color: '#666', 
    fontSize: 14 
  },
  recentTime: {
    fontSize: 12,
    color: '#999',
  },

  // Plan Item Styles
  planItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: '#fff',
  },
  planItemSelected: {
    backgroundColor: '#fff5f5',
    borderLeftWidth: 4,
    borderLeftColor: '#ff3b30',
  },
  planItemContent: {
    flex: 1,
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  planItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  planItemPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ff3b30',
  },
  planItemDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 4,
  },
  planItemDetail: {
    fontSize: 12,
    color: '#666',
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  planItemDescription: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
    fontStyle: 'italic',
  },

  emptyText: {
    textAlign: 'center',
    color: '#999',
    fontSize: 16,
    marginTop: 40,
  },
});