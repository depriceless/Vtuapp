import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
  FlatList,
  Platform,
  Alert,
  ActivityIndicator,
  BackHandler,
  StatusBar,
  Vibration,
  Dimensions,
  Linking,
  Animated,
  Share,
  Image,
} from 'react-native';
import * as Contacts from 'expo-contacts';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Network from 'expo-network';
import NetInfo from '@react-native-community/netinfo';
import * as Haptics from 'expo-haptics';

// -------------------------
// Back Handler Setup
// -------------------------
const setupBackHandler = () => {
  const backAction = () => {
    Alert.alert("Hold on!", "Are you sure you want to go back?", [
      { text: "Cancel", onPress: () => null, style: "cancel" },
      { text: "YES", onPress: () => BackHandler.exitApp() }
    ]);
    return true; // prevent default back action
  };

  const backHandler = BackHandler.addEventListener(
    "hardwareBackPress",
    backAction
  );

  return () => backHandler.remove(); // cleanup
};

// API Configuration
const API_BASE_URL = 'http://localhost:5000/api';

// Device dimensions
const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

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
  amount: number;
  lastUpdated: string;
  currency: string;
}

interface PinStatus {
  isPinSet: boolean;
  hasPinSet: boolean;
  isLocked: boolean;
  lockTimeRemaining: number;
  attemptsRemaining: number;
}

interface ElectricityProvider {
  id: string;
  name: string;
  fullName: string;
  acronym: string;
  isActive: boolean;
  minAmount: number;
  maxAmount: number;
  fee: number;
  logo?: any;
}

interface MeterType {
  id: string;
  name: string;
  type: 'prepaid' | 'postpaid';
  description: string;
}

interface NetworkState {
  isConnected: boolean | null;
  type: string | null;
  isInternetReachable: boolean | null;
}

interface TransactionData {
  _id: string;
  reference: string;
  status: string;
  amount: number;
  fee: number;
  provider: string;
  meterNumber: string;
  customerName: string;
  token?: string;
  units?: string;
  responseMessage: string;
  createdAt: string;
}

interface ElectricitySuccessModalProps {
  visible: boolean;
  onClose: () => void;
  onBuyMore: () => void;
  transaction: TransactionData;
  providerName: string;
  phone: string;
  meterNumber: string;
  customerName: string;
  customerAddress?: string;
  amount: number;
  meterType: string;
  newBalance: UserBalance | null;
}

// Success Modal Component
const ElectricitySuccessModal: React.FC<ElectricitySuccessModalProps> = ({
  visible,
  onClose,
  onBuyMore,
  transaction,
  providerName,
  phone,
  meterNumber,
  customerName,
  customerAddress,
  amount,
  meterType,
  newBalance,
}) => {
  const [fadeAnim] = useState(new Animated.Value(0));
  const [scaleAnim] = useState(new Animated.Value(0.8));

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.8);
    }
  }, [visible, fadeAnim, scaleAnim]);

  const shareReceipt = async () => {
    try {
      const receiptText = `⚡ Electricity Bill Payment Receipt

🏢 Service Provider: ${providerName}
⚡ Meter Type: ${meterType}
🔢 Meter Number: ${meterNumber}
👤 Customer: ${customerName}
${customerAddress ? `🏠 Address: ${customerAddress}` : ''}
📱 Phone: ${phone}

💰 Payment Amount: ₦${amount.toLocaleString()}
💳 Service Fee: ₦${transaction.fee.toLocaleString()}
💵 Total Charged: ₦${(amount + transaction.fee).toLocaleString()}

✅ Status: ${transaction.status.toUpperCase()}
🆔 Transaction ID: ${transaction._id}
📋 Reference: ${transaction.reference}

${newBalance ? `💼 Updated Balance: ₦${newBalance.total.toLocaleString()}` : ''}

Powered by Your App 🚀`;

      await Share.share({
        message: receiptText,
        title: 'Electricity Bill Payment Receipt',
      });
    } catch (error) {
      console.error('Error sharing receipt:', error);
      Alert.alert('Error', 'Unable to share receipt');
    }
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="none"
      onRequestClose={onClose}
    >
      <Animated.View 
        style={[
          styles.overlay,
          {
            opacity: fadeAnim,
          },
        ]}
      >
        <Animated.View
          style={[
            styles.modalContainer,
            {
              transform: [
                { scale: scaleAnim },
              ],
            },
          ]}
        >
          {/* Success Icon */}
          <View style={styles.iconContainer}>
            <Text style={styles.successIcon}>⚡</Text>
          </View>

          {/* Title */}
          <Text style={styles.title}>Electricity Payment Successful!</Text>

          {/* Content */}
          <Text style={styles.subtitle}>{providerName} Payment Completed</Text>

          <View style={styles.detailsContainer}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Meter Type:</Text>
              <Text style={styles.detailValue}>{meterType}</Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Amount:</Text>
              <Text style={styles.detailValue}>₦{amount.toLocaleString()}</Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Meter Number:</Text>
              <Text style={styles.detailValue}>{meterNumber}</Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Customer:</Text>
              <Text style={styles.detailValue}>{customerName}</Text>
            </View>

            {customerAddress && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Address:</Text>
                <Text style={styles.detailValue}>{customerAddress}</Text>
              </View>
            )}

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Phone:</Text>
              <Text style={styles.detailValue}>{phone}</Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Provider:</Text>
              <Text style={styles.detailValue}>{providerName}</Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Transaction ID:</Text>
              <Text style={styles.detailValue}>{transaction._id}</Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Status:</Text>
              <Text style={styles.detailValue}>{transaction.status.toUpperCase()}</Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Service Fee:</Text>
              <Text style={styles.detailValue}>₦{transaction.fee.toLocaleString()}</Text>
            </View>

            {transaction.reference && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Reference:</Text>
                <Text style={styles.detailValue}>{transaction.reference}</Text>
              </View>
            )}

            {newBalance && (
              <View style={[styles.detailRow, styles.balanceRow]}>
                <Text style={styles.detailLabel}>New Balance:</Text>
                <Text style={[styles.detailValue, styles.balanceValue]}>
                  ₦{newBalance.total.toLocaleString()}
                </Text>
              </View>
            )}
          </View>

          <Text style={styles.thankYou}>Your electricity has been topped up successfully!</Text>

          {/* Buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity 
              style={[styles.button, styles.shareButton]} 
              onPress={shareReceipt}
            >
              <Text style={styles.shareText}>📤 Share Receipt</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.button, styles.buyMoreButton]} 
              onPress={onBuyMore}
            >
              <Text style={styles.buyMoreText}>⚡ Buy More Electricity</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.button, styles.doneButton]} 
              onPress={onClose}
            >
              <Text style={styles.doneText}>Done</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

// Main Component
const BuyElectricity: React.FC<{ navigation?: any }> = ({ navigation }) => {
  // State Management
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [selectedMeterType, setSelectedMeterType] = useState<string | null>(null);
  const [meterNumber, setMeterNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');

  // Lists and Data
  const [contactsList, setContactsList] = useState<Contact[]>([]);
  const [recentNumbers, setRecentNumbers] = useState<RecentNumber[]>([]);
  const [userBalance, setUserBalance] = useState<UserBalance | null>(null);
  const [pinStatus, setPinStatus] = useState<PinStatus | null>(null);
  const [electricityProviders, setElectricityProviders] = useState<ElectricityProvider[]>([]);

  // Modal States
  const [showContactsModal, setShowContactsModal] = useState(false);
  const [showRecentsModal, setShowRecentsModal] = useState(false);
  const [showProvidersModal, setShowProvidersModal] = useState(false);
  const [showMeterTypeModal, setShowMeterTypeModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // Loading States
  const [isLoadingContacts, setIsLoadingContacts] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [isValidatingPin, setIsValidatingPin] = useState(false);
  const [isValidatingMeter, setIsValidatingMeter] = useState(false);
  const [isLoadingProviders, setIsLoadingProviders] = useState(false);

  // Error States
  const [pinError, setPinError] = useState('');
  const [meterError, setMeterError] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [networkError, setNetworkError] = useState<string | null>(null);

  // Customer Info
  const [customerName, setCustomerName] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerAccountNumber, setCustomerAccountNumber] = useState('');

  // Transaction Results
  const [transactionResult, setTransactionResult] = useState<TransactionData | null>(null);
  const [selectedProviderName, setSelectedProviderName] = useState('');
  const [updatedBalance, setUpdatedBalance] = useState<UserBalance | null>(null);

  // Network State
  const [networkState, setNetworkState] = useState<NetworkState>({
    isConnected: null,
    type: null,
    isInternetReachable: null,
  });

  // Meter Types
  const meterTypes: MeterType[] = [
    { 
      id: 'prepaid', 
      name: 'Prepaid Meter', 
      type: 'prepaid',
      description: 'Pay before you use electricity - Buy units in advance'
    },
    { 
      id: 'postpaid', 
      name: 'Postpaid Meter', 
      type: 'postpaid',
      description: 'Pay after you use electricity - Monthly billing system'
    },
  ];

  // Validation Logic
  const isPhoneValid = phone.length === 11 && /^0[789][01]\d{8}$/.test(phone);
  const isMeterNumberValid = meterNumber.length >= 10 && /^\d+$/.test(meterNumber);
  const amountNum = parseInt(amount) || 0;
  const isAmountValid = amountNum >= 100 && amountNum <= 100000;
  const hasEnoughBalance = userBalance && amountNum <= (userBalance.total || userBalance.amount || 0);
  const canProceed = isPhoneValid && selectedProvider && selectedMeterType && 
                    isMeterNumberValid && isAmountValid && hasEnoughBalance && 
                    customerName.trim() !== '' && networkState.isConnected;
  const isPinValid = pin.length === 4 && /^\d{4}$/.test(pin);

  // Effects
   // Effects
  useEffect(() => {
    initializeApp();
    setupNetworkListener();
    setupBackHandler();

    return () => {
      // Clean up network listener - the API has changed in newer versions
      // For newer versions of NetInfo, we need to use the unsubscribe function
      if (typeof NetInfo.addEventListener === 'function') {
        // New API - we need to store the unsubscribe function
        // Since we're using Network from expo-network, we don't need this cleanup
      }
    };
  }, []);

  
  useEffect(() => {
    if (currentStep === 2) {
      fetchUserBalance();
    }
  }, [currentStep]);

  useEffect(() => {
    if (currentStep === 3) {
      setPin('');
      setPinError('');
      checkPinStatus();
    }
  }, [currentStep]);

  useEffect(() => {
    if (isMeterNumberValid && selectedProvider && selectedMeterType && meterNumber.length >= 10) {
      const timeoutId = setTimeout(() => {
        validateMeter();
      }, 1500);

      return () => clearTimeout(timeoutId);
    } else {
      setCustomerName('');
      setCustomerAddress('');
      setCustomerAccountNumber('');
      setMeterError('');
    }
  }, [meterNumber, selectedProvider, selectedMeterType]);

  // Initialization Functions
  const initializeApp = async () => {
    try {
      StatusBar.setBarStyle('light-content');
      await Promise.all([
        loadRecentNumbers(),
        loadFormState(),
        fetchElectricityProviders(),
        fetchUserBalance(),
        checkPinStatus(),
      ]);
    } catch (error) {
      console.error('App initialization error:', error);
    }
  };

  const setupNetworkListener = async () => {
    try {
      // Get initial network state
      const networkState = await Network.getNetworkStateAsync();
      handleNetworkChange(networkState);

      // Subscribe to network changes
      Network.addNetworkStateListener(handleNetworkChange);
    } catch (error) {
      console.error('Network setup error:', error);
      setNetworkState({
        isConnected: false,
        type: null,
        isInternetReachable: false,
      });
    }
  };

  const handleBackPress = (): boolean => {
    if (showContactsModal || showRecentsModal || showProvidersModal || showMeterTypeModal) {
      setShowContactsModal(false);
      setShowRecentsModal(false);
      setShowProvidersModal(false);
      setShowMeterTypeModal(false);
      return true;
    }

    if (currentStep === 3) {
      setCurrentStep(2);
      return true;
    }

    if (currentStep === 2) {
      setCurrentStep(1);
      return true;
    }

    return false;
  };

  const handleNetworkChange = (state: any) => {
    setNetworkState({
      isConnected: state.isConnected,
      type: state.type,
      isInternetReachable: state.isInternetReachable,
    });

    if (!state.isConnected) {
      setNetworkError('No internet connection. Please check your network settings.');
    } else if (state.isInternetReachable === false) {
      setNetworkError('Internet not reachable. Please check your connection.');
    } else {
      setNetworkError(null);
    }
  };

  // Auth and API Functions
  const getAuthToken = async (): Promise<string> => {
    try {
      const possibleKeys = [
        'userToken', 'authToken', 'token', 'accessToken',
        'jwt', 'jwtToken', 'bearerToken', 'access_token',
        'auth_token', 'user_token'
      ];

      for (const key of possibleKeys) {
        const token = await AsyncStorage.getItem(key);
        if (token && token.trim() && token !== 'null' && token !== 'undefined') {
          const trimmedToken = token.trim();
          if (trimmedToken.length > 10) {
            return trimmedToken;
          }
        }
      }

      throw new Error('No authentication token found');
    } catch (error) {
      setAuthError('Authentication required - please login again');
      throw new Error('Failed to retrieve authentication token');
    }
  };

  const makeApiRequest = async (endpoint: string, options: any = {}): Promise<any> => {
    // Check network connectivity
    if (!networkState.isConnected) {
      throw new Error('No internet connection available');
    }

    let token: string;
    try {
      token = await getAuthToken();
      setAuthError(null);
    } catch (authError) {
      setAuthError('Please login again to continue');
      throw authError;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const requestOptions = {
        ...options,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-App-Version': '1.0.0',
          'X-Platform': Platform.OS,
          ...options.headers,
        },
        signal: controller.signal,
      };

      const response = await fetch(`${API_BASE_URL}${endpoint}`, requestOptions);

      clearTimeout(timeoutId);

      let data;
      const responseText = await response.text();

      if (responseText) {
        try {
          data = JSON.parse(responseText);
        } catch (parseError) {
          throw new Error(`Invalid response format from server. Status: ${response.status}`);
        }
      } else {
        data = {};
      }

      if (!response.ok) {
        if (response.status === 401) {
          setAuthError('Session expired - please login again');
          throw new Error('Session expired');
        } else if (response.status === 403) {
          throw new Error('Access denied. Please contact support.');
        } else if (response.status === 429) {
          throw new Error('Too many requests. Please wait a moment and try again.');
        } else if (response.status >= 500) {
          throw new Error('Server error. Please try again later.');
        }

        const errorMessage = data?.message || data?.error || `Request failed with status ${response.status}`;
        throw new Error(errorMessage);
      }

      return data;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        throw new Error('Request timeout. Please check your connection and try again.');
      }

      throw error;
    }
  };

  // Data Fetching Functions
  const fetchElectricityProviders = async () => {
    setIsLoadingProviders(true);
    try {
      const response = await makeApiRequest('/electricity/providers');

      if (response.success && Array.isArray(response.data)) {
        setElectricityProviders(response.data);
      } else {
        // Fallback to hardcoded providers if API fails
        setElectricityProviders(getDefaultProviders());
      }
    } catch (error) {
      console.error('Failed to fetch providers:', error);
      // Use default providers as fallback
      setElectricityProviders(getDefaultProviders());
    } finally {
      setIsLoadingProviders(false);
    }
  };

  const getDefaultProviders = (): ElectricityProvider[] => [
    { id: 'aedc', name: 'Abuja Electric', fullName: 'Abuja Electricity Distribution Company', acronym: 'AEDC', isActive: true, minAmount: 100, maxAmount: 100000, fee: 50 },
    { id: 'bedc', name: 'Benin Electric', fullName: 'Benin Electricity Distribution Company', acronym: 'BEDC', isActive: true, minAmount: 100, maxAmount: 100000, fee: 50 },
    { id: 'eedc', name: 'Enugu Electric', fullName: 'Enugu Electricity Distribution Company', acronym: 'EEDC', isActive: true, minAmount: 100, maxAmount: 100000, fee: 50 },
    { id: 'ekedc', name: 'Eko Electric', fullName: 'Eko Electricity Distribution Company', acronym: 'EKEDC', isActive: true, minAmount: 100, maxAmount: 100000, fee: 50 },
    { id: 'ibedc', name: 'Ibadan Electric', fullName: 'Ibadan Electricity Distribution Company', acronym: 'IBEDC', isActive: true, minAmount: 100, maxAmount: 100000, fee: 50 },
    { id: 'ikedc', name: 'Ikeja Electric', fullName: 'Ikeja Electric Distribution Company', acronym: 'IKEDC', isActive: true, minAmount: 100, maxAmount: 100000, fee: 50 },
    { id: 'jedc', name: 'Jos Electric', fullName: 'Jos Electricity Distribution Company', acronym: 'JEDC', isActive: true, minAmount: 100, maxAmount: 100000, fee: 50 },
    { id: 'kaedc', name: 'Kaduna Electric', fullName: 'Kaduna Electric Distribution Company', acronym: 'KAEDC', isActive: true, minAmount: 100, maxAmount: 100000, fee: 50 },
    { id: 'kedc', name: 'Kano Electric', fullName: 'Kano Electricity Distribution Company', acronym: 'KEDC', isActive: true, minAmount: 100, maxAmount: 100000, fee: 50 },
    { id: 'phedc', name: 'Port Harcourt Electric', fullName: 'Port Harcourt Electric Distribution Company', acronym: 'PHEDC', isActive: true, minAmount: 100, maxAmount: 100000, fee: 50 },
    { id: 'yedc', name: 'Yola Electric', fullName: 'Yola Electricity Distribution Company', acronym: 'YEDC', isActive: true, minAmount: 100, maxAmount: 100000, fee: 50 },
  ];

  const fetchUserBalance = async () => {
    if (!networkState.isConnected) {
      const cachedBalance = await AsyncStorage.getItem('userBalance');
      if (cachedBalance) {
        setUserBalance(JSON.parse(cachedBalance));
      }
      return;
    }

    setIsLoadingBalance(true);
    try {
      const balanceData = await makeApiRequest('/balance');

      if (balanceData?.success) {
        const balanceAmount = parseFloat(balanceData.balance?.amount) || 
                             parseFloat(balanceData.balance?.totalBalance) || 
                             parseFloat(balanceData.balance?.mainBalance) || 0;
        
        const balance: UserBalance = {
          main: balanceAmount,
          bonus: 0,
          total: balanceAmount,
          amount: balanceAmount,
          lastUpdated: balanceData.balance?.lastUpdated || new Date().toISOString(),
          currency: balanceData.balance?.currency || 'NGN',
        };

        setUserBalance(balance);
        await AsyncStorage.setItem('userBalance', JSON.stringify(balance));
      }
    } catch (error) {
      console.error('Balance fetch error:', error);
      // Try to load cached balance
      try {
        const cachedBalance = await AsyncStorage.getItem('userBalance');
        if (cachedBalance) {
          setUserBalance(JSON.parse(cachedBalance));
        }
      } catch (cacheError) {
        console.error('Failed to load cached balance:', cacheError);
      }
    } finally {
      setIsLoadingBalance(false);
    }
  };

  const checkPinStatus = async () => {
    try {
      const response = await makeApiRequest('/purchase/pin-status');

      if (response?.success) {
        setPinStatus({
          isPinSet: response.data?.isPinSet || false,
          hasPinSet: response.data?.hasPinSet || false,
          isLocked: response.data?.isLocked || false,
          lockTimeRemaining: response.data?.lockTimeRemaining || 0,
          attemptsRemaining: response.data?.attemptsRemaining || 3,
        });
      }
    } catch (error) {
      console.error('PIN status check error:', error);
      // Set default values if check fails
      setPinStatus({
        isPinSet: false,
        hasPinSet: false,
        isLocked: false,
        lockTimeRemaining: 0,
        attemptsRemaining: 3,
      });
    }
  };

  // Meter Validation
  const validateMeter = async () => {
    if (!isMeterNumberValid || !selectedProvider || !selectedMeterType) {
      setMeterError('Please enter valid meter details');
      return;
    }

    setIsValidatingMeter(true);
    setMeterError('');
    setCustomerName('');
    setCustomerAddress('');
    setCustomerAccountNumber('');

    try {
      const response = await makeApiRequest('/electricity/validate-meter', {
        method: 'POST',
        body: JSON.stringify({ 
          meterNumber, 
          provider: selectedProvider,
          meterType: selectedMeterType
        }),
      });

      if (response?.success) {
        setCustomerName(response.data?.customerName || 'Verified Customer');
        setCustomerAddress(response.data?.customerAddress || '');
        setCustomerAccountNumber(response.data?.accountNumber || '');

        // Haptic feedback for successful validation
        if (Platform.OS === 'ios') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else {
          Vibration.vibrate(100);
        }
      } else {
        setMeterError(response?.message || 'Meter validation failed. Please check your meter number.');
      }
    } catch (error) {
      console.error('Meter validation error:', error);
      if (error.message.includes('Session expired') || error.message.includes('Authentication')) {
        setAuthError(error.message);
        return;
      }
      setMeterError(error.message || 'Unable to validate meter. Please check your details and try again.');
      setCustomerName('');
      setCustomerAddress('');
      setCustomerAccountNumber('');
    } finally {
      setIsValidatingMeter(false);
    }
  };

  // PIN Validation and Payment Processing
  const validatePin = async () => {
    if (!isPinValid) {
      setPinError('PIN must be exactly 4 digits');
      return;
    }

    setIsValidatingPin(true);
    setPinError('');

    try {
      const response = await makeApiRequest('/purchase/validate-pin', {
        method: 'POST',
        body: JSON.stringify({ pin }),
      });

      if (response?.success) {
        await processPayment();
      } else {
        setPinError(response?.message || 'Invalid PIN. Please try again.');

        // Update PIN status based on response
        if (response?.data?.attemptsRemaining !== undefined) {
          setPinStatus(prev => prev ? {
            ...prev,
            attemptsRemaining: response.data.attemptsRemaining,
            isLocked: response.data.isLocked || false,
            lockTimeRemaining: response.data.lockTimeRemaining || 0,
          } : null);
        }
      }
    } catch (error) {
      console.error('PIN validation error:', error);

      if (error.message.includes('Session expired') || error.message.includes('Authentication')) {
        setAuthError(error.message);
        return;
      }

      setPinError(error.message || 'PIN validation failed. Please try again.');
    } finally {
      setIsValidatingPin(false);
    }
  };

  const processPayment = async () => {
    setIsProcessingPayment(true);

    try {
      const purchasePayload = {
        type: 'electricity',
        provider: selectedProvider,
        meterType: selectedMeterType,
        meterNumber: meterNumber,
        amount: amountNum,
        phone: phone,
        pin: pin,
        customerName: customerName,
      };

      const purchaseResult = await makeApiRequest('/purchase', {
        method: 'POST',
        body: JSON.stringify(purchasePayload),
      });

      if (purchaseResult?.success) {
        // Save transaction to recent numbers
        await saveRecentNumber(phone, customerName);

        // Update balance locally
        if (userBalance) {
          const deductedAmount = amountNum + (purchaseResult.data?.fee || 0);
          const newBalance: UserBalance = {
            main: Math.max(0, (userBalance.main || userBalance.amount || 0) - deductedAmount),
            bonus: 0,
            total: Math.max(0, (userBalance.total || userBalance.amount || 0) - deductedAmount),
            amount: Math.max(0, (userBalance.amount || 0) - deductedAmount),
            lastUpdated: new Date().toISOString(),
            currency: userBalance.currency,
          };

          setUserBalance(newBalance);
          setUpdatedBalance(newBalance);
          await AsyncStorage.setItem('userBalance', JSON.stringify(newBalance));
        }

        // Set transaction result
        setTransactionResult(purchaseResult.data);
        setSelectedProviderName(
          electricityProviders.find(p => p.id === selectedProvider)?.name || 
          selectedProvider?.toUpperCase() || 'Unknown Provider'
        );

        // Clear form state
        await AsyncStorage.removeItem('electricityFormState');

        // Success feedback
        if (Platform.OS === 'ios') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else {
          Vibration.vibrate([0, 100, 50, 100]);
        }

        setShowSuccessModal(true);

      } else {
        throw new Error(purchaseResult?.message || 'Payment processing failed');
      }
    } catch (error) {
      console.error('Payment processing error:', error);

      if (error.message.includes('Session expired') || error.message.includes('Authentication')) {
        setAuthError(error.message);
        return;
      }

      let errorMessage = 'Unable to process your electricity payment. Please try again.';

      if (error.message.toLowerCase().includes('insufficient')) {
        errorMessage = 'Insufficient wallet balance for this transaction.';
      } else if (error.message.toLowerCase().includes('invalid meter')) {
        errorMessage = 'Invalid meter number. Please check and try again.';
      } else if (error.message.toLowerCase().includes('network')) {
        errorMessage = 'Network error. Please check your connection and try again.';
      } else if (error.message.toLowerCase().includes('timeout')) {
        errorMessage = 'Request timed out. Please try again.';
      }

      Alert.alert(
        'Transaction Failed',
        errorMessage,
        [
          { text: 'Try Again', style: 'default' },
          { text: 'Cancel', style: 'cancel' }
        ]
      );

      // Error feedback
      if (Platform.OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } else {
        Vibration.vibrate(200);
      }

    } finally {
      setIsProcessingPayment(false);
    }
  };

  // Storage Functions
  const saveFormState = async () => {
    try {
      const formState = { 
        phone, 
        selectedProvider, 
        selectedMeterType, 
        meterNumber, 
        amount 
      };
      await AsyncStorage.setItem('electricityFormState', JSON.stringify(formState));
    } catch (error) {
      console.error('Error saving form state:', error);
    }
  };

  const loadFormState = async () => {
    try {
      const savedState = await AsyncStorage.getItem('electricityFormState');
      if (savedState) {
        const { 
          phone: savedPhone, 
          selectedProvider: savedProvider, 
          selectedMeterType: savedMeterType, 
          meterNumber: savedMeter, 
          amount: savedAmount 
        } = JSON.parse(savedState);

        setPhone(savedPhone || '');
        setSelectedProvider(savedProvider || null);
        setSelectedMeterType(savedMeterType || null);
        setMeterNumber(savedMeter || '');
        setAmount(savedAmount || '');
      }
    } catch (error) {
      console.error('Error loading form state:', error);
    }
  };

  const saveRecentNumber = async (number: string, name?: string) => {
    try {
      const recent = await AsyncStorage.getItem('recentNumbers');
      let recentList: RecentNumber[] = recent ? JSON.parse(recent) : [];

      recentList = recentList.filter(item => item.number !== number);
      recentList.unshift({ number, name, timestamp: Date.now() });
      recentList = recentList.slice(0, 20); // Keep more recent numbers

      await AsyncStorage.setItem('recentNumbers', JSON.stringify(recentList));
      setRecentNumbers(recentList);
    } catch (error) {
      console.error('Error saving recent number:', error);
    }
  };

  const loadRecentNumbers = async () => {
    try {
      const recent = await AsyncStorage.getItem('recentNumbers');
      if (recent) {
        setRecentNumbers(JSON.parse(recent));
      }
    } catch (error) {
      console.error('Error loading recent numbers:', error);
    }
  };

  // Contact Functions
  const selectContact = async () => {
    setIsLoadingContacts(true);
    try {
      const { status } = await Contacts.requestPermissionsAsync();

      if (status === 'granted') {
        const { data } = await Contacts.getContactsAsync({
          fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Name],
          pageSize: 1000,
          sort: Contacts.SortTypes.FirstName,
        });

        const validContacts = data
          .filter(c => c.phoneNumbers && c.phoneNumbers.length > 0)
          .slice(0, 200); // Limit for performance

        if (validContacts.length > 0) {
          setContactsList(validContacts);
          setShowContactsModal(true);
        } else {
          Alert.alert(
            'No Contacts Found',
            'No contacts with phone numbers were found on your device.',
            [{ text: 'OK', style: 'default' }]
          );
        }
      } else {
        Alert.alert(
          'Permission Required',
          'This app needs access to your contacts to help you select recipients. Please enable contacts permission in your device settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Settings', onPress: () => Linking.openSettings() }
          ]
        );
      }
    } catch (error) {
      console.error('Contact selection error:', error);
      Alert.alert(
        'Error Loading Contacts',
        'Unable to load your contacts. Please try again or enter the number manually.',
        [{ text: 'OK', style: 'default' }]
      );
    } finally {
      setIsLoadingContacts(false);
    }
  };

  const showRecentNumbers = () => {
    if (recentNumbers.length > 0) {
      setShowRecentsModal(true);
    } else {
      Alert.alert(
        'No Recent Numbers',
        'You haven\'t made any recent electricity purchases yet.',
        [{ text: 'OK', style: 'default' }]
      );
    }
  };

  const handleContactSelect = (number: string, name?: string) => {
    const cleaned = number.replace(/\D/g, '');
    let formattedNumber = '';

    if (cleaned.length === 10) {
      formattedNumber = '0' + cleaned;
    } else if (cleaned.length === 11 && cleaned.startsWith('0')) {
      formattedNumber = cleaned;
    } else if (cleaned.length === 13 && cleaned.startsWith('234')) {
      formattedNumber = '0' + cleaned.substring(3);
    } else if (cleaned.length === 14 && cleaned.startsWith('+234')) {
      formattedNumber = '0' + cleaned.substring(4);
    } else {
      Alert.alert(
        'Invalid Phone Number',
        'The selected contact does not have a valid Nigerian phone number format.',
        [{ text: 'OK', style: 'default' }]
      );
      return;
    }

    setPhone(formattedNumber);
    setShowContactsModal(false);
    setShowRecentsModal(false);

    // Save form state when phone changes
    saveFormState();
  };

  const handleBuyForSelf = async () => {
    try {
      const userPhone = await AsyncStorage.getItem('userPhone');
      if (userPhone) {
        setPhone(userPhone);
        saveFormState();
      } else {
        Alert.alert(
          'Phone Number Not Found',
          'Your registered phone number was not found. Please enter a number manually or update your profile.',
          [{ text: 'OK', style: 'default' }]
        );
      }
    } catch (error) {
      Alert.alert(
        'Error',
        'Unable to load your phone number. Please enter it manually.',
        [{ text: 'OK', style: 'default' }]
      );
    }
  };

  // Modal Handlers
  const handleCloseSuccessModal = () => {
    setShowSuccessModal(false);
    // Reset form to initial state
    setCurrentStep(1);
    setSelectedProvider(null);
    setSelectedMeterType(null);
    setMeterNumber('');
    setAmount('');
    setPhone('');
    setPin('');
    setCustomerName('');
    setCustomerAddress('');
    setCustomerAccountNumber('');
    setTransactionResult(null);
    setSelectedProviderName('');
    setUpdatedBalance(null);
    setPinError('');
    setMeterError('');
  };

  const handleBuyMore = () => {
    setShowSuccessModal(false);
    // Reset form but keep provider and phone for convenience
    setCurrentStep(1);
    setSelectedMeterType(null);
    setMeterNumber('');
    setAmount('');
    setPin('');
    setCustomerName('');
    setCustomerAddress('');
    setCustomerAccountNumber('');
    setTransactionResult(null);
    setSelectedProviderName('');
    setUpdatedBalance(null);
    setPinError('');
    setMeterError('');
  };

  // Save form state when key values change
  useEffect(() => {
    if (phone || selectedProvider || selectedMeterType || meterNumber || amount) {
      saveFormState();
    }
  }, [phone, selectedProvider, selectedMeterType, meterNumber, amount]);

  // Render Network Error Banner
  const renderNetworkError = () => {
    if (!networkError) return null;

    return (
      <View style={styles.networkErrorBanner}>
        <Text style={styles.networkErrorText}>📡 {networkError}</Text>
        <TouchableOpacity 
          style={styles.retryButton}
          onPress={() => NetInfo.refresh()}
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  };

  // Render Auth Error Banner
  const renderAuthError = () => {
    if (!authError) return null;

    return (
      <View style={styles.authErrorBanner}>
        <Text style={styles.authErrorText}>🔐 {authError}</Text>
        <TouchableOpacity 
          style={styles.loginButton}
          onPress={() => {
            setAuthError(null);
            navigation?.navigate?.('Login');
          }}
        >
          <Text style={styles.loginButtonText}>Login</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#ff3b30" />

      {/* Fixed Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation?.goBack?.()}
        >
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerText}>Buy Electricity</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Error Banners */}
      {renderNetworkError()}
      {renderAuthError()}

      {/* Step Indicator */}
      <View style={styles.stepIndicator}>
        <View style={styles.stepRow}>
          <View style={[styles.stepDot, currentStep >= 1 && styles.stepDotActive]}>
            <Text style={[styles.stepDotText, currentStep >= 1 && styles.stepDotTextActive]}>1</Text>
          </View>
          <View style={[styles.stepLine, currentStep >= 2 && styles.stepLineActive]} />
          <View style={[styles.stepDot, currentStep >= 2 && styles.stepDotActive]}>
            <Text style={[styles.stepDotText, currentStep >= 2 && styles.stepDotTextActive]}>2</Text>
          </View>
          <View style={[styles.stepLine, currentStep >= 3 && styles.stepLineActive]} />
          <View style={[styles.stepDot, currentStep >= 3 && styles.stepDotActive]}>
            <Text style={[styles.stepDotText, currentStep >= 3 && styles.stepDotTextActive]}>3</Text>
          </View>
        </View>
        <View style={styles.stepLabels}>
          <Text style={[styles.stepLabel, currentStep === 1 && styles.stepLabelActive]}>Details</Text>
          <Text style={[styles.stepLabel, currentStep === 2 && styles.stepLabelActive]}>Review</Text>
          <Text style={[styles.stepLabel, currentStep === 3 && styles.stepLabelActive]}>Pay</Text>
        </View>
      </View>

      {/* STEP 1: FORM */}
      {currentStep === 1 && (
        <ScrollView
          style={styles.scrollContent}
          contentContainerStyle={styles.scrollContentContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* Beneficiary Section */}
          <View style={styles.section}>
            <Text style={styles.label}>Select Beneficiary</Text>
            <View style={styles.buttonRow}>
              <TouchableOpacity 
                style={[styles.actionBtn, { flex: 1, marginRight: 6 }]} 
                onPress={selectContact}
                disabled={isLoadingContacts}
              >
                {isLoadingContacts ? (
                  <ActivityIndicator size="small" color="#555" />
                ) : (
                  <>
                    <Text style={styles.actionBtnIcon}>📞</Text>
                    <Text style={styles.actionBtnText}>Contacts</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.actionBtn, { flex: 1, marginHorizontal: 6 }]} 
                onPress={handleBuyForSelf}
              >
                <Text style={styles.actionBtnIcon}>👤</Text>
                <Text style={styles.actionBtnText}>Self</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.actionBtn, { flex: 1, marginLeft: 6 }]} 
                onPress={showRecentNumbers}
              >
                <Text style={styles.actionBtnIcon}>🕐</Text>
                <Text style={styles.actionBtnText}>Recent ({recentNumbers.length})</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Phone Number */}
          <View style={styles.section}>
            <Text style={styles.label}>Phone Number</Text>
            <TextInput
              style={[styles.input, phone && !isPhoneValid && styles.inputError, phone && isPhoneValid && styles.inputSuccess]}
              keyboardType="phone-pad"
              placeholder="Enter phone number (e.g., 08012345678)"
              maxLength={11}
              value={phone}
              onChangeText={setPhone}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {phone !== '' && !isPhoneValid && (
              <Text style={styles.errorText}>Enter a valid 11-digit Nigerian phone number</Text>
            )}
            {phone !== '' && isPhoneValid && (
              <Text style={styles.successText}>✓ Valid phone number</Text>
            )}
          </View>

          {/* Provider Selection */}
          <View style={styles.section}>
            <Text style={styles.label}>Select Electricity Provider</Text>
            <TouchableOpacity
              style={styles.selector}
              onPress={() => setShowProvidersModal(true)}
              disabled={isLoadingProviders}
            >
              <View style={styles.selectorContent}>
                <Text style={[styles.selectorText, selectedProvider ? styles.selectorTextSelected : {}]}>
                  {selectedProvider ? 
                    electricityProviders.find(p => p.id === selectedProvider)?.fullName + 
                    ` (${electricityProviders.find(p => p.id === selectedProvider)?.acronym})` 
                    : 'Choose your electricity provider (DISCO)'}
                </Text>
                {isLoadingProviders ? (
                  <ActivityIndicator size="small" color="#999" />
                ) : (
                  <Text style={styles.dropdownArrow}>▼</Text>
                )}
              </View>
            </TouchableOpacity>
          </View>

          {/* Meter Type Selection */}
          {selectedProvider && (
            <View style={styles.section}>
              <Text style={styles.label}>Meter Type</Text>
              <TouchableOpacity
                style={styles.selector}
                onPress={() => setShowMeterTypeModal(true)}
              >
                <View style={styles.selectorContent}>
                  <Text style={[styles.selectorText, selectedMeterType ? styles.selectorTextSelected : {}]}>
                    {selectedMeterType ? 
                      meterTypes.find(m => m.id === selectedMeterType)?.name 
                      : 'Choose your meter type'}
                  </Text>
                  <Text style={styles.dropdownArrow}>▼</Text>
                </View>
              </TouchableOpacity>
              {selectedMeterType && (
                <Text style={styles.helperText}>
                  {meterTypes.find(m => m.id === selectedMeterType)?.description}
                </Text>
              )}
            </View>
          )}

          {/* Meter Number */}
          {selectedProvider && selectedMeterType && (
            <View style={styles.section}>
              <Text style={styles.label}>Meter Number</Text>
              <View style={styles.inputContainer}>
                <TextInput
                  style={[
                    styles.input, 
                    meterError ? styles.inputError : 
                    customerName ? styles.inputSuccess : {}
                  ]}
                  keyboardType="numeric"
                  placeholder="Enter your meter number"
                  value={meterNumber}
                  onChangeText={setMeterNumber}
                  maxLength={15}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {isValidatingMeter && (
                  <ActivityIndicator 
                    size="small" 
                    color="#ff3b30" 
                    style={styles.inputLoader}
                  />
                )}
              </View>

              {meterError && (
                <Text style={styles.errorText}>{meterError}</Text>
              )}

              {customerName && !meterError && (
                <View style={styles.customerInfo}>
                  <Text style={styles.successText}>✓ Meter verified</Text>
                  <Text style={styles.customerName}>Customer: {customerName}</Text>
                  {customerAddress && (
                    <Text style={styles.customerAddress}>Address: {customerAddress}</Text>
                  )}
                  {customerAccountNumber && (
                    <Text style={styles.customerAccount}>Account: {customerAccountNumber}</Text>
                  )}
                </View>
              )}

              {!isMeterNumberValid && meterNumber.length > 0 && meterNumber.length < 10 && (
                <Text style={styles.errorText}>Meter number must be at least 10 digits</Text>
              )}
            </View>
          )}

          {/* Amount */}
          {selectedProvider && selectedMeterType && customerName && (
            <View style={styles.section}>
              <Text style={styles.label}>Amount</Text>
              <TextInput
                style={[styles.input, styles.amountInput]}
                keyboardType="numeric"
                placeholder="Enter amount (minimum ₦100)"
                value={amount}
                onChangeText={setAmount}
                maxLength={6}
                autoCapitalize="none"
                autoCorrect={false}
              />

              {amount !== '' && !isAmountValid && (
                <Text style={styles.errorText}>
                  Amount must be between ₦100 and ₦100,000
                </Text>
              )}

              {amount !== '' && isAmountValid && (
                <View style={styles.amountInfo}>
                  <Text style={styles.successText}>✓ Valid amount</Text>
                  <Text style={styles.amountDisplay}>
                    You will pay: ₦{amountNum.toLocaleString()}
                  </Text>
                  {electricityProviders.find(p => p.id === selectedProvider)?.fee && (
                    <Text style={styles.feeInfo}>
                      + ₦{electricityProviders.find(p => p.id === selectedProvider)?.fee} transaction fee
                    </Text>
                  )}
                </View>
              )}
            </View>
          )}

          {/* Quick Amount Buttons */}
          {selectedProvider && selectedMeterType && customerName && (
            <View style={styles.section}>
              <Text style={styles.label}>Quick Amount</Text>
              <View style={styles.quickAmountRow}>
                {[500, 1000, 2000, 5000].map((quickAmount) => (
                  <TouchableOpacity
                    key={quickAmount}
                    style={[
                      styles.quickAmountBtn,
                      amount === quickAmount.toString() && styles.quickAmountBtnActive
                    ]}
                    onPress={() => setAmount(quickAmount.toString())}
                  >
                    <Text style={[
                      styles.quickAmountText,
                      amount === quickAmount.toString() && styles.quickAmountTextActive
                    ]}>
                      ₦{quickAmount.toLocaleString()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Proceed Button */}
          <TouchableOpacity
            style={[styles.proceedBtn, !canProceed && styles.proceedBtnDisabled]}
            disabled={!canProceed}
            onPress={() => setCurrentStep(2)}
          >
            <Text style={[styles.proceedText, !canProceed && styles.proceedTextDisabled]}>
              {!networkState.isConnected ? 'No Internet Connection' :
               !isPhoneValid ? 'Enter Valid Phone Number' :
               !selectedProvider ? 'Select Provider' :
               !selectedMeterType ? 'Select Meter Type' :
               !customerName ? 'Validate Meter Number' :
               !isAmountValid ? 'Enter Valid Amount' :
               !hasEnoughBalance ? 'Insufficient Balance' :
               `Review Purchase • ₦${amount ? amountNum.toLocaleString() : '0'}`}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* STEP 2: REVIEW */}
      {currentStep === 2 && (
        <ScrollView
          style={styles.scrollContent}
          contentContainerStyle={styles.scrollContentContainer}
          showsVerticalScrollIndicator={false}
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
                  ₦{(userBalance.total || userBalance.amount || 0).toLocaleString()}
                </Text>
                <Text style={styles.lastUpdated}>
                  Last updated: {new Date(userBalance.lastUpdated || Date.now()).toLocaleTimeString()}
                </Text>

                {/* Show balance after transaction */}
                {amountNum > 0 && (
                  <View style={styles.transactionPreview}>
                    <Text style={styles.previewLabel}>After purchase:</Text>
                    <Text style={[
                      styles.previewAmount,
                      ((userBalance.total || userBalance.amount || 0) - amountNum - (electricityProviders.find(p => p.id === selectedProvider)?.fee || 0)) < 0 ? 
                        styles.insufficientPreview : styles.sufficientPreview
                    ]}>
                      ₦{Math.max(0, 
                        (userBalance.total || userBalance.amount || 0) - 
                        amountNum - 
                        (electricityProviders.find(p => p.id === selectedProvider)?.fee || 0)
                      ).toLocaleString()}
                    </Text>
                  </View>
                )}

                {/* Insufficient balance warning */}
                {amountNum > (userBalance.total || userBalance.amount || 0) && (
                  <View style={styles.insufficientBalanceWarning}>
                    <Text style={styles.warningText}>
                      ⚠️ Insufficient balance for this transaction
                    </Text>
                    <TouchableOpacity 
                      style={styles.topUpBtn}
                      onPress={() => navigation?.navigate?.('TopUp')}
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

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Provider:</Text>
              <Text style={styles.summaryValue}>
                {electricityProviders.find(p => p.id === selectedProvider)?.acronym}
              </Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Meter Type:</Text>
              <Text style={styles.summaryValue}>
                {meterTypes.find(m => m.id === selectedMeterType)?.name}
              </Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Meter Number:</Text>
              <Text style={styles.summaryValue}>{meterNumber}</Text>
            </View>

            {customerName && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Customer:</Text>
                <Text style={styles.summaryValue}>{customerName}</Text>
              </View>
            )}

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Phone:</Text>
              <Text style={styles.summaryValue}>{phone}</Text>
            </View>

            <View style={styles.summaryDivider} />

            {amount && (
              <>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Amount:</Text>
                  <Text style={styles.summaryValue}>₦{amountNum.toLocaleString()}</Text>
                </View>

                {electricityProviders.find(p => p.id === selectedProvider)?.fee && (
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Transaction Fee:</Text>
                    <Text style={styles.summaryValue}>
                      ₦{electricityProviders.find(p => p.id === selectedProvider)?.fee}
                    </Text>
                  </View>
                )}

                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryLabel, styles.summaryTotalLabel]}>Total:</Text>
                  <Text style={[styles.summaryValue, styles.summaryTotal]}>
                    ₦{(
                      amountNum + 
                      (electricityProviders.find(p => p.id === selectedProvider)?.fee || 0)
                    ).toLocaleString()}
                  </Text>
                </View>
              </>
            )}

            {userBalance && amount && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Balance After:</Text>
                <Text style={[
                  styles.summaryValue, 
                  styles.summaryBalance,
                  ((userBalance.total || userBalance.amount || 0) - amountNum - (electricityProviders.find(p => p.id === selectedProvider)?.fee || 0)) < 0 ? 
                    styles.negativeBalance : {}
                ]}>
                  ₦{Math.max(0, 
                    (userBalance.total || userBalance.amount || 0) - 
                    amountNum - 
                    (electricityProviders.find(p => p.id === selectedProvider)?.fee || 0)
                  ).toLocaleString()}
                </Text>
              </View>
            )}
          </View>

          {/* Action Buttons */}
          <TouchableOpacity
            style={[
              styles.proceedBtn, 
              (!hasEnoughBalance || authError || !networkState.isConnected) && styles.proceedBtnDisabled
            ]}
            disabled={!hasEnoughBalance || !!authError || !networkState.isConnected}
            onPress={() => setCurrentStep(3)}
          >
            <Text style={[
              styles.proceedText,
              (!hasEnoughBalance || authError || !networkState.isConnected) && styles.proceedTextDisabled
            ]}>
              {authError ? 'Please Login First' : 
               !networkState.isConnected ? 'No Internet Connection' :
               !hasEnoughBalance ? 'Insufficient Balance' : 'Enter PIN to Pay'}
            </Text>
          </TouchableOpacity>

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
          contentContainerStyle={styles.scrollContentContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* PIN Status Checks */}
          {pinStatus?.isLocked && (
            <View style={styles.lockedCard}>
              <Text style={styles.lockedTitle}>🔒 Account Temporarily Locked</Text>
              <Text style={styles.lockedText}>
                Too many failed PIN attempts. Please wait {Math.ceil(pinStatus.lockTimeRemaining / 60)} minutes before trying again.
              </Text>
              <TouchableOpacity 
                style={styles.refreshStatusBtn}
                onPress={checkPinStatus}
              >
                <Text style={styles.refreshStatusBtnText}>Check Status</Text>
              </TouchableOpacity>
            </View>
          )}

          {!pinStatus?.isPinSet && !pinStatus?.isLocked && (
            <View style={styles.noPinCard}>
              <Text style={styles.noPinTitle}>📱 Transaction PIN Required</Text>
              <Text style={styles.noPinText}>
                You need to set up a 4-digit transaction PIN to make purchases. Please visit your account settings to create one.
              </Text>
              <TouchableOpacity 
                style={styles.setPinBtn}
                onPress={() => navigation?.navigate?.('SetPin')}
              >
                <Text style={styles.setPinBtnText}>Set PIN Now</Text>
              </TouchableOpacity>
            </View>
          )}

          {pinStatus?.isPinSet && !pinStatus?.isLocked && !authError && networkState.isConnected && (
            <>
              {/* Transaction Summary */}
              <View style={styles.pinSummaryCard}>
                <Text style={styles.pinSummaryTitle}>Confirm Your Purchase</Text>

                <View style={styles.summaryItem}>
                  <Text style={styles.summaryItemLabel}>Provider</Text>
                  <Text style={styles.summaryItemValue}>
                    {electricityProviders.find(p => p.id === selectedProvider)?.name}
                  </Text>
                </View>

                <View style={styles.summaryItem}>
                  <Text style={styles.summaryItemLabel}>Meter</Text>
                  <Text style={styles.summaryItemValue}>{meterNumber}</Text>
                </View>

                <View style={styles.summaryItem}>
                  <Text style={styles.summaryItemLabel}>Customer</Text>
                  <Text style={styles.summaryItemValue}>{customerName}</Text>
                </View>

                <View style={styles.summaryItem}>
                  <Text style={styles.summaryItemLabel}>Phone</Text>
                  <Text style={styles.summaryItemValue}>{phone}</Text>
                </View>

                <View style={[styles.summaryItem, styles.summaryItemTotal]}>
                  <Text style={styles.summaryItemLabel}>Total Amount</Text>
                  <Text style={styles.summaryItemValueTotal}>
                    ₦{(
                      amountNum + 
                      (electricityProviders.find(p => p.id === selectedProvider)?.fee || 0)
                    ).toLocaleString()}
                  </Text>
                </View>
              </View>

              {/* PIN Entry */}
              <View style={styles.pinCard}>
                <Text style={styles.pinTitle}>Enter Your Transaction PIN</Text>

                {pinStatus?.attemptsRemaining < 3 && pinStatus?.attemptsRemaining > 0 && (
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
                    placeholder="Enter PIN"
                    maxLength={4}
                    autoFocus={true}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>

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

                {pinError ? (
                  <Text style={styles.pinError}>{pinError}</Text>
                ) : (
                  <Text style={styles.pinHelp}>
                    Enter your 4-digit transaction PIN to complete this purchase
                  </Text>
                )}
              </View>

              {/* Confirm Payment Button */}
              <TouchableOpacity
                style={[
                  styles.proceedBtn,
                  (!isPinValid || isValidatingPin || isProcessingPayment) && styles.proceedBtnDisabled
                ]}
                disabled={!isPinValid || isValidatingPin || isProcessingPayment}
                onPress={validatePin}
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
                    Confirm Payment • ₦{amount ? (
                      amountNum + 
                      (electricityProviders.find(p => p.id === selectedProvider)?.fee || 0)
                    ).toLocaleString() : '0'}
                  </Text>
                )}
              </TouchableOpacity>
            </>
          )}

          {(authError || !networkState.isConnected) && (
            <View style={styles.errorCard}>
              <Text style={styles.errorCardTitle}>
                {authError ? '🔐 Authentication Required' : '📡 No Internet Connection'}
              </Text>
              <Text style={styles.errorCardText}>
                {authError || 'Please check your internet connection and try again.'}
              </Text>
              {authError && (
                <TouchableOpacity 
                  style={styles.errorCardButton}
                  onPress={() => {
                    setAuthError(null);
                    navigation?.navigate?.('Login');
                  }}
                >
                  <Text style={styles.errorCardButtonText}>Login Now</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Back Button */}
          <TouchableOpacity
            style={[styles.proceedBtn, styles.backBtn]}
            onPress={() => setCurrentStep(2)}
            disabled={isValidatingPin || isProcessingPayment}
          >
            <Text style={[styles.proceedText, styles.backBtnText]}>← Back to Review</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* Provider Selection Modal */}
      <Modal visible={showProvidersModal} animationType="slide" statusBarTranslucent={false}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Electricity Provider</Text>
            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setShowProvidersModal(false)}
            >
              <Text style={styles.modalCloseBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={electricityProviders.filter(p => p.isActive)}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.providerItem,
                  selectedProvider === item.id && styles.providerItemSelected
                ]}
                onPress={() => {
                  setSelectedProvider(item.id);
                  setShowProvidersModal(false);
                  // Reset dependent fields
                  setSelectedMeterType(null);
                  setMeterNumber('');
                  setCustomerName('');
                  setCustomerAddress('');
                  setCustomerAccountNumber('');
                  setMeterError('');
                }}
              >
                <View style={styles.providerInfo}>
                  <Text style={styles.providerName}>{item.name}</Text>
                  <Text style={styles.providerFullName}>{item.fullName}</Text>
                  <Text style={styles.providerDetails}>
                    ({item.acronym}) • Fee: ₦{item.fee} • Min: ₦{item.minAmount}
                  </Text>
                </View>
                {selectedProvider === item.id && (
                  <Text style={styles.selectedIcon}>✓</Text>
                )}
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No providers available</Text>
              </View>
            }
            showsVerticalScrollIndicator={false}
          />
        </View>
      </Modal>

      {/* Meter Type Selection Modal */}
      <Modal visible={showMeterTypeModal} animationType="slide" statusBarTranslucent={false}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Meter Type</Text>
            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setShowMeterTypeModal(false)}
            >
              <Text style={styles.modalCloseBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={meterTypes}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.meterTypeItem,
                  selectedMeterType === item.id && styles.meterTypeItemSelected
                ]}
                onPress={() => {
                  setSelectedMeterType(item.id);
                  setShowMeterTypeModal(false);
                  // Reset dependent fields
                  setMeterNumber('');
                  setCustomerName('');
                  setCustomerAddress('');
                  setCustomerAccountNumber('');
                  setMeterError('');
                }}
              >
                <View style={styles.meterTypeInfo}>
                  <Text style={styles.meterTypeName}>{item.name}</Text>
                  <Text style={styles.meterTypeDescription}>{item.description}</Text>
                </View>
                {selectedMeterType === item.id && (
                  <Text style={styles.selectedIcon}>✓</Text>
                )}
              </TouchableOpacity>
            )}
            showsVerticalScrollIndicator={false}
          />
        </View>
      </Modal>

      {/* Contacts Modal */}
      <Modal visible={showContactsModal} animationType="slide" statusBarTranslucent={false}>
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
                <Text style={styles.contactArrow}>→</Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No contacts found</Text>
              </View>
            }
            showsVerticalScrollIndicator={false}
          />
        </View>
      </Modal>

      {/* Recent Numbers Modal */}
      <Modal visible={showRecentsModal} animationType="slide" statusBarTranslucent={false}>
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
                style={styles.recentItem}
                onPress={() => handleContactSelect(item.number, item.name)}
              >
                <View style={styles.recentInfo}>
                  <Text style={styles.recentName}>
                    {item.name || 'Unknown'}
                  </Text>
                  <Text style={styles.recentNumber}>{item.number}</Text>
                </View>
                <View style={styles.recentMeta}>
                  <Text style={styles.recentTime}>
                    {new Date(item.timestamp).toLocaleDateString()}
                  </Text>
                  <Text style={styles.contactArrow}>→</Text>
                </View>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No recent numbers found</Text>
              </View>
            }
            showsVerticalScrollIndicator={false}
          />
        </View>
      </Modal>

      {/* Success Modal */}
      <ElectricitySuccessModal
        visible={showSuccessModal}
        onClose={handleCloseSuccessModal}
        onBuyMore={handleBuyMore}
        transaction={transactionResult || {
          _id: 'N/A',
          reference: 'N/A',
          status: 'successful',
          amount: amountNum || 0,
          fee: electricityProviders.find(p => p.id === selectedProvider)?.fee || 0,
          provider: selectedProvider || '',
          meterNumber: meterNumber,
          customerName: customerName,
          responseMessage: 'Payment completed successfully',
          createdAt: new Date().toISOString(),
        }}
        providerName={selectedProviderName || electricityProviders.find(p => p.id === selectedProvider)?.name || 'Unknown Provider'}
        phone={phone}
        meterNumber={meterNumber}
        customerName={customerName}
        customerAddress={customerAddress}
        amount={amountNum || 0}
        meterType={meterTypes.find(m => m.id === selectedMeterType)?.name || selectedMeterType || 'Unknown'}
        newBalance={updatedBalance}
      />
    </View>
  );
};

// Complete StyleSheet with Production-Ready Styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },

  // Header Styles
  header: {
    backgroundColor: '#ff3b30',
    paddingTop: Platform.OS === 'ios' ? 50 : 35,
    paddingBottom: 15,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  backButton: {
    padding: 5,
    marginLeft: -5,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '400',
  },
  headerText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
  },
  headerSpacer: {
    width: 34, // Same as back button width
  },
  networkErrorBanner: {
    backgroundColor: '#ff6b6b',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  networkErrorText: {
    color: '#fff',
    fontSize: 14,
    flex: 1,
    marginRight: 10,
  },
  retryButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  authErrorBanner: {
    backgroundColor: '#ff922b',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  authErrorText: {
    color: '#fff',
    fontSize: 14,
    flex: 1,
    marginRight: 10,
  },
  loginButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },

  // Step Indicator
  stepIndicator: {
    backgroundColor: '#fff',
    paddingVertical: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  stepDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#e9ecef',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotActive: {
    backgroundColor: '#ff3b30',
  },
  stepDotText: {
    color: '#adb5bd',
    fontWeight: '600',
    fontSize: 14,
  },
  stepDotTextActive: {
    color: '#fff',
  },
  stepLine: {
    height: 2,
    width: 60,
    backgroundColor: '#e9ecef',
    marginHorizontal: 4,
  },
  stepLineActive: {
    backgroundColor: '#ff3b30',
  },
  stepLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 40,
  },
  stepLabel: {
    color: '#adb5bd',
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
    minWidth: 80,
  },
  stepLabelActive: {
    color: '#ff3b30',
    fontWeight: '600',
  },

  // Scroll Content
  scrollContent: {
    flex: 1,
  },
  scrollContentContainer: {
    padding: 16,
    paddingBottom: 30,
  },

  // Section Styles
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2b2d42',
    marginBottom: 8,
  },
  helperText: {
    fontSize: 13,
    color: '#6c757d',
    marginTop: 4,
    fontStyle: 'italic',
  },

  // Button Row
  buttonRow: {
    flexDirection: 'row',
    marginHorizontal: -6,
  },
  actionBtn: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#dee2e6',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  actionBtnIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  actionBtnText: {
    fontSize: 12,
    color: '#495057',
    fontWeight: '500',
    textAlign: 'center',
  },

  // Input Styles
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#dee2e6',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#2b2d42',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  inputError: {
    borderColor: '#ff6b6b',
  },
  inputSuccess: {
    borderColor: '#51cf66',
  },
  inputContainer: {
    position: 'relative',
  },
  inputLoader: {
    position: 'absolute',
    right: 16,
    top: 16,
  },
  errorText: {
    color: '#ff6b6b',
    fontSize: 13,
    marginTop: 4,
  },
  successText: {
    color: '#51cf66',
    fontSize: 13,
    marginTop: 4,
    fontWeight: '500',
  },

  // Selector Styles
  selector: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#dee2e6',
    borderRadius: 12,
    padding: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  selectorContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectorText: {
    fontSize: 16,
    color: '#adb5bd',
    flex: 1,
    marginRight: 8,
  },
  selectorTextSelected: {
    color: '#2b2d42',
  },
  dropdownArrow: {
    color: '#adb5bd',
    fontSize: 12,
  },

  // Customer Info
  customerInfo: {
    backgroundColor: '#f8f9fa',
    borderLeftWidth: 3,
    borderLeftColor: '#51cf66',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  customerName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2b2d42',
    marginTop: 4,
  },
  customerAddress: {
    fontSize: 13,
    color: '#6c757d',
    marginTop: 2,
  },
  customerAccount: {
    fontSize: 13,
    color: '#6c757d',
    marginTop: 2,
  },

  // Amount Styles
  amountInput: {
    fontSize: 18,
    fontWeight: '600',
  },
  amountInfo: {
    marginTop: 8,
  },
  amountDisplay: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2b2d42',
    marginTop: 4,
  },
  feeInfo: {
    fontSize: 13,
    color: '#6c757d',
    marginTop: 2,
  },

  // Quick Amount Buttons
  quickAmountRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
    marginTop: -8,
  },
  quickAmountBtn: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#dee2e6',
    borderRadius: 8,
    padding: 12,
    margin: 4,
    minWidth: '22%',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  quickAmountBtnActive: {
    backgroundColor: '#ff3b30',
    borderColor: '#ff3b30',
  },
  quickAmountText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#495057',
  },
  quickAmountTextActive: {
    color: '#fff',
  },

  // Proceed Button
  proceedBtn: {
    backgroundColor: '#ff3b30',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  proceedBtnDisabled: {
    backgroundColor: '#adb5bd',
    opacity: 0.7,
  },
  proceedText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  proceedTextDisabled: {
    color: '#f8f9fa',
  },
  backBtn: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  backBtnText: {
    color: '#6c757d',
  },

  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Balance Card
  balanceCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
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
    color: '#2b2d42',
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

  // Summary Card
  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2b2d42',
    marginBottom: 16,
    textAlign: 'center',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 15,
    color: '#6c757d',
  },
  summaryValue: {
    fontSize: 15,
    fontWeight: '500',
    color: '#2b2d42',
  },
  summaryTotalLabel: {
    fontWeight: '600',
  },
  summaryTotal: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ff3b30',
  },
  summaryBalance: {
    fontSize: 16,
    fontWeight: '600',
    color: '#28a745',
  },
  negativeBalance: {
    color: '#dc3545',
  },
  summaryDivider: {
    height: 1,
    backgroundColor: '#e9ecef',
    marginVertical: 16,
  },

  // PIN Related Styles
  lockedCard: {
    backgroundColor: '#fff3bf',
    borderLeftWidth: 4,
    borderLeftColor: '#fcc419',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  lockedTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#e67700',
    marginBottom: 8,
  },
  lockedText: {
    color: '#e67700',
    fontSize: 14,
    marginBottom: 12,
  },
  refreshStatusBtn: {
    backgroundColor: '#fcc419',
    padding: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  refreshStatusBtnText: {
    color: '#2b2d42',
    fontWeight: '600',
  },
  noPinCard: {
    backgroundColor: '#e7f5ff',
    borderLeftWidth: 4,
    borderLeftColor: '#339af0',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  noPinTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1971c2',
    marginBottom: 8,
  },
  noPinText: {
    color: '#1971c2',
    fontSize: 14,
    marginBottom: 12,
  },
  setPinBtn: {
    backgroundColor: '#339af0',
    padding: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  setPinBtnText: {
    color: '#fff',
    fontWeight: '600',
  },
  pinSummaryCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
    borderTopWidth: 4,
    borderTopColor: '#ff3b30',
  },
  pinSummaryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2b2d42',
    marginBottom: 16,
    textAlign: 'center',
  },
  summaryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryItemLabel: {
    fontSize: 15,
    color: '#6c757d',
  },
  summaryItemValue: {
    fontSize: 15,
    fontWeight: '500',
    color: '#2b2d42',
  },
  summaryItemTotal: {
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
    paddingTop: 12,
    marginTop: 4,
  },
  summaryItemValueTotal: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ff3b30',
  },
  pinCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  pinTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2b2d42',
    marginBottom: 16,
  },
  attemptsWarning: {
    color: '#ff922b',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 16,
    textAlign: 'center',
  },
  pinInputContainer: {
    width: '100%',
    marginBottom: 16,
  },
  pinInput: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#dee2e6',
    borderRadius: 12,
    padding: 16,
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 8,
    color: '#2b2d42',
  },
  pinInputError: {
    borderColor: '#ff6b6b',
  },
  pinDotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 16,
  },
  pinDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#e9ecef',
    marginHorizontal: 8,
  },
  pinDotFilled: {
    backgroundColor: '#ff3b30',
  },
  pinDotError: {
    backgroundColor: '#ff6b6b',
  },
  pinError: {
    color: '#ff6b6b',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 8,
  },
  pinHelp: {
    color: '#6c757d',
    fontSize: 14,
    textAlign: 'center',
  },
  errorCard: {
    backgroundColor: '#ffe3e3',
    borderLeftWidth: 4,
    borderLeftColor: '#ff6b6b',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  errorCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#c92a2a',
    marginBottom: 8,
  },
  errorCardText: {
    color: '#c92a2a',
    fontSize: 14,
    marginBottom: 12,
  },
  errorCardButton: {
    backgroundColor: '#ff6b6b',
    padding: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  errorCardButtonText: {
    color: '#fff',
    fontWeight: '600',
  },

  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
    backgroundColor: '#fff',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2b2d42',
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalCloseBtnText: {
    fontSize: 20,
    color: '#6c757d',
  },
  providerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
    backgroundColor: '#fff',
  },
  providerItemSelected: {
    backgroundColor: '#f8f9fa',
  },
  providerInfo: {
    flex: 1,
    marginRight: 12,
  },
  providerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2b2d42',
    marginBottom: 2,
  },
  providerFullName: {
    fontSize: 14,
    color: '#6c757d',
    marginBottom: 2,
  },
  providerDetails: {
    fontSize: 12,
    color: '#adb5bd',
  },
  meterTypeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
    backgroundColor: '#fff',
  },
  meterTypeItemSelected: {
    backgroundColor: '#f8f9fa',
  },
  meterTypeInfo: {
    flex: 1,
    marginRight: 12,
  },
  meterTypeName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2b2d42',
    marginBottom: 4,
  },
  meterTypeDescription: {
    fontSize: 14,
    color: '#6c757d',
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
    backgroundColor: '#ffffff',
},
contactInfo: {
flex: 1,
marginRight: 12,
},
contactName: {
fontSize: 16,
fontWeight: '600',
color: '#2b2d42',
marginBottom: 2,
},
contactNumber: {
fontSize: 14,
color: '#6c757d',
},
contactArrow: {
color: '#adb5bd',
fontSize: 16,
},
recentItem: {
flexDirection: 'row',
alignItems: 'center',
justifyContent: 'space-between',
padding: 16,
borderBottomWidth: 1,
borderBottomColor: '#e9ecef',
backgroundColor: '#fff',
},
recentInfo: {
flex: 1,
marginRight: 12,
},
recentName: {
fontSize: 16,
fontWeight: '600',
color: '#2b2d42',
marginBottom: 2,
},
recentNumber: {
fontSize: 14,
color: '#6c757d',
},
recentMeta: {
alignItems: 'flex-end',
},
recentTime: {
fontSize: 12,
color: '#adb5bd',
marginBottom: 4,
},
selectedIcon: {
color: '#51cf66',
fontSize: 18,
fontWeight: '600',
},
emptyContainer: {
padding: 40,
alignItems: 'center',
justifyContent: 'center',
},
emptyText: {
color: '#adb5bd',
fontSize: 16,
textAlign: 'center',
},

overlay: {
flex: 1,
backgroundColor: 'rgba(0,0,0,0.7)',
justifyContent: 'center',
alignItems: 'center',
padding: 20,
},
modalContainer: {
backgroundColor: '#fff',
borderRadius: 20,
padding: 24,
width: '100%',
maxWidth: 400,
maxHeight: '90%',
},
iconContainer: {
alignItems: 'center',
marginBottom: 16,
},
successIcon: {
fontSize: 60,
marginBottom: 8,
},
title: {
fontSize: 24,
fontWeight: '700',
color: '#2b2d42',
textAlign: 'center',
marginBottom: 8,
},
subtitle: {
fontSize: 16,
color: '#6c757d',
textAlign: 'center',
marginBottom: 24,
},
detailsContainer: {
marginBottom: 20,
},
detailRow: {
flexDirection: 'row',
justifyContent: 'space-between',
alignItems: 'center',
marginBottom: 8,
paddingVertical: 4,
},
detailLabel: {
fontSize: 14,
color: '#6c757d',
fontWeight: '500',
},
detailValue: {
fontSize: 14,
color: '#2b2d42',
fontWeight: '500',
textAlign: 'right',
flex: 1,
marginLeft: 8,
},
balanceRow: {
borderTopWidth: 1,
borderTopColor: '#e9ecef',
paddingTop: 12,
marginTop: 4,
},
balanceValue: {
color: '#51cf66',
fontWeight: '700',
fontSize: 16,
},
thankYou: {
fontSize: 16,
color: '#51cf66',
fontWeight: '600',
textAlign: 'center',
marginBottom: 24,
padding: 12,
backgroundColor: '#ebfbee',
borderRadius: 12,
},
buttonContainer: {
marginTop: 8,
},
button: {
borderRadius: 12,
padding: 16,
alignItems: 'center',
justifyContent: 'center',
marginBottom: 12,
},
shareButton: {
backgroundColor: '#339af0',
},
buyMoreButton: {
backgroundColor: '#ff922b',
},
doneButton: {
backgroundColor: '#495057',
},
shareText: {
color: '#fff',
fontSize: 16,
fontWeight: '600',
},
buyMoreText: {
color: '#fff',
fontSize: 16,
fontWeight: '600',
},
doneText: {
color: '#fff',
fontSize: 16,
fontWeight: '600',
},
});

export default BuyElectricity;