import React, { useState, useEffect } from 'react';
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
import CableTVSuccessModal from './CableTVSuccessModal';

// API Configuration
const API_BASE_URL = 'http://localhost:5000/api';

// Interfaces
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

interface CablePackage {
  id: string;
  name: string;
  amount: number;
  duration: string;
  operator: string;
  description?: string;
}

export default function BuyCableTV() {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [selectedOperator, setSelectedOperator] = useState<string | null>(null);
  const [selectedPackage, setSelectedPackage] = useState<CablePackage | null>(null);
  const [smartCardNumber, setSmartCardNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [contactsList, setContactsList] = useState<Contact[]>([]);
  const [recentNumbers, setRecentNumbers] = useState<RecentNumber[]>([]);
  const [userBalance, setUserBalance] = useState<UserBalance | null>(null);
  const [pinStatus, setPinStatus] = useState<PinStatus | null>(null);
  const [showContactsModal, setShowContactsModal] = useState(false);
  const [showRecentsModal, setShowRecentsModal] = useState(false);
  const [showPackageModal, setShowPackageModal] = useState(false);
  const [isLoadingContacts, setIsLoadingContacts] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [isValidatingPin, setIsValidatingPin] = useState(false);
  const [isValidatingCard, setIsValidatingCard] = useState(false);
  const [pinError, setPinError] = useState('');
  const [cardError, setCardError] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successData, setSuccessData] = useState(null);
  const [cablePackages, setCablePackages] = useState<CablePackage[]>([]);
  const [isLoadingPackages, setIsLoadingPackages] = useState(false);
  const [customerName, setCustomerName] = useState('');

  // Cable TV Operators
  const operators = [
    { 
      id: 'dstv', 
      label: 'DStv', 
      logo: require('../assets/images/DStv.png'),
      color: '#0066cc'
    },
    { 
      id: 'gotv', 
      label: 'GOtv', 
      logo: require('../assets/images/gotv.jpg'),
      color: '#00b04f'
    },
    { 
      id: 'startime', 
      label: 'StarTimes', 
      logo: require('../assets/images/startime.png'),
      color: '#ff6b35'
    },
    { 
      id: 'showmax', 
      label: 'Showmax', 
      logo: require('../assets/images/showmax.png'),
      color: '#e50914'
    },
  ];

  // Validation
  const isPhoneValid = phone.length === 11 && /^0[789][01]\d{8}$/.test(phone);
  const isSmartCardValid = smartCardNumber.length >= 10 && /^\d+$/.test(smartCardNumber);
  const hasEnoughBalance = userBalance && selectedPackage ? selectedPackage.amount <= userBalance.total : true;
  const canProceed = isPhoneValid && selectedOperator && selectedPackage && isSmartCardValid && hasEnoughBalance && customerName.trim() !== '';
  const isPinValid = pin.length === 4 && /^\d{4}$/.test(pin);

  // Load packages when operator changes
  useEffect(() => {
    if (selectedOperator) {
      fetchCablePackages(selectedOperator);
    } else {
      setCablePackages([]);
      setSelectedPackage(null);
    }
  }, [selectedOperator]);

  // Load data on mount
  useEffect(() => {
    loadRecentNumbers();
    loadFormState();

    // Debug function to check stored tokens (same as airtime)
    const debugTokenStorage = async () => {
      console.log('🐛 DEBUG: Checking token storage...');
      const tokenKeys = ['userToken', 'authToken', 'token', 'access_token'];

      for (const key of tokenKeys) {
        const value = await AsyncStorage.getItem(key);
        console.log(`🐛 ${key}:`, value ? `"${value}"` : 'null');
      }
    };

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
  }, [phone, selectedOperator, selectedPackage, smartCardNumber]);

  // ========== UNIFIED API FUNCTIONS (same as airtime) ==========
  
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

      // Handle authentication errors
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

  // ========== BALANCE FUNCTIONS (same as airtime) ==========
  
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

  // ========== PIN FUNCTIONS (same as airtime) ==========
  
  const checkPinStatus = async () => {
    try {
      console.log('🔄 Checking PIN status...');
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



// ========== FORM STATE MANAGEMENT ==========
  
  const loadFormState = async () => {
    try {
      const savedState = await AsyncStorage.getItem('cableTvFormState');
      if (savedState) {
        const formData = JSON.parse(savedState);
        
        if (formData.phone) setPhone(formData.phone);
        if (formData.selectedOperator) setSelectedOperator(formData.selectedOperator);
        if (formData.smartCardNumber) setSmartCardNumber(formData.smartCardNumber);
        if (formData.selectedPackage) setSelectedPackage(formData.selectedPackage);
        if (formData.customerName) setCustomerName(formData.customerName);
        
        console.log('✅ Form state loaded from storage');
      }
    } catch (error) {
      console.error('❌ Error loading form state:', error);
    }
  };

  const saveFormState = async () => {
    try {
      const formData = {
        phone,
        selectedOperator,
        selectedPackage,
        smartCardNumber,
        customerName,
        timestamp: Date.now()
      };
      
      await AsyncStorage.setItem('cableTvFormState', JSON.stringify(formData));
    } catch (error) {
      console.error('❌ Error saving form state:', error);
    }
  };

  const saveRecentNumber = async (phoneNumber: string, name?: string) => {
    try {
      const recent = await AsyncStorage.getItem('recentNumbers');
      let recentList: RecentNumber[] = recent ? JSON.parse(recent) : [];
      
      // Remove if already exists
      recentList = recentList.filter(item => item.number !== phoneNumber);
      
      // Add to beginning
      recentList.unshift({
        number: phoneNumber,
        name,
        timestamp: Date.now()
      });
      
      // Keep only last 10
      recentList = recentList.slice(0, 10);
      
      await AsyncStorage.setItem('recentNumbers', JSON.stringify(recentList));
      setRecentNumbers(recentList);
      
      console.log('✅ Recent number saved');
    } catch (error) {
      console.error('❌ Error saving recent number:', error);
    }
  };


  // ========== CABLE TV SPECIFIC FUNCTIONS ==========
  

  const fetchCablePackages = async (operator: string) => {
  setIsLoadingPackages(true);
  setCablePackages([]);
  setSelectedPackage(null);
  
  try {
    console.log(`Fetching cable packages for: ${operator}`);
    const response = await makeApiRequest(`/cable/packages/${operator}`);

    if (response.success && response.data) {
      const packages = response.data.map(pkg => ({
        id: pkg.variation_id || pkg.id,
        name: pkg.name || pkg.package_name,
        amount: parseFloat(pkg.amount || pkg.price),
        duration: pkg.duration || '30 days',
        operator: operator,
        description: pkg.description || pkg.details
      }));

      setCablePackages(packages);
      console.log(`Loaded ${packages.length} packages for ${operator}`);
    } else {
      throw new Error(response.message || 'Failed to fetch cable packages');
    }
  } catch (error) {
    console.error('Error fetching cable packages:', error);
    setCablePackages([]);
    
    if (error.message.includes('login again')) {
      Alert.alert('Session Expired', 'Please login again to continue.');
    } else if (error.message.includes('Network')) {
      Alert.alert('Network Error', 'Please check your connection and try again.');
    } else {
      Alert.alert('Error', `Failed to load ${operator.toUpperCase()} packages. Please try again.`);
    }
  } finally {
    setIsLoadingPackages(false);
  }
};

  // Smart Card Validation
   const validateSmartCard = async () => {
    if (!isSmartCardValid) {
      setCardError('Smart card number must be at least 10 digits');
      return;
    }

    if (!selectedOperator) {
      setCardError('Please select an operator first');
      return;
    }

    setIsValidatingCard(true);
    setCardError('');
    setCustomerName('');

    try {
      console.log('🔄 Validating smart card...');
      const response = await makeApiRequest('/cable/validate-smartcard', {
        method: 'POST',
        body: JSON.stringify({ 
          smartCardNumber, 
          operator: selectedOperator 
        }),
      });

      if (response && response.success) {
        setCustomerName(response.customerName || 'Verified Customer');
        console.log('✅ Smart card validated successfully');
      } else {
        setCardError(response?.message || 'Smart card validation failed');
        console.log('❌ Smart card validation failed:', response?.message);
      }
    } catch (error: any) {
      console.error('❌ Smart card validation error:', error);

      if (error.message.includes('login again')) {
        return;
      }

      if (error.message.includes('Invalid smart card')) {
        setCardError(error.message);
      } else if (error.message.includes('Smart card not found')) {
        setCardError('Smart card number not found for this operator');
      }
    } finally {
      setIsValidatingCard(false);
    }
  };

  const loadRecentNumbers = async () => {
    try {
      const recent = await AsyncStorage.getItem('recentNumbers');
      if (recent) {
        setRecentNumbers(JSON.parse(recent));
      }
    } catch (error) {
      console.log('Error loading recent numbers:', error);
    }
  };

  // ========== CONTACT FUNCTIONS ==========
  
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
        const validContacts = data.filter(c => c.phoneNumbers && c.phoneNumbers.length > 0);
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
      Alert.alert('No recent numbers', 'You haven\'t made any recent transactions.');
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
      Alert.alert('Invalid number', 'Selected contact does not have a valid Nigerian phone number.');
      return;
    }

    setPhone(formattedNumber);
    setShowContactsModal(false);
    setShowRecentsModal(false);
  };

  const handleBuyForSelf = () => {
    Alert.alert('Info', 'This would use your registered phone number. For demo, please enter a number manually.');
  };

  // ========== UNIFIED PAYMENT PROCESSING ==========
  
  const validatePinAndPurchase = async () => {
    console.log('=== CABLE TV PAYMENT START ===');
    
    if (!isPinValid) {
      console.log('❌ PIN invalid:', pin);
      setPinError('PIN must be exactly 4 digits');
      return;
    }

    console.log('✅ Starting cable TV payment process...');
    setIsValidatingPin(true);
    setIsProcessingPayment(true);
    setPinError('');

    try {
      console.log('📦 Cable TV payment payload:', {
        type: 'cable_tv',
        operator: selectedOperator,
        packageId: selectedPackage?.id,
        smartCardNumber: smartCardNumber,
        phone: phone,
        amount: selectedPackage?.amount,
        pinProvided: !!pin
      });

      // Use the same /purchase route as airtime
      const response = await makeApiRequest('/purchase', {
        method: 'POST',
        body: JSON.stringify({
          type: 'cable_tv',
          operator: selectedOperator,
          packageId: selectedPackage?.id,
          smartCardNumber: smartCardNumber,
          phone: phone,
          amount: selectedPackage?.amount,
          pin: pin,
        }),
      });

      console.log('📊 Purchase response:', response);

      if (response.success === true) {
        console.log('🎉 Cable TV payment successful!');
        
        await saveRecentNumber(phone);
        
        // Update balance using the same logic as airtime
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

        // Clear form
        await AsyncStorage.removeItem('cableTvFormState');

        // Prepare success data
        const operatorName = operators.find(op => op.id === selectedOperator)?.label || selectedOperator?.toUpperCase();
        setSuccessData({
          transaction: response.transaction || {},
          operatorName,
          phone,
          smartCardNumber,
          customerName: customerName || 'Verified Customer',
          amount: response.transaction?.amount || selectedPackage?.amount,
          packageName: selectedPackage?.name,
          newBalance: response.newBalance
        });

        setTimeout(() => {
          setShowSuccessModal(true);
        }, 300);

      } else {
        console.log('❌ Cable TV payment failed:', response.message);
        
        if (response.message && response.message.toLowerCase().includes('pin')) {
          setPinError(response.message);
        }
        
        Alert.alert('Transaction Failed', response.message || 'Payment could not be processed');
      }

    } catch (error) {
      console.error('💥 Cable TV payment error:', error);
      
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
      console.log('=== CABLE TV PAYMENT END ===');
    }
  };

  const handleCloseSuccessModal = () => {
    console.log('User closed success modal');
    setShowSuccessModal(false);
    setSuccessData(null);
  };

  const handleBuyMoreCableTV = () => {
    console.log('User selected: Buy More Cable TV');
    setShowSuccessModal(false);
    setSuccessData(null);

    // Reset form
    setCurrentStep(1);
    setPhone('');
    setSelectedOperator(null);
    setSelectedPackage(null);
    setSmartCardNumber('');
    setCustomerName('');
    setPin('');
    setPinError('');
    setCardError('');
  };

  return (
    <View style={styles.container}>
      {/* Fixed Header */}
      <View style={styles.header}>
        <Text style={styles.headerText}>Cable TV</Text>
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
            <Text style={styles.label}>Beneficiary</Text>
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
                style={[styles.actionBtn, { flex: 1, marginHorizontal: 8 }]} 
                onPress={handleBuyForSelf}
              >
                <Text style={styles.actionBtnText}>👤 Self</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.actionBtn, { flex: 1, marginLeft: 8 }]} 
                onPress={showRecentNumbers}
              >
                <Text style={styles.actionBtnText}>🕐 Recent ({recentNumbers.length})</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Operator Selection */}
          <View style={styles.section}>
            <Text style={styles.label}>Select Operator</Text>
            <View style={styles.operatorGrid}>
              {operators.map((operator) => (
                <TouchableOpacity
                  key={operator.id}
                  style={[
                    styles.operatorCard,
                    selectedOperator === operator.id && styles.operatorSelected,
                  ]}
                  onPress={() => setSelectedOperator(operator.id)}
                >
                  <Image source={operator.logo} style={styles.operatorLogo} />
                  <Text style={styles.operatorLabel}>{operator.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Package Selection */}
          {selectedOperator && (
            <View style={styles.section}>
              <Text style={styles.label}>Select Package</Text>
              {isLoadingPackages ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color="#ff3b30" />
                  <Text style={styles.loadingText}>Loading packages...</Text>
                </View>
              ) : cablePackages.length > 0 ? (
                <>
                  <TouchableOpacity
                    style={styles.packageSelector}
                    onPress={() => setShowPackageModal(true)}
                  >
                    <Text style={[styles.packageSelectorText, selectedPackage ? styles.packageSelected : {}]}>
                      {selectedPackage ? `${selectedPackage.name} - ₦${selectedPackage.amount.toLocaleString()}` : 'Choose Package'}
                    </Text>
                    <Text style={styles.dropdownArrow}>▼</Text>
                  </TouchableOpacity>
                  {selectedPackage && (
                    <View style={styles.packageDetails}>
                      <Text style={styles.packageDescription}>{selectedPackage.description}</Text>
                      <Text style={styles.packageDuration}>Duration: {selectedPackage.duration}</Text>
                    </View>
                  )}
                </>
              ) : (
                <Text style={styles.error}>No packages available for this operator</Text>
              )}
            </View>
          )}

          {/* Smart Card Number */}
          {selectedOperator && (
            <View style={styles.section}>
              <Text style={styles.label}>Smart Card Number</Text>
              <View style={styles.inputContainer}>
                <TextInput
                  style={[styles.input, cardError ? styles.inputError : customerName ? styles.inputSuccess : {}]}
                  keyboardType="numeric"
                  placeholder="Enter your smart card number"
                  value={smartCardNumber}
                  onChangeText={setSmartCardNumber}
                  maxLength={15}
                />
                {isValidatingCard && (
                  <ActivityIndicator 
                    size="small" 
                    color="#ff3b30" 
                    style={styles.inputLoader}
                  />
                )}
              </View>
              {cardError && (
                <Text style={styles.error}>{cardError}</Text>
              )}
              {customerName && !cardError && (
                <Text style={styles.success}>✓ Card verified for: {customerName}</Text>
              )}
              {!isSmartCardValid && smartCardNumber.length > 0 && (
                <Text style={styles.error}>Smart card number must be at least 10 digits</Text>
              )}
            </View>
          )}

          {/* Phone Number */}
          <View style={styles.section}>
            <Text style={styles.label}>Phone Number</Text>
            <TextInput
              style={styles.input}
              keyboardType="phone-pad"
              placeholder="Enter phone number (e.g., 08012345678)"
              maxLength={11}
              value={phone}
              onChangeText={setPhone}
            />
            {phone !== '' && !isPhoneValid && (
              <Text style={styles.error}>Enter valid 11-digit phone number starting with 070, 080, 081, or 090</Text>
            )}
            {phone !== '' && isPhoneValid && (
              <Text style={styles.success}>✓ Valid phone number</Text>
            )}
          </View>

          {/* Amount Display */}
          {selectedPackage && (
            <View style={styles.section}>
              <Text style={styles.label}>Amount</Text>
              <View style={styles.amountDisplay}>
                <Text style={styles.amountText}>₦{selectedPackage.amount.toLocaleString()}</Text>
                <Text style={styles.amountLabel}>Package Price</Text>
              </View>
            </View>
          )}

          {/* Proceed Button */}
          <TouchableOpacity
            style={[styles.proceedBtn, !canProceed && styles.proceedDisabled]}
            disabled={!canProceed}
            onPress={() => setCurrentStep(2)}
          >
            <Text style={styles.proceedText}>
              Review Purchase {canProceed && selectedPackage && `• ₦${selectedPackage.amount.toLocaleString()}`}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* STEP 2: PURCHASE SUMMARY */}
      {currentStep === 2 && (
        <ScrollView
          style={styles.scrollContent}
          contentContainerStyle={{ paddingBottom: 40 }}
        >
          {/* Balance Card - Same structure as airtime */}
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

                {/* Show balance after transaction */}
                {selectedPackage && selectedPackage.amount > 0 && (
                  <View style={styles.transactionPreview}>
                    <Text style={styles.previewLabel}>After purchase:</Text>
                    <Text style={[
                      styles.previewAmount,
                      ((userBalance.total || userBalance.amount || 0) - selectedPackage.amount) < 0 ? styles.insufficientPreview : styles.sufficientPreview
                    ]}>
                      ₦{Math.max(0, (userBalance.total || userBalance.amount || 0) - selectedPackage.amount).toLocaleString()}
                    </Text>
                  </View>
                )}

                {/* Insufficient balance warning */}
                {selectedPackage && selectedPackage.amount > (userBalance.total || userBalance.amount || 0) && (
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

          {/* Purchase Summary Card */}
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Purchase Summary</Text>

            {/* Operator */}
            {selectedOperator && (
              <View style={styles.summaryRow}>
                <View style={styles.summaryLeft}>
                  <Image
                    source={operators.find((op) => op.id === selectedOperator)?.logo}
                    style={styles.summaryLogo}
                  />
                  <Text style={styles.summaryText}>
                    {operators.find((op) => op.id === selectedOperator)?.label}
                  </Text>
                </View>
              </View>
            )}

            {/* Package */}
            {selectedPackage && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Package:</Text>
                <Text style={styles.summaryValue}>{selectedPackage.name}</Text>
              </View>
            )}

            {/* Duration */}
            {selectedPackage && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Duration:</Text>
                <Text style={styles.summaryValue}>{selectedPackage.duration}</Text>
              </View>
            )}

            {/* Smart Card */}
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Smart Card:</Text>
              <Text style={styles.summaryValue}>{smartCardNumber}</Text>
            </View>

            {/* Customer Name */}
            {customerName && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Customer:</Text>
                <Text style={styles.summaryValue}>{customerName}</Text>
              </View>
            )}

            {/* Phone */}
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Recipient:</Text>
              <Text style={styles.summaryValue}>{phone}</Text>
            </View>

            <View style={styles.summaryDivider} />

            {/* Total Amount */}
            {selectedPackage && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Total:</Text>
                <Text style={[styles.summaryValue, styles.summaryTotal]}>
                  ₦{selectedPackage.amount.toLocaleString()}
                </Text>
              </View>
            )}

            {/* Balance After */}
            {userBalance && selectedPackage && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Balance After:</Text>
                <Text style={[
                  styles.summaryValue, 
                  styles.summaryBalance,
                  ((userBalance.total || userBalance.amount || 0) - selectedPackage.amount) < 0 ? styles.negativeBalance : {}
                ]}>
                  ₦{Math.max(0, (userBalance.total || userBalance.amount || 0) - selectedPackage.amount).toLocaleString()}
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
                <Text style={styles.pinSummaryTitle}>Confirm Cable TV Purchase</Text>

                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Operator:</Text>
                  <Text style={styles.summaryValue}>
                    {operators.find((op) => op.id === selectedOperator)?.label}
                  </Text>
                </View>

                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Package:</Text>
                  <Text style={styles.summaryValue}>{selectedPackage?.name}</Text>
                </View>

                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Smart Card:</Text>
                  <Text style={styles.summaryValue}>{smartCardNumber}</Text>
                </View>

                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Phone:</Text>
                  <Text style={styles.summaryValue}>{phone}</Text>
                </View>

                {selectedPackage && (
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Amount:</Text>
                    <Text style={[styles.summaryValue, styles.summaryAmount]}>
                      ₦{selectedPackage.amount.toLocaleString()}
                    </Text>
                  </View>
                )}
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
                    Enter your 4-digit transaction PIN to complete this cable TV purchase
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
                    Confirm Payment • ₦{selectedPackage?.amount.toLocaleString()}
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

      {/* Package Selection Modal */}
      <Modal visible={showPackageModal} animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Package</Text>
            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setShowPackageModal(false)}
            >
              <Text style={styles.modalCloseBtnText}>✕</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={cablePackages}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.packageItem,
                  selectedPackage?.id === item.id && styles.packageItemSelected
                ]}
                onPress={() => {
                  setSelectedPackage(item);
                  setShowPackageModal(false);
                }}
              >
                <View style={styles.packageInfo}>
                  <Text style={styles.packageName}>{item.name}</Text>
                  <Text style={styles.packageDescription}>{item.description}</Text>
                  <Text style={styles.packageDuration}>Duration: {item.duration}</Text>
                </View>
                <Text style={styles.packagePrice}>₦{item.amount.toLocaleString()}</Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <Text style={styles.emptyText}>No packages available</Text>
            }
          />
        </View>
      </Modal>

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
            <Text style={styles.modalTitle}>Recent Numbers</Text>

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
              <Text style={styles.emptyText}>No recent numbers found</Text>
            }
          />
        </View>
      </Modal>

      {/* Success Modal */}
      {showSuccessModal && successData && (
        <CableTVSuccessModal
          visible={showSuccessModal}
          onClose={handleCloseSuccessModal}
          onBuyMore={handleBuyMoreCableTV}
          transaction={successData.transaction}
          operatorName={successData.operatorName}
          phone={successData.phone}
          smartCardNumber={successData.smartCardNumber}
          customerName={successData.customerName}
          amount={successData.amount}
          packageName={successData.packageName}
          newBalance={successData.newBalance}
        />
      )}
    </View>
  );
}

// Styles
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
  authErrorBanner: {
    backgroundColor: '#fff3cd',
    borderBottomWidth: 1,
    borderBottomColor: '#ffeaa7',
    paddingVertical: 8,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Platform.OS === 'ios' ? 90 : 60,
  },
  authErrorText: {
    color: '#856404',
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
  },
  loginButton: {
    backgroundColor: '#ff3b30',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  authErrorCard: {
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
    alignItems: 'center',
  },
  authErrorCardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ff8c00',
    textAlign: 'center',
    marginBottom: 12,
  },
  authErrorCardText: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
  },
  loginCardButton: {
    backgroundColor: '#ff3b30',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 20,
  },
  loginCardButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
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
  operatorGrid: { 
    flexDirection: 'row', 
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12
  },
  operatorCard: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
    width: '48%',
    backgroundColor: '#fff',
    minHeight: 50,
  },
  operatorSelected: { 
    borderColor: '#ff3b30', 
    backgroundColor: '#fff5f5',
    borderWidth: 2 
  },
  operatorLogo: { width: 35, height: 35, resizeMode: 'contain', marginBottom: 4 },
  operatorLabel: { fontSize: 12, fontWeight: '600', color: '#666' },
  packageSelector: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 14,
    backgroundColor: '#fff',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  packageSelectorText: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  packageSelected: {
    color: '#333',
    fontWeight: '500',
  },
  dropdownArrow: {
    fontSize: 12,
    color: '#999',
  },
  packageDetails: {
    marginTop: 8,
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  packageDescription: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  packageDuration: {
    fontSize: 12,
    color: '#999',
  },
  inputContainer: {
    position: 'relative',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  inputError: {
    borderColor: '#ff3b30',
    backgroundColor: '#fff5f5',
  },
  inputSuccess: {
    borderColor: '#28a745',
    backgroundColor: '#f8fff9',
  },
  inputLoader: {
    position: 'absolute',
    right: 14,
    top: 14,
  },
  amountDisplay: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 14,
    backgroundColor: '#f8f9fa',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  amountText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ff3b30',
  },
  amountLabel: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
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
  balanceBreakdown: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  balanceItem: {
    alignItems: 'center',
  },
  balanceLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  balanceAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  balanceBonusAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ff8c00',
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
    flex: 1,
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
  summaryBalance: {
    fontSize: 16,
    fontWeight: '600',
    color: '#28a745',
  },
  negativeBalance: {
    color: '#dc3545',
  },
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
  packageItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  packageItemSelected: {
    backgroundColor: '#fff5f5',
    borderLeftWidth: 4,
    borderLeftColor: '#ff3b30',
  },
  packageInfo: {
    flex: 1,
    paddingRight: 12,
  },
  packageName: { 
    fontSize: 16, 
    fontWeight: '600', 
    color: '#333',
    marginBottom: 4,
  },
  packagePrice: {
    fontSize: 18,
    fontWeight: '700',
    color: '#28a745',
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
  emptyText: {
    textAlign: 'center',
    color: '#999',
    fontSize: 16,
    marginTop: 40,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
  },
  loadingText: {
    marginLeft: 8,
    color: '#666',
  },
  // Additional styles merged into main styles
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
});
