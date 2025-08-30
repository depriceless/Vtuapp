import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
} from 'react-native';

interface InternetSuccessModalProps {
  visible: boolean;
  onClose: () => void;
  onBuyMore: () => void;
  transaction: any;
  providerName: string;
  customerNumber: string;
  amount: number;
  newBalance: any;
  planDetails?: {
    name: string;
    dataSize: string;
    speed: string;
    validity: string;
  };
}

export default function InternetSuccessModal({
  visible,
  onClose,
  onBuyMore,
  transaction,
  providerName,
  customerNumber,
  amount,
  newBalance,
  planDetails
}: InternetSuccessModalProps) {

  const formatTransactionId = (id: string) => {
    if (!id) return 'N/A';
    return id.length > 12 ? `${id.substring(0, 6)}...${id.substring(id.length - 6)}` : id;
  };

  const formatDateTime = (date: string | Date) => {
    try {
      const d = new Date(date);
      return d.toLocaleString('en-NG', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch {
      return new Date().toLocaleString();
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Payment Successful</Text>
          <TouchableOpacity 
            style={styles.closeButton}
            onPress={onClose}
          >
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView 
          style={styles.content}
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Success Icon */}
          <View style={styles.successIcon}>
            <View style={styles.successIconCircle}>
              <Text style={styles.successIconText}>✓</Text>
            </View>
            <Text style={styles.successTitle}>Internet Subscription Successful!</Text>
            <Text style={styles.successSubtitle}>
              Your {providerName} internet plan has been activated
            </Text>
          </View>

          {/* Transaction Details Card */}
          <View style={styles.detailsCard}>
            <Text style={styles.cardTitle}>Subscription Details</Text>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Provider:</Text>
              <Text style={styles.detailValue}>{providerName}</Text>
            </View>

            {planDetails && (
              <>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Plan:</Text>
                  <Text style={styles.detailValue}>{planDetails.name}</Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Data Allowance:</Text>
                  <Text style={styles.detailValue}>{planDetails.dataSize}</Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Speed:</Text>
                  <Text style={styles.detailValue}>{planDetails.speed}</Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Validity:</Text>
                  <Text style={styles.detailValue}>{planDetails.validity}</Text>
                </View>
              </>
            )}

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Customer ID:</Text>
              <Text style={styles.detailValue}>{customerNumber}</Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Amount Paid:</Text>
              <Text style={[styles.detailValue, styles.amountValue]}>
                ₦{amount.toLocaleString()}
              </Text>
            </View>
          </View>

          {/* Transaction Info Card */}
          <View style={styles.detailsCard}>
            <Text style={styles.cardTitle}>Transaction Information</Text>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Transaction ID:</Text>
              <Text style={styles.detailValue}>
                {formatTransactionId(transaction?._id || transaction?.reference || 'N/A')}
              </Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Status:</Text>
              <Text style={[styles.detailValue, styles.statusSuccess]}>
                {transaction?.status === 'completed' ? 'Completed' : 'Successful'}
              </Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Date & Time:</Text>
              <Text style={styles.detailValue}>
                {formatDateTime(transaction?.timestamp || transaction?.createdAt || new Date())}
              </Text>
            </View>

            {transaction?.responseMessage && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Response:</Text>
                <Text style={styles.detailValue}>{transaction.responseMessage}</Text>
              </View>
            )}
          </View>

          {/* Updated Balance Card */}
          {newBalance && (
            <View style={styles.balanceCard}>
              <Text style={styles.cardTitle}>Updated Wallet Balance</Text>
              
              <View style={styles.balanceDisplay}>
                <Text style={styles.balanceAmount}>
                  ₦{(newBalance.totalBalance || newBalance.mainBalance || newBalance.amount || 0).toLocaleString()}
                </Text>
                <Text style={styles.balanceCurrency}>
                  {newBalance.currency || 'NGN'}
                </Text>
              </View>

              <Text style={styles.balanceUpdated}>
                Updated: {formatDateTime(newBalance.lastUpdated || new Date())}
              </Text>
            </View>
          )}

          {/* Service Activation Notice */}
          <View style={styles.noticeCard}>
            <Text style={styles.noticeTitle}>Service Activation</Text>
            <Text style={styles.noticeText}>
              Your internet subscription will be activated within 5-15 minutes. 
              You may need to restart your modem/router to access the new data allocation.
            </Text>
            
            {planDetails && (
              <View style={styles.activationDetails}>
                <Text style={styles.activationText}>
                  Plan: {planDetails.name} ({planDetails.dataSize})
                </Text>
                <Text style={styles.activationText}>
                  Speed: Up to {planDetails.speed}
                </Text>
                <Text style={styles.activationText}>
                  Valid for: {planDetails.validity}
                </Text>
              </View>
            )}
          </View>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity 
              style={styles.buyMoreBtn}
              onPress={onBuyMore}
            >
              <Text style={styles.buyMoreText}>Subscribe to Another Plan</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.doneBtn}
              onPress={onClose}
            >
              <Text style={styles.doneText}>Done</Text>
            </TouchableOpacity>
          </View>

          {/* Support Info */}
          <View style={styles.supportCard}>
            <Text style={styles.supportTitle}>Need Help?</Text>
            <Text style={styles.supportText}>
              If you experience any issues with your internet service activation, 
              please contact {providerName} customer support or reach out to our support team.
            </Text>
            
            <TouchableOpacity style={styles.supportBtn}>
              <Text style={styles.supportBtnText}>Contact Support</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

// Styles
const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },

  header: {
    backgroundColor: '#fff',
    paddingVertical: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    color: '#666',
    fontWeight: 'bold',
  },

  content: {
    flex: 1,
  },

  successIcon: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
  },
  successIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#28a745',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#28a745',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  successIconText: {
    fontSize: 32,
    color: '#fff',
    fontWeight: 'bold',
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    textAlign: 'center',
    marginBottom: 8,
  },
  successSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },

  detailsCard: {
    margin: 16,
    marginTop: 0,
    padding: 20,
    borderRadius: 16,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },

  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
    flex: 1,
  },
  detailValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
    textAlign: 'right',
    flex: 1.5,
  },
  amountValue: {
    fontSize: 16,
    color: '#ff3b30',
    fontWeight: '700',
  },
  statusSuccess: {
    color: '#28a745',
    fontWeight: '600',
  },

  divider: {
    height: 1,
    backgroundColor: '#eee',
    marginVertical: 16,
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
    borderLeftColor: '#28a745',
  },
  balanceDisplay: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  balanceAmount: {
    fontSize: 28,
    fontWeight: '700',
    color: '#28a745',
  },
  balanceCurrency: {
    fontSize: 14,
    color: '#666',
    marginLeft: 4,
    fontWeight: '500',
  },
  balanceUpdated: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
  },

  noticeCard: {
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
  noticeTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#17a2b8',
    marginBottom: 12,
    textAlign: 'center',
  },
  noticeText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 16,
  },
  activationDetails: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
  },
  activationText: {
    fontSize: 12,
    color: '#555',
    marginBottom: 4,
    textAlign: 'center',
  },

  actionButtons: {
    margin: 16,
    gap: 12,
  },
  buyMoreBtn: {
    backgroundColor: '#ff3b30',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#ff3b30',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  buyMoreText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  doneBtn: {
    backgroundColor: '#6c757d',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  doneText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },

  supportCard: {
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
    borderLeftColor: '#6f42c1',
  },
  supportTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#6f42c1',
    marginBottom: 12,
    textAlign: 'center',
  },
  supportText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 16,
  },
  supportBtn: {
    backgroundColor: '#6f42c1',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    alignSelf: 'center',
  },
  supportBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});