import React from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native';

interface SuccessModalProps {
  visible: boolean;
  onClose: () => void;
  onBuyMore: () => void;
  transaction: any;
  networkName: string;
  phone: string;
  amount: number;
  dataPlan: string;
  newBalance: any;
}

const DataSuccessModal: React.FC<SuccessModalProps> = ({ 
  visible, 
  onClose, 
  onBuyMore, 
  transaction, 
  networkName, 
  phone, 
  amount, 
  dataPlan,
  newBalance 
}) => {
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Success Icon */}
          <View style={styles.iconContainer}>
            <Text style={styles.successIcon}>✅</Text>
          </View>

          {/* Title */}
          <Text style={styles.title}>Data Purchase Successful!</Text>

          {/* Content */}
          <Text style={styles.subtitle}>{networkName} Data Plan Activated</Text>

          <View style={styles.detailsContainer}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Plan:</Text>
              <Text style={styles.detailValue}>{dataPlan}</Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Amount:</Text>
              <Text style={styles.detailValue}>₦{amount?.toLocaleString()}</Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Phone:</Text>
              <Text style={styles.detailValue}>{phone}</Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Network:</Text>
              <Text style={styles.detailValue}>{networkName}</Text>
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
              </>
            )}

            {newBalance && (
              <View style={[styles.detailRow, styles.balanceRow]}>
                <Text style={styles.detailLabel}>New Balance:</Text>
                <Text style={[styles.detailValue, styles.balanceValue]}>₦{newBalance.totalBalance?.toLocaleString()}</Text>
              </View>
            )}
          </View>

          <Text style={styles.thankYou}>Your data plan has been activated successfully!</Text>

          {/* Buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity 
              style={[styles.button, styles.buyMoreButton]} 
              onPress={onBuyMore}
            >
              <Text style={styles.buyMoreText}>Buy More Data</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.button, styles.doneButton]} 
              onPress={onClose}
            >
              <Text style={styles.doneText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

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
  buyMoreButton: {
    backgroundColor: '#ff2b2b',
  },
  doneButton: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#dee2e6',
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

export default DataSuccessModal;