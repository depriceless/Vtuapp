import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Platform,
  ScrollView,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Your API base URL
const API_BASE_URL = 'http://localhost:5000/api';


export default function PinSetupScreen() {
  const router = useRouter();
  const { userToken, userName } = useLocalSearchParams();

  const [currentStep, setCurrentStep] = useState<1 | 2>(1); // 1: Create PIN, 2: Confirm PIN
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const isPinValid = pin.length === 4 && /^\d{4}$/.test(pin);
  const isConfirmPinValid = confirmPin.length === 4 && /^\d{4}$/.test(confirmPin);
  const pinsMatch = pin === confirmPin && pin.length === 4;

  // API request helper
  const makeApiRequest = async (endpoint: string, options: any = {}) => {
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers: {
          'Authorization': `Bearer ${userToken}`,
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      return data;
    } catch (error) {
      console.error(`API Error for ${endpoint}:`, error);
      throw error;
    }
  };

  const handleCreatePin = () => {
    if (!isPinValid) {
      setError('PIN must be exactly 4 digits');
      return;
    }

    // Check for weak PINs
    const weakPins = ['0000', '1234', '1111', '2222', '3333', '4444', '5555', '6666', '7777', '8888', '9999'];
    if (weakPins.includes(pin)) {
      Alert.alert(
        'Weak PIN Detected',
        'Please choose a stronger PIN. Avoid sequential numbers or repeated digits.',
        [{ text: 'OK' }]
      );
      return;
    }

    setError('');
    setCurrentStep(2);
  };

  const handleConfirmPin = async () => {
    if (!isConfirmPinValid) {
      setError('Confirmation PIN must be exactly 4 digits');
      return;
    }

    if (!pinsMatch) {
      setError('PINs do not match. Please try again.');
      setConfirmPin('');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const response = await makeApiRequest('/auth/setup-pin', {
        method: 'POST',
        body: JSON.stringify({
          pin: pin,
          confirmPin: confirmPin,
        }),
      });

      // Check response and proceed
      console.log('PIN setup response:', response);

      if (response.success) {
        // Store PIN setup status and token locally
        await AsyncStorage.setItem('isPinSetup', 'true');
        await AsyncStorage.setItem('userToken', userToken as string);

        // Navigate immediately without alert
        router.replace('/dashboard');

        // Show success message after navigation
        setTimeout(() => {
          Alert.alert(
            'PIN Setup Complete!',
            'Your transaction PIN has been set successfully.'
          );
        }, 500);
      }
    } catch (error) {
      console.error('PIN setup error:', error);

      if (error.message.includes('already set')) {
        setError('PIN has already been set up for this account.');
      } else if (error.message.includes('Invalid')) {
        setError('Invalid PIN format. Please try again.');
      } else {
        setError('Failed to set up PIN. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBackToCreatePin = () => {
    setCurrentStep(1);
    setConfirmPin('');
    setError('');
  };

  const renderPinDots = (currentPin: string) => {
    return (
      <View style={styles.pinDotsContainer}>
        {[0, 1, 2, 3].map((index) => (
          <View
            key={index}
            style={[
              styles.pinDot,
              currentPin.length > index && styles.pinDotFilled,
              error && styles.pinDotError
            ]}
          />
        ))}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerText}>Setup Transaction PIN</Text>
        <Text style={styles.headerSubtext}>
          {currentStep === 1 ? 'Step 1 of 2' : 'Step 2 of 2'}
        </Text>
      </View>

      <ScrollView 
        style={styles.content}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Welcome Message */}
        <View style={styles.welcomeCard}>
          <Text style={styles.welcomeTitle}>🔒 Secure Your Account</Text>
          <Text style={styles.welcomeText}>
            {userName ? `Welcome ${userName}! ` : ''}Set up a 4-digit PIN to secure your transactions. This PIN will be required for all purchases and wallet operations.
          </Text>
        </View>

        {currentStep === 1 && (
          <>
            {/* Create PIN Step */}
            <View style={styles.pinCard}>
              <Text style={styles.pinTitle}>Create Your 4-Digit PIN</Text>
              <Text style={styles.pinSubtitle}>
                Choose a secure PIN that you'll remember
              </Text>

              <View style={styles.pinInputContainer}>
                <TextInput
                  style={[styles.pinInput, error && styles.pinInputError]}
                  value={pin}
                  onChangeText={(text) => {
                    setPin(text.replace(/\D/g, '').substring(0, 4));
                    setError('');
                  }}
                  keyboardType="numeric"
                  secureTextEntry={true}
                  placeholder="****"
                  maxLength={4}
                  autoFocus={true}
                />
              </View>

              {renderPinDots(pin)}

              {error ? (
                <Text style={styles.errorText}>{error}</Text>
              ) : (
                <Text style={styles.helpText}>
                  Enter a 4-digit number. Avoid obvious combinations like 1234 or 0000.
                </Text>
              )}
            </View>

            {/* Security Tips */}
            <View style={styles.tipsCard}>
              <Text style={styles.tipsTitle}>💡 PIN Security Tips</Text>
              <Text style={styles.tipItem}>• Use a unique combination that's easy for you to remember</Text>
              <Text style={styles.tipItem}>• Avoid sequential numbers (1234, 4321)</Text>
              <Text style={styles.tipItem}>• Avoid repeated digits (1111, 2222)</Text>
              <Text style={styles.tipItem}>• Don't use your birthday or phone number</Text>
            </View>

            <TouchableOpacity
              style={[styles.proceedBtn, !isPinValid && styles.proceedDisabled]}
              disabled={!isPinValid}
              onPress={handleCreatePin}
            >
              <Text style={styles.proceedText}>Continue</Text>
            </TouchableOpacity>
          </>
        )}

        {currentStep === 2 && (
          <>
            {/* Confirm PIN Step */}
            <View style={styles.pinCard}>
              <Text style={styles.pinTitle}>Confirm Your PIN</Text>
              <Text style={styles.pinSubtitle}>
                Re-enter your PIN to confirm
              </Text>

              <View style={styles.pinInputContainer}>
                <TextInput
                  style={[styles.pinInput, error && styles.pinInputError]}
                  value={confirmPin}
                  onChangeText={(text) => {
                    setConfirmPin(text.replace(/\D/g, '').substring(0, 4));
                    setError('');
                  }}
                  keyboardType="numeric"
                  secureTextEntry={true}
                  placeholder="****"
                  maxLength={4}
                  autoFocus={true}
                />
              </View>

              {renderPinDots(confirmPin)}

              {error ? (
                <Text style={styles.errorText}>{error}</Text>
              ) : (
                <Text style={styles.helpText}>
                  {confirmPin.length === 0 
                    ? 'Re-enter the same 4-digit PIN you created'
                    : pinsMatch 
                    ? '✓ PINs match!'
                    : confirmPin.length === 4
                    ? '✗ PINs do not match'
                    : 'Keep typing...'
                  }
                </Text>
              )}
            </View>

            {/* Action Buttons */}
            <TouchableOpacity
              style={[
                styles.proceedBtn, 
                (!pinsMatch || isSubmitting) && styles.proceedDisabled
              ]}
              disabled={!pinsMatch || isSubmitting}
              onPress={handleConfirmPin}
            >
              {isSubmitting ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator size="small" color="#fff" />
                  <Text style={[styles.proceedText, { marginLeft: 8 }]}>
                    Setting up PIN...
                  </Text>
                </View>
              ) : (
                <Text style={styles.proceedText}>Complete Setup</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.proceedBtn, styles.backBtn]}
              onPress={handleBackToCreatePin}
              disabled={isSubmitting}
            >
              <Text style={[styles.proceedText, styles.backBtnText]}>
                ← Back to Create PIN
              </Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },

  header: {
    backgroundColor: '#ff3b30',
    paddingVertical: 20,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  headerText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  headerSubtext: {
    color: '#fff',
    fontSize: 14,
    opacity: 0.9,
  },

  content: {
    flex: 1,
    paddingTop: 20,
  },

  welcomeCard: {
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
    borderLeftColor: '#28a745',
  },
  welcomeTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  welcomeText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    textAlign: 'center',
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
    marginBottom: 8,
    textAlign: 'center',
  },
  pinSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 24,
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

  errorText: {
    color: '#ff3b30',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
    fontWeight: '500',
  },
  helpText: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
  },

  tipsCard: {
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
    borderLeftColor: '#17a2b8',
  },
  tipsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginBottom: 12,
  },
  tipItem: {
    fontSize: 14,
    color: '#666',
    lineHeight: 22,
    marginBottom: 4,
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
    fontWeight: '600',
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
});