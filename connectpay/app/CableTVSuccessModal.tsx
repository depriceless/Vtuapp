import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  Platform,
  StatusBar,
  Share,
  Alert,
} from 'react-native';

const { width, height } = Dimensions.get('window');

interface CableTVSuccessModalProps {
  visible: boolean;
  onClose: () => void;
  onBuyMore: () => void;
  transaction: {
    _id: string;
    status: string;
    responseMessage?: string;
    createdAt?: string;
    fee?: number;
    reference?: string;
  };
  operatorName: string;
  phone: string;
  smartCardNumber: string;
  customerName: string;
  amount: number;
  packageName: string;
  newBalance: {
    main: number;
    bonus: number;
    total: number;
    previous?: number;
  } | null;
}

export default function CableTVSuccessModal({
  visible,
  onClose,
  onBuyMore,
  transaction,
  operatorName,
  phone,
  smartCardNumber,
  customerName,
  amount,
  packageName,
  newBalance,
}: CableTVSuccessModalProps) {
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
  }, [visible]);

  const shareReceipt = async () => {
    try {
      const receiptText = `🎯 Cable TV Subscription Receipt

📺 Service Provider: ${operatorName}
📦 Package: ${packageName}
💳 Smart Card: ${smartCardNumber}
👤 Customer: ${customerName}
📱 Phone: ${phone}

💰 Subscription Amount: ₦${amount.toLocaleString()}
${transaction.fee ? `💳 Service Fee: ₦${transaction.fee.toLocaleString()}` : ''}
${transaction.fee ? `💵 Total Charged: ₦${(amount + transaction.fee).toLocaleString()}` : ''}

✅ Status: ${transaction.status?.toUpperCase() || 'SUCCESSFUL'}
🆔 Transaction ID: ${transaction._id}
${transaction.reference ? `📋 Reference: ${transaction.reference}` : ''}

${newBalance ? `💼 Updated Balance: ₦${((newBalance.total || newBalance.main + newBalance.bonus) - amount - (transaction.fee || 0)).toLocaleString()}` : ''}

Powered by Your App 🚀`;

      await Share.share({
        message: receiptText,
        title: 'Cable TV Subscription Receipt',
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
            <Text style={styles.successIcon}>✅</Text>
          </View>

          {/* Title */}
          <Text style={styles.title}>Cable TV Purchase Successful!</Text>

          {/* Content */}
          <Text style={styles.subtitle}>{operatorName} Subscription Activated</Text>

          <View style={styles.detailsContainer}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Package:</Text>
              <Text style={styles.detailValue}>{packageName}</Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Amount:</Text>
              <Text style={styles.detailValue}>₦{amount?.toLocaleString()}</Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Smart Card:</Text>
              <Text style={styles.detailValue}>{smartCardNumber}</Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Customer:</Text>
              <Text style={styles.detailValue}>{customerName}</Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Phone:</Text>
              <Text style={styles.detailValue}>{phone}</Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Provider:</Text>
              <Text style={styles.detailValue}>{operatorName}</Text>
            </View>

            {transaction && (
              <>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Transaction ID:</Text>
                  <Text style={styles.detailValue}>{transaction._id || 'N/A'}</Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Status:</Text>
                  <Text style={styles.detailValue}>{(transaction.status || 'COMPLETED').toUpperCase()}</Text>
                </View>

                {transaction.fee && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Service Fee:</Text>
                    <Text style={styles.detailValue}>₦{transaction.fee.toLocaleString()}</Text>
                  </View>
                )}

                {transaction.reference && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Reference:</Text>
                    <Text style={styles.detailValue}>{transaction.reference}</Text>
                  </View>
                )}
              </>
            )}

            {newBalance && (
              <View style={[styles.detailRow, styles.balanceRow]}>
                <Text style={styles.detailLabel}>New Balance:</Text>
                <Text style={[styles.detailValue, styles.balanceValue]}>
                  ₦{((newBalance.total || newBalance.main + newBalance.bonus) - amount - (transaction.fee || 0)).toLocaleString()}
                </Text>
              </View>
            )}
          </View>

          <Text style={styles.thankYou}>Your subscription has been activated successfully!</Text>

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
              <Text style={styles.buyMoreText}>📺 Buy More Cable TV</Text>
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
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.25,
    shadowRadius: 20,
  },
  iconContainer: {
    marginBottom: 16,
  },
  successIcon: {
    fontSize: 48,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
  },
  detailsContainer: {
    width: '100%',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  balanceRow: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
    flex: 1,
    textAlign: 'right',
  },
  balanceValue: {
    color: '#28a745',
    fontSize: 16,
  },
  thankYou: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    fontStyle: 'italic',
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
  },
  button: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  shareButton: {
    backgroundColor: '#ff2b2b',
  },
  buyMoreButton: {
    backgroundColor: '#ff2b2b',
  },
  doneButton: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  shareText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  buyMoreText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  doneText: {
    color: '#495057',
    fontSize: 16,
    fontWeight: '600',
  },
});