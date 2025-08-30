import React, { useState, useEffect } from 'react';
import BetFundingSuccessModal from './BetFundingSuccessModal';

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

interface RecentBetting {
  customerId: string;
  provider: string;
  customerName?: string;
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

export default function FundBetting() {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [amount, setAmount] = useState('');
  const [pin, setPin] = useState('');
  const [contactsList, setContactsList] = useState<Contact[]>([]);
  const [recentBetting, setRecentBetting] = useState<RecentBetting[]>([]);
  const [userBalance, setUserBalance] = useState<UserBalance | null>(null);
  const [pinStatus, setPinStatus] = useState<PinStatus | null>(null);
  const [showContactsModal, setShowContactsModal] = useState(false);
  const [showRecentsModal, setShowRecentsModal] = useState(false);
  const [isLoadingContacts, setIsLoadingContacts] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [isValidatingPin, setIsValidatingPin] = useState(false);
  const [pinError, setPinError] = useState('');

  // Add these state variables with your other useState declarations
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successData, setSuccessData] = useState(null);

  // Quick amount presets
  const quickAmounts = [100, 200, 500, 1000, 2000, 5000, 10000, 20000];

  // ---------- Validation ----------
  const isCustomerIdValid = customerId.trim().length >= 3;
  const amountNum = parseInt(amount) || 0;
  const isAmountValid = amountNum >= 100 && amountNum <= 500000;
  const hasEnoughBalance = userBalance ? amountNum <= userBalance.total : true;
  const canProceed = isCustomerIdValid && isAmountValid && selectedProvider && hasEnoughBalance;
  const isPinValid = pin.length === 4 && /^\d{4}$/.test(pin);

  // Load data on mount
  useEffect(() => {
    loadRecentBetting();
    loadFormState();

    // Debug function to check stored tokens
    const debugTokenStorage = async () => {
      console.log('DEBUG: Checking token storage...');
      const tokenKeys = ['userToken', 'authToken', 'token', 'access_token'];

      for (const key of tokenKeys) {
        const value = await AsyncStorage.getItem(key);
        console.log(`${key}:`, value ? `"${value}"` : 'null');
      }
    };

    // Call debug function
    debugTokenStorage();

    // Add delay to ensure auth is ready
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
  }, [customerId, customerName, amount, selectedProvider]);

  // ---------- API Helper Functions ----------
  const getAuthToken = async () => {
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
  };

  const makeApiRequest = async (endpoint, options = {}) => {
    console.log(`API Request: ${endpoint}`);
    
    try {
      const token = await getAuthToken();
      console.log('Token obtained for API request');

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
      console.log('Request URL:', fullUrl);

      const response = await fetch(fullUrl, requestConfig);
      console.log('Response status:', response.status, response.ok ? 'OK' : 'ERROR');

      let responseText = '';
      try {
        responseText = await response.text();
      } catch (textError) {
        console.error('Failed to read response text:', textError);
        throw new Error('Unable to read server response');
      }

      let data = {};
      if (responseText.trim()) {
        try {
          data = JSON.parse(responseText);
          console.log('JSON parsed, success:', data.success);
        } catch (parseError) {
          console.error('JSON parse error:', parseError);
          throw new Error(`Invalid JSON response from server. Status: ${response.status}`);
        }
      }

      if (response.status === 401) {
        console.error('401 Unauthorized - clearing tokens');
        const tokenKeys = ['userToken', 'authToken', 'token', 'access_token'];
        for (const key of tokenKeys) {
          await AsyncStorage.removeItem(key);
        }
        throw new Error('Session expired. Please login again.');
      }

      if (!response.ok) {
        const errorMessage = data?.message || data?.error || `HTTP ${response.status}: ${response.statusText}`;
        console.error(`API Error:`, errorMessage);
        
        if (endpoint === '/purchase' && data && typeof data === 'object') {
          const error = new Error(errorMessage);
          (error as any).responseData = data;
          (error as any).httpStatus = response.status;
          throw error;
        }
        
        throw new Error(errorMessage);
      }

      console.log('API request successful');
      return data;

    } catch (error) {
      console.error(`API Error for ${endpoint}:`, error.message);

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
      console.log('Checking PIN status...');
      const response = await makeApiRequest('/purchase/pin-status');
      console.log('PIN status response:', JSON.stringify(response, null, 2));
      
      if (response.success) {
        setPinStatus(response);
      } else {
        console.log('PIN status check failed:', response);
      }
    } catch (error) {
      console.error('Error checking PIN status:', error);
    }
  };

  const fetchUserBalance = async () => {
    setIsLoadingBalance(true);
    try {
      console.log("Fetching balance from /balance");
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
        console.log("Balance fetched and stored:", realBalance);
      } else {
        throw new Error(balanceData.message || "Balance fetch failed");
      }
    } catch (error) {
      console.error("Balance fetch error:", error);
      
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
  };

  const saveFormState = async () => {
    try {
      const formState = { customerId, customerName, amount, selectedProvider };
      await AsyncStorage.setItem('bettingFormState', JSON.stringify(formState));
    } catch (error) {
      console.log('Error saving form state:', error);
    }
  };

  const loadFormState = async () => {
    try {
      const savedState = await AsyncStorage.getItem('bettingFormState');
      if (savedState) {
        const { customerId: savedId, customerName: savedName, amount: savedAmount, selectedProvider: savedProvider } = JSON.parse(savedState);
        setCustomerId(savedId || '');
        setCustomerName(savedName || '');
        setAmount(savedAmount || '');
        setSelectedProvider(savedProvider || null);
      }
    } catch (error) {
      console.log('Error loading form state:', error);
    }
  };

  const saveRecentBetting = async (customerId: string, provider: string, customerName?: string) => {
    try {
      const recent = await AsyncStorage.getItem('recentBetting');
      let recentList: RecentBetting[] = recent ? JSON.parse(recent) : [];

      recentList = recentList.filter(item => item.customerId !== customerId || item.provider !== provider);
      recentList.unshift({
        customerId,
        provider,
        customerName,
        timestamp: Date.now()
      });
      recentList = recentList.slice(0, 10);

      await AsyncStorage.setItem('recentBetting', JSON.stringify(recentList));
      setRecentBetting(recentList);
    } catch (error) {
      console.log('Error saving recent betting:', error);
    }
  };

  const loadRecentBetting = async () => {
    try {
      const recent = await AsyncStorage.getItem('recentBetting');
      if (recent) {
        setRecentBetting(JSON.parse(recent));
      }
    } catch (error) {
      console.log('Error loading recent betting:', error);
    }
  };

  // ---------- Betting Provider logos ----------
  const providers = [
    { id: 'bet9ja', label: 'BET9JA', logo: require('../assets/images/bet9ja.jpg') },
    { id: 'sportybet', label: 'SPORTYBET', logo: require('../assets/images/sportybet.png') },
    { id: 'nairabet', label: 'NAIRABET', logo: require('../assets/images/nairabet.png') },
    { id: 'betway', label: 'BETWAY', logo: require('../assets/images/betway.png') },
    { id: '1xbet', label: '1XBET', logo: require('../assets/images/1xbet.png') },
    { id: 'betking', label: 'BETKING', logo: require('../assets/images/betking.jpg') },
  ];

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

  const showRecentBettingList = () => {
    if (recentBetting.length > 0) {
      setShowRecentsModal(true);
    } else {
      Alert.alert('No recent betting', 'You haven\'t made any recent betting transactions.');
    }
  };

  const handleContactSelect = (number: string, name?: string) => {
    // For betting, we might use the contact name as customer name
    setCustomerName(name || '');
    setShowContactsModal(false);
    setShowRecentsModal(false);
  };

  const handleRecentSelect = (item: RecentBetting) => {
    setCustomerId(item.customerId);
    setCustomerName(item.customerName || '');
    setSelectedProvider(item.provider);
    setShowRecentsModal(false);
  };

  const handleQuickAmount = (quickAmount: number) => {
    setAmount(quickAmount.toString());
  };

  const validatePinAndPurchase = async () => {
    console.log('=== BETTING PAYMENT START ===');
    
    if (!isPinValid) {
      console.log('PIN invalid:', pin);
      setPinError('PIN must be exactly 4 digits');
      return;
    }

    console.log('Starting betting fund process...');
    setIsValidatingPin(true);
    setIsProcessingPayment(true);
    setPinError('');

    try {
      console.log('Betting fund payload:', {
        type: 'fund_betting',
        provider: selectedProvider,
        customerId: customerId,
        customerName: customerName,
        amount: amountNum,
        pinProvided: !!pin
      });

      const response = await makeApiRequest('/purchase', {
        method: 'POST',
        body: JSON.stringify({
          type: 'fund_betting',
          provider: selectedProvider,
          customerId: customerId,
          customerName: customerName,
          amount: amountNum,
          pin: pin,
        }),
      });

      console.log('Betting fund response:', response);

      if (response.success === true) {
        console.log('Betting fund successful!');
        
        // Save recent betting
        await saveRecentBetting(customerId, selectedProvider, customerName);
        
        // Update balance
        if (response.newBalance) {
          const balanceAmount = response.newBalance.totalBalance || 
                               response.newBalance.mainBalance || 
                               response.newBalance.amount || 0;
          
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
          console.log('Balance updated:', updatedBalance);
        }

        // Clear form
        await AsyncStorage.removeItem('bettingFormState');

        // Prepare success data
        const providerName = providers.find(p => p.id === selectedProvider)?.label || selectedProvider?.toUpperCase();
        setSuccessData({
          transaction: response.transaction || {},
          providerName,
          customerId,
          customerName,
          amount: response.transaction?.amount || amountNum,
          newBalance: response.newBalance
        });

        setTimeout(() => {
          setShowSuccessModal(true);
        }, 300);

      } else {
        console.log('Betting fund failed:', response.message);
        
        if (response.message && response.message.toLowerCase().includes('pin')) {
          setPinError(response.message);
        }
        
        Alert.alert('Transaction Failed', response.message || 'Payment could not be processed');
      }

    } catch (error) {
      console.error('Betting fund error:', error);
      
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
      console.log('=== BETTING PAYMENT END ===');
    }
  };

  // Add these handler functions

  const handlePlaceBet = () => {
    console.log('User selected: Place a Bet');
    setShowSuccessModal(false);
    setSuccessData(null);
    // Navigate to betting/place bet screen here
    // navigation.navigate('PlaceBet');
  };

  const handleCloseBettingModal = () => {
    console.log('User closed betting success modal');
    setShowSuccessModal(false);
    setSuccessData(null);
  };

  const handleFundMore = () => {
    console.log('User selected: Fund More');
    setShowSuccessModal(false);
    setSuccessData(null);

    // Reset form for new transaction
    setCurrentStep(1);
    setCustomerId('');
    setCustomerName('');
    setAmount('');
    setSelectedProvider(null);
    setPin('');
    setPinError('');
  };

  return (
    <View style={styles.container}>
      {/* Fixed Header */}
      <View style={styles.header}>
        <Text style={styles.headerText}>Fund Betting</Text>
      </View>

      {/* STEP 1: FORM */}
      {currentStep === 1 && (
        <ScrollView
          style={styles.scrollContent}
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Beneficiary Section */}
          <View style={styles.section}>
            <Text style={styles.label}>Quick Options</Text>
            <View style={styles.buttonRow}>
              <TouchableOpacity 
                style={[styles.actionBtn, { flex: 1, marginRight: 8 }]} 
                onPress={selectContact}
                disabled={isLoadingContacts}
              >
                {isLoadingContacts ? (
                  <ActivityIndicator size="small" color="#555" />
                ) : (
                  <Text style={styles.actionBtnText}>Contacts</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.actionBtn, { flex: 1, marginLeft: 8 }]} 
                onPress={showRecentBettingList}
              >
                <Text style={styles.actionBtnText}>Recent ({recentBetting.length})</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Betting Provider Selection */}
          <View style={styles.section}>
            <Text style={styles.label}>Select Betting Provider</Text>
            <View style={styles.providersContainer}>
              {providers.map((provider) => (
                <TouchableOpacity
                  key={provider.id}
                  style={[
                    styles.providerCard,
                    selectedProvider === provider.id && styles.providerSelected,
                  ]}
                  onPress={() => setSelectedProvider(provider.id)}
                >
                  <Image source={provider.logo} style={styles.providerLogo} />
                  <Text style={styles.providerLabel}>{provider.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Customer ID */}
          <View style={styles.section}>
            <Text style={styles.label}>Customer ID / Username</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your betting account ID/username"
              value={customerId}
              onChangeText={setCustomerId}
              autoCapitalize="none"
            />
            {customerId !== '' && !isCustomerIdValid && (
              <Text style={styles.error}>Customer ID must be at least 3 characters</Text>
            )}
            {customerId !== '' && isCustomerIdValid && (
              <Text style={styles.success}>Valid customer ID</Text>
            )}
          </View>

          {/* Customer Name (Optional) */}
          <View style={styles.section}>
            <Text style={styles.label}>Customer Name (Optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter customer name (optional)"
              value={customerName}
              onChangeText={setCustomerName}
            />
          </View>

          {/* Quick Amount Buttons */}
          <View style={styles.section}>
            <Text style={styles.label}>Quick Amount</Text>
            <View style={styles.quickAmountGrid}>
              {quickAmounts.map((quickAmount) => (
                <TouchableOpacity
                  key={quickAmount}
                  style={[
                    styles.quickAmountBtn,
                    amount === quickAmount.toString() && styles.quickAmountSelected
                  ]}
                  onPress={() => handleQuickAmount(quickAmount)}
                >
                  <Text style={[
                    styles.quickAmountText,
                    amount === quickAmount.toString() && styles.quickAmountSelectedText
                  ]}>
                    ₦{quickAmount.toLocaleString()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Custom Amount */}
          <View style={styles.section}>
            <Text style={styles.label}>Or Enter Custom Amount (₦)</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              placeholder="Enter amount (₦100 - ₦500,000)"
              value={amount}
              onChangeText={setAmount}
            />
            {amount !== '' && !isAmountValid && (
              <Text style={styles.error}>Amount must be between ₦100 and ₦500,000</Text>
            )}
            {amount !== '' && isAmountValid && hasEnoughBalance && (
              <Text style={styles.success}>Valid amount</Text>
            )}
            {amount !== '' && isAmountValid && !hasEnoughBalance && userBalance && (
              <Text style={styles.error}>
                Insufficient balance. Available: ₦{userBalance.total.toLocaleString()}
              </Text>
            )}
          </View>

          {/* Proceed Button */}
          <TouchableOpacity
            style={[styles.proceedBtn, !canProceed && styles.proceedDisabled]}
            disabled={!canProceed}
            onPress={() => setCurrentStep(2)}
          >
            <Text style={styles.proceedText}>
              Review Transaction {canProceed && `• ₦${amountNum.toLocaleString()}`}
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
                  <Text style={styles.refreshText}>Refresh</Text>
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

                {amountNum > 0 && (
                  <View style={styles.transactionPreview}>
                    <Text style={styles.previewLabel}>After transaction:</Text>
                    <Text style={[
                      styles.previewAmount,
                      (userBalance.total - amountNum) < 0 ? styles.insufficientPreview : styles.sufficientPreview
                    ]}>
                      ₦{Math.max(0, (userBalance.total || userBalance.amount || 0) - amountNum).toLocaleString()}
                    </Text>
                  </View>
                )}

                {amountNum > (userBalance.total || userBalance.amount || 0) && (
                  <View style={styles.insufficientBalanceWarning}>
                    <Text style={styles.warningText}>
                      Insufficient balance for this transaction
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
            <Text style={styles.summaryTitle}>Transaction Summary</Text>

            {/* Provider */}
            {selectedProvider && (
              <View style={styles.summaryRow}>
                <View style={styles.summaryLeft}>
                  <Image
                    source={providers.find((p) => p.id === selectedProvider)?.logo}
                    style={styles.summaryLogo}
                  />
                  <Text style={styles.summaryText}>
                    {providers.find((p) => p.id === selectedProvider)?.label} Funding
                  </Text>
                </View>
              </View>
            )}

            {/* Customer ID */}
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Customer ID:</Text>
              <Text style={styles.summaryValue}>{customerId}</Text>
            </View>

            {/* Customer Name */}
            {customerName && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Customer Name:</Text>
                <Text style={styles.summaryValue}>{customerName}</Text>
              </View>
            )}

            {/* Amount */}
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Amount:</Text>
              <Text style={[styles.summaryValue, styles.summaryAmount]}>
                ₦{amountNum.toLocaleString()}
              </Text>
            </View>

            <View style={styles.summaryDivider} />

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total:</Text>
              <Text style={[styles.summaryValue, styles.summaryTotal]}>
                ₦{amountNum.toLocaleString()}
              </Text>
            </View>

            {userBalance && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Balance After:</Text>
                <Text style={[
                  styles.summaryValue, 
                  styles.summaryBalance,
                  (userBalance.total - amountNum) < 0 ? styles.negativeBalance : {}
                ]}>
                  ₦{Math.max(0, userBalance.total - amountNum).toLocaleString()}
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
              {!hasEnoughBalance ? 'Insufficient Balance' : 'Enter PIN to Fund'}
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
              <Text style={styles.lockedTitle}>Account Locked</Text>
              <Text style={styles.lockedText}>
                Too many failed PIN attempts. Please try again in {pinStatus.lockTimeRemaining} minutes.
              </Text>
              <TouchableOpacity 
                style={styles.refreshBtn}
                onPress={checkPinStatus}
              >
                <Text style={styles.refreshText}>Check Status</Text>
              </TouchableOpacity>
            </View>
          )}

          {!pinStatus?.isPinSet && (
            <View style={styles.noPinCard}>
              <Text style={styles.noPinTitle}>PIN Required</Text>
              <Text style={styles.noPinText}>
                You need to set up a 4-digit transaction PIN in your account settings before making transactions.
              </Text>
            </View>
          )}

          {pinStatus?.isPinSet && !pinStatus?.isLocked && (
            <>
              {/* Transaction Summary */}
              <View style={styles.pinSummaryCard}>
                <Text style={styles.pinSummaryTitle}>Confirm Transaction</Text>

                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Provider:</Text>
                  <Text style={styles.summaryValue}>
                    {providers.find((p) => p.id === selectedProvider)?.label}
                  </Text>
                </View>

                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Customer ID:</Text>
                  <Text style={styles.summaryValue}>{customerId}</Text>
                </View>

                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Amount:</Text>
                  <Text style={[styles.summaryValue, styles.summaryAmount]}>
                    ₦{amountNum.toLocaleString()}
                  </Text>
                </View>
              </View>

              {/* PIN Entry */}
              <View style={styles.pinCard}>
                <Text style={styles.pinTitle}>Enter Your 4-Digit PIN</Text>

                {pinStatus?.attemptsRemaining < 3 && (
                  <Text style={styles.attemptsWarning}>
                    {pinStatus.attemptsRemaining} attempts remaining
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
                    Enter your 4-digit transaction PIN to complete this funding
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
                    Confirm Payment • ₦{amountNum.toLocaleString()}
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

      {/* Recent Betting Modal */}
      <Modal visible={showRecentsModal} animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Recent Betting</Text>
            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setShowRecentsModal(false)}
            >
              <Text style={styles.modalCloseBtnText}>✕</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={recentBetting}
            keyExtractor={(item) => item.customerId + item.provider + item.timestamp}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.contactItem}
                onPress={() => handleRecentSelect(item)}
              >
                <View style={styles.contactInfo}>
                  <Text style={styles.contactName}>
                    {item.customerName || 'Customer'}
                  </Text>
                  <Text style={styles.contactNumber}>
                    {item.customerId} • {providers.find(p => p.id === item.provider)?.label || item.provider.toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.recentTime}>
                  {new Date(item.timestamp).toLocaleDateString()}
                </Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <Text style={styles.emptyText}>No recent betting transactions found</Text>
            }
          />
        </View>
      </Modal>

      {/* Success Modal */}
      {showSuccessModal && successData && (
        <BetFundingSuccessModal
          visible={showSuccessModal}
          onClose={handleCloseBettingModal}
          onPlaceBet={handlePlaceBet}
          transaction={successData.transaction}
          betPlatform={successData.providerName}
          fundingMethod="Wallet"
          amount={successData.amount}
          newBalance={successData.newBalance?.totalBalance || successData.newBalance?.amount || 0}
          bonusAmount={0}
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

  providersContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  providerCard: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#fff',
    minHeight: 80,
    minWidth: '30%',
    maxWidth: '32%',
  },
  providerSelected: { 
    borderColor: '#ff3b30', 
    backgroundColor: '#fff5f5',
    borderWidth: 2 
  },
  providerLogo: { width: 40, height: 40, resizeMode: 'contain', marginBottom: 4 },
  providerLabel: { fontSize: 10, fontWeight: '600', color: '#666', textAlign: 'center' },

  quickAmountGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickAmountBtn: {
    borderWidth: 1,
    borderColor: '#ddd',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#fff',
    minWidth: 80,
  },
  quickAmountSelected: {
    backgroundColor: '#ff3b30',
    borderColor: '#ff3b30',
  },
  quickAmountText: {
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  quickAmountSelectedText: {
    color: '#fff',
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

  // Balance Card Styles
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

  // PIN Entry Styles
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

  emptyText: {
    textAlign: 'center',
    color: '#999',
    fontSize: 16,
    marginTop: 40,
  },
});