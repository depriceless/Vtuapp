import React, { useState, useEffect } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView, Alert 
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

// ✅ IMPROVED: Better TypeScript interfaces
type PaymentMethod = 'palmpay' | 'wema' | 'sterling' | 'manual' | 'card';

interface BankData {
  bankName: string;
  accountName: string;
  accountNumber: string;
  reference?: string;
}

interface CardInfo {
  cardNumber: string;
  expiry: string;
  cvv: string;
}

interface FundWalletProps {
  onClose?: () => void;
  onSuccess?: () => void;
  token?: string;
  currentBalance?: number;
}

// ✅ NEW: API Configuration - centralized and easily configurable
const API_CONFIG = {
  BASE_URL: 'https://your-backend.com/api', // Replace with actual API URL
  ENDPOINTS: {
    PAYMENT_METHODS: '/payment-methods',
    CREATE_ACCOUNT: '/create-account',
    PAY_CARD: '/pay-card',
    FUND_WALLET: '/fund-wallet'
  }
};

// ✅ NEW: Payment method configurations
const PAYMENT_METHODS = [
  { id: 'palmpay', label: 'PALMPAY', icon: 'card-outline' },
  { id: 'wema', label: 'WEMA BANK', icon: 'business-outline' },
  { id: 'sterling', label: 'STERLING', icon: 'business-outline' },
  { id: 'manual', label: 'BANK TRANSFER', icon: 'swap-horizontal-outline' },
  { id: 'card', label: 'DEBIT CARD', icon: 'card-outline' }
] as const;

const FundWallet: React.FC<FundWalletProps> = ({ 
  onClose, 
  onSuccess, 
  token, 
  currentBalance = 0 
}) => {
  // ✅ IMPROVED: Better state management with proper typing
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('palmpay');
  const [loading, setLoading] = useState(false);
  const [fetchingPaymentInfo, setFetchingPaymentInfo] = useState(false);
  const [bankData, setBankData] = useState<BankData | null>(null);
  const [cardInfo, setCardInfo] = useState<CardInfo>({ cardNumber: '', expiry: '', cvv: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // ✅ NEW: Input validation helpers
  const validateAmount = (value: string): boolean => {
    const numericAmount = Number(value);
    return value.trim() !== '' && !isNaN(numericAmount) && numericAmount > 0 && numericAmount <= 1000000;
  };

  const validateCardNumber = (cardNumber: string): boolean => {
    const cleaned = cardNumber.replace(/\s/g, '');
    return /^\d{13,19}$/.test(cleaned);
  };

  const validateExpiry = (expiry: string): boolean => {
    const regex = /^(0[1-9]|1[0-2])\/\d{2}$/;
    if (!regex.test(expiry)) return false;

    const [month, year] = expiry.split('/');
    const currentYear = new Date().getFullYear() % 100;
    const currentMonth = new Date().getMonth() + 1;
    const expYear = parseInt(year);
    const expMonth = parseInt(month);

    if (expYear < currentYear) return false;
    if (expYear === currentYear && expMonth < currentMonth) return false;

    return true;
  };

  const validateCVV = (cvv: string): boolean => {
    return /^\d{3,4}$/.test(cvv);
  };

  // ✅ IMPROVED: Better API error handling
  const makeAPICall = async (url: string, options: RequestInit) => {
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
          ...options.headers,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('API call failed:', error);
      throw error;
    }
  };

  // ✅ IMPROVED: Fetch dynamic payment method info with better error handling
  useEffect(() => {
    const fetchPaymentMethodInfo = async () => {
      if (!['wema', 'sterling', 'palmpay'].includes(paymentMethod)) {
        setBankData(null);
        return;
      }

      setFetchingPaymentInfo(true);
      try {
        const data = await makeAPICall(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.PAYMENT_METHODS}`, {
          method: 'GET',
        });

        const methodInfo = data.find((m: any) => m.method === paymentMethod);
        if (methodInfo) {
          setBankData({
            bankName: methodInfo.bankName,
            accountName: methodInfo.accountName,
            accountNumber: methodInfo.accountNumber,
            reference: methodInfo.reference,
          });
        } else {
          setBankData(null);
        }
      } catch (error) {
        console.log('Error fetching payment methods:', error);
        setBankData(null);
      } finally {
        setFetchingPaymentInfo(false);
      }
    };

    fetchPaymentMethodInfo();
  }, [paymentMethod, token]);

  // ✅ NEW: Format card number with spaces for better UX
  const formatCardNumber = (text: string): string => {
    const cleaned = text.replace(/\s/g, '');
    const match = cleaned.match(/.{1,4}/g);
    return match ? match.join(' ').substr(0, 19) : cleaned;
  };

  // ✅ NEW: Format expiry date
  const formatExpiry = (text: string): string => {
    const cleaned = text.replace(/\D/g, '');
    if (cleaned.length >= 2) {
      return cleaned.substring(0, 2) + '/' + cleaned.substring(2, 4);
    }
    return cleaned;
  };

  // ✅ IMPROVED: Enhanced validation and error handling
  const handleFundWallet = async () => {
    const numericAmount = Number(amount);

    // Clear previous messages
    setError('');
    setSuccess('');

    // Validate amount
    if (!validateAmount(amount)) {
      setError('Please enter a valid amount (₦1 - ₦1,000,000)');
      return;
    }

    // Validate card info if card payment
    if (paymentMethod === 'card') {
      if (!validateCardNumber(cardInfo.cardNumber)) {
        setError('Please enter a valid card number');
        return;
      }
      if (!validateExpiry(cardInfo.expiry)) {
        setError('Please enter a valid expiry date (MM/YY)');
        return;
      }
      if (!validateCVV(cardInfo.cvv)) {
        setError('Please enter a valid CVV (3-4 digits)');
        return;
      }
    }

    setLoading(true);

    try {
      if (['wema', 'sterling', 'palmpay'].includes(paymentMethod)) {
        // ✅ IMPROVED: Create virtual account with better data handling
        const response = await makeAPICall(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.CREATE_ACCOUNT}`, {
          method: 'POST',
          body: JSON.stringify({
            bank: paymentMethod.toUpperCase(),
            amount: numericAmount,
            customer_email: 'user@example.com', // ✅ TODO: Replace with real user email from props/context
            customer_name: 'John Doe',          // ✅ TODO: Replace with real user name from props/context
          }),
        });

        if (response.status === 'success' || response.success) {
          const accountData = {
            bankName: response.data.bank_name || `${paymentMethod.toUpperCase()} Bank`,
            accountName: response.data.account_name,
            accountNumber: response.data.account_number,
            reference: response.data.reference,
          };

          setBankData(accountData);
          setSuccess(`Virtual account created! Transfer ₦${numericAmount.toLocaleString()} to account: ${response.data.account_number}`);

          // ✅ NEW: Auto-close after successful account creation (optional)
          setTimeout(() => {
            if (onSuccess) onSuccess();
          }, 3000);

        } else {
          setError(response.message || 'Failed to create virtual account. Please try again.');
        }

      } else if (paymentMethod === 'card') {
        // ✅ IMPROVED: Process card payment with better validation
        const [expiry_month, expiry_year] = cardInfo.expiry.split('/');
        const cleanedCardNumber = cardInfo.cardNumber.replace(/\s/g, '');

        const response = await makeAPICall(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.PAY_CARD}`, {
          method: 'POST',
          body: JSON.stringify({
            amount: numericAmount,
            card_number: cleanedCardNumber,
            cvv: cardInfo.cvv,
            expiry_month,
            expiry_year: `20${expiry_year}`, // Convert YY to YYYY
            email: 'user@example.com', // ✅ TODO: Replace with real user email
          }),
        });

        if (response.status === 'success' || response.success) {
          setSuccess(`Wallet funded successfully with ₦${numericAmount.toLocaleString()}! Card ending in ${cleanedCardNumber.slice(-4)}`);

          // ✅ NEW: Show success and auto-close
          setTimeout(() => {
            if (onSuccess) onSuccess();
          }, 2000);

        } else {
          setError(response.message || 'Card payment failed. Please check your card details and try again.');
        }

      } else if (paymentMethod === 'manual') {
        // ✅ IMPROVED: Better manual transfer instructions
        Alert.alert(
          'Manual Bank Transfer',
          'Please transfer the amount to any of our bank accounts and your wallet will be credited automatically.',
          [
            { text: 'OK', style: 'default' }
          ]
        );
        setSuccess('Please use bank transfer to fund your wallet. Check our bank details above.');
      }

    } catch (error: any) {
      console.error('Fund wallet error:', error);
      setError('Network error occurred. Please check your connection and try again.');
    } finally {
      setLoading(false);
      // ✅ IMPROVED: Clear form only on success
      if (!error) {
        setAmount('');
        setCardInfo({ cardNumber: '', expiry: '', cvv: '' });
      }
    }
  };

  // ✅ NEW: Quick amount buttons for better UX
  const quickAmounts = [500, 1000, 2000, 5000, 10000];

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      {/* ✅ UPDATED: Simple header without close button */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Fund Wallet</Text>
      </View>

      {/* ✅ NEW: Current balance display */}
      {currentBalance > 0 && (
        <View style={styles.balanceCard}>
          
        </View>
      )}

      <Text style={styles.juicyText}>Top up now and enjoy seamless payments!</Text>

      {/* ✅ NEW: Quick amount buttons */}
      <View style={styles.quickAmountsContainer}>
        <Text style={styles.quickAmountsLabel}>Quick Select</Text>
        <View style={styles.quickAmountsRow}>
          {quickAmounts.map((quickAmount) => (
            <TouchableOpacity
              key={quickAmount}
              style={[styles.quickAmountButton, amount === quickAmount.toString() && styles.quickAmountButtonActive]}
              onPress={() => {
                setAmount(quickAmount.toString());
                setError('');
                setSuccess('');
              }}
            >
              <Text style={[styles.quickAmountText, amount === quickAmount.toString() && styles.quickAmountTextActive]}>
                ₦{quickAmount.toLocaleString()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* ✅ IMPROVED: Amount input with better formatting */}
      <TextInput
        style={[styles.input, error && error.includes('amount') && styles.inputError]}
        placeholder="Enter amount (₦1 - ₦1,000,000)"
        placeholderTextColor="#aaa"
        keyboardType="numeric"
        value={amount}
        onChangeText={(text) => { 
          const numericText = text.replace(/[^0-9]/g, '');
          setAmount(numericText); 
          setError(''); 
          setSuccess(''); 
        }}
      />

      {/* ✅ IMPROVED: Error and success messages */}
      {error ? <Text style={styles.errorText}>⚠️ {error}</Text> : null}
      {success ? <Text style={styles.successText}>✅ {success}</Text> : null}

      {/* ✅ IMPROVED: Payment method selection */}
      <View style={styles.methodContainer}>
        <Text style={styles.methodLabel}>Select Payment Method</Text>
        <View style={styles.methodGrid}>
          {PAYMENT_METHODS.map((method) => (
            <TouchableOpacity
              key={method.id}
              style={[styles.methodButton, paymentMethod === method.id && styles.methodButtonActive]}
              onPress={() => {
                setPaymentMethod(method.id as PaymentMethod);
                setError('');
                setSuccess('');
                setBankData(null);
              }}
            >
              <Ionicons 
                name={method.icon as any} 
                size={20} 
                color={paymentMethod === method.id ? '#ff3b30' : '#666'} 
              />
              <Text style={[styles.methodText, paymentMethod === method.id && styles.methodTextActive]}>
                {method.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* ✅ IMPROVED: Bank account display with loading state */}
      {['wema', 'sterling', 'palmpay'].includes(paymentMethod) && (
        <View style={styles.bankCard}>
          {fetchingPaymentInfo ? (
            <View style={styles.bankCardLoading}>
              <ActivityIndicator color="#fff" size="small" />
              <Text style={styles.bankCardLoadingText}>Getting account details...</Text>
            </View>
          ) : bankData ? (
            <>
              <Text style={styles.bankCardTitle}>Transfer Details</Text>
              <Text style={styles.bankCardText}>Bank: {bankData.bankName}</Text>
              <Text style={styles.bankCardText}>Account Name: {bankData.accountName}</Text>
              <Text style={styles.bankCardText}>Account Number: {bankData.accountNumber}</Text>
              {bankData.reference && (
                <Text style={styles.bankCardText}>Reference: {bankData.reference}</Text>
              )}
              <Text style={styles.bankCardNote}>
                Transfer exactly ₦{amount ? Number(amount).toLocaleString() : '0'} to this account
              </Text>
            </>
          ) : (
            <Text style={styles.bankCardText}>Account details will appear here</Text>
          )}
        </View>
      )}

      {/* ✅ IMPROVED: Card input with better formatting and validation */}
      {paymentMethod === 'card' && (
        <View style={styles.cardContainer}>
          <Text style={styles.cardLabel}>Enter Card Details</Text>
          <TextInput
            style={[styles.input, error && error.includes('card') && styles.inputError]}
            placeholder="1234 5678 9012 3456"
            value={cardInfo.cardNumber}
            keyboardType="numeric"
            maxLength={19}
            onChangeText={(text) => {
              const formatted = formatCardNumber(text);
              setCardInfo({...cardInfo, cardNumber: formatted});
              setError('');
            }}
          />
          <View style={styles.cardRow}>
            <TextInput
              style={[styles.inputHalf, error && error.includes('expiry') && styles.inputError]}
              placeholder="MM/YY"
              value={cardInfo.expiry}
              keyboardType="numeric"
              maxLength={5}
              onChangeText={(text) => {
                const formatted = formatExpiry(text);
                setCardInfo({...cardInfo, expiry: formatted});
                setError('');
              }}
            />
            <TextInput
              style={[styles.inputHalf, error && error.includes('CVV') && styles.inputError]}
              placeholder="CVV"
              value={cardInfo.cvv}
              keyboardType="numeric"
              maxLength={4}
              secureTextEntry
              onChangeText={(text) => {
                const numericText = text.replace(/[^0-9]/g, '');
                setCardInfo({...cardInfo, cvv: numericText});
                setError('');
              }}
            />
          </View>
        </View>
      )}

      {/* ✅ IMPROVED: Fund button with better states */}
      <TouchableOpacity 
        style={[styles.fundButton, loading && styles.fundButtonLoading]} 
        onPress={handleFundWallet} 
        disabled={loading || !amount}
      >
        {loading ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Ionicons name="add-circle-outline" size={20} color="#fff" />
        )}
        <Text style={styles.fundButtonText}>
          {loading ? 'Processing...' : `Fund Wallet${amount ? ` (₦${Number(amount).toLocaleString()})` : ''}`}
        </Text>
      </TouchableOpacity>

      {/* ✅ NEW: Help text */}
      <Text style={styles.helpText}>
        Your wallet will be credited automatically after successful payment verification.
      </Text>
    </ScrollView>
  );
};

export default FundWallet;

const styles = StyleSheet.create({
  scroll: { 
    flex: 1, 
    backgroundColor: '#f2f2f7' 
  },
  container: { 
    padding: 20, 
    paddingBottom: 50 
  },
  // ✅ UPDATED: Simplified header without close button
  header: { 
    width: '110%', 
    backgroundColor: '#ff3b30', 
    paddingVertical: 22, 
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 5,
    marginBottom: 20,
    marginLeft : -18.5,
    marginTop : -18,
  },
  headerTitle: { 
    color: '#fff', 
    fontSize: 26, 
    fontWeight: 'bold',
    textAlign: 'center'
  },

  balanceLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
 
  juicyText: { 
    marginBottom: 25, 
    textAlign: 'center', 
    color: '#ff3b30', 
    fontSize: 16, 
    fontWeight: '600' 
  },
  quickAmountsContainer: {
    marginBottom: 20,
  },
  quickAmountsLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom:25,
  },
  quickAmountsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickAmountButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  quickAmountButtonActive: {
    backgroundColor: '#ffe5e0',
    borderColor: '#ff3b30',
  },
  quickAmountText: {
    fontSize: 12,
    color: '#333',
    fontWeight: '600',
  },
  quickAmountTextActive: {
    color: '#ff3b30',
  },
  input: { 
    marginTop: 10,
    marginBottom: 10,
    borderWidth: 1, 
    borderColor: '#ddd', 
    borderRadius: 12, 
    padding: 16, 
    backgroundColor: '#fff', 
    fontSize: 16, 
    color: '#333' 
  },
  inputError: {
    borderColor: '#ff3b30',
    borderWidth: 2,
  },
  inputHalf: {
    flex: 1,
    marginTop: 10,
    marginBottom: 10,
    marginHorizontal: 4,
    borderWidth: 1, 
    borderColor: '#ddd', 
    borderRadius: 12, 
    padding: 16, 
    backgroundColor: '#fff', 
    fontSize: 16, 
    color: '#333'
  },
  errorText: { 
    color: '#ff3b30', 
    marginTop: 5, 
    fontSize: 13,
    textAlign: 'center',
    fontWeight: '500'
  },
  successText: { 
    color: '#34c759', 
    marginTop: 5, 
    fontSize: 14, 
    fontWeight: '600',
    textAlign: 'center'
  },
  methodContainer: {
    marginTop: 25,
    marginBottom: 25,
  },
  methodLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  methodGrid: {
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    gap: 8,
  },
  methodButton: { 
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderWidth: 1, 
    borderColor: '#ddd', 
    borderRadius: 12, 
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '48%',
    gap: 8,
  },
  methodButtonActive: { 
    backgroundColor: '#ffe5e0', 
    borderColor: '#ff3b30' 
  },
  methodText: { 
    fontWeight: '600', 
    textAlign: 'center', 
    color: '#333', 
    fontSize: 12 
  },
  methodTextActive: { 
    color: '#ff3b30', 
    fontWeight: '700' 
  },
  bankCard: { 
    marginTop: 20,
    marginBottom: 20,
    padding: 20, 
    borderRadius: 12, 
    backgroundColor: '#ff3b30' 
  },
  bankCardLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  bankCardLoadingText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  bankCardTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  bankCardText: { 
    color: '#fff', 
    fontSize: 14, 
    marginBottom: 8, 
    fontWeight: '600' 
  },
  bankCardNote: {
    color: '#ffe5e0',
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 8,
    textAlign: 'center',
  },
  cardContainer: { 
    marginTop: 25,
    marginBottom: 20,
  },
  cardLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  cardRow: {
    flexDirection: 'row',
    gap: 8,
  },
  fundButton: { 
    flexDirection: 'row', 
    backgroundColor: '#ff3b30', 
    padding: 16, 
    borderRadius: 12, 
    justifyContent: 'center', 
    alignItems: 'center',
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
    gap: 10,
  },
  fundButtonLoading: {
    opacity: 0.7,
  },
  fundButtonText: { 
    color: '#fff', 
    fontWeight: '700', 
    fontSize: 16 
  },
  helpText: {
    textAlign: 'center',
    color: '#666',
    fontSize: 12,
    marginTop: 20,
    fontStyle: 'italic',
  },
});