// app/BetFundingSuccessModal.tsx - Bet Funding Success Modal Component
import React from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native';

const BetFundingSuccessModal = ({ 
  visible, 
  onClose, 
  onPlaceBet, 
  transaction, 
  betPlatform, 
  fundingMethod, 
  amount, 
  newBalance,
  bonusAmount 
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
            <Text style={styles.successIcon}>🎉</Text>
          </View>

          {/* Title */}
          <Text style={styles.title}>Funding Successful!</Text>

          {/* Content */}
          <Text style={styles.subtitle}>{betPlatform} Account Funded Successfully</Text>

          <View style={styles.detailsContainer}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Amount:</Text>
              <Text style={styles.detailValue}>₦{amount?.toLocaleString()}</Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Platform:</Text>
              <Text style={styles.detailValue}>{betPlatform}</Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Method:</Text>
              <Text style={styles.detailValue}>{fundingMethod}</Text>
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

            {bonusAmount && bonusAmount > 0 && (
              <View style={[styles.detailRow, styles.bonusRow]}>
                <Text style={styles.detailLabel}>Bonus Received:</Text>
                <Text style={[styles.detailValue, styles.bonusValue]}>₦{bonusAmount?.toLocaleString()}</Text>
              </View>
            )}

            {newBalance && (
              <View style={[styles.detailRow, styles.balanceRow]}>
                <Text style={styles.detailLabel}>Balance:</Text>
                <Text style={[styles.detailValue, styles.balanceValue]}>₦{newBalance?.toLocaleString()}</Text>
              </View>
            )}
          </View>

          <Text style={styles.thankYou}>Good luck with your bets! 🍀</Text>

          {/* Buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity 
              style={[styles.button, styles.placeBetButton]} 
              onPress={onPlaceBet}
            >
              <Text style={styles.placeBetText}>Place a Bet</Text>
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
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
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
  bonusRow: {
    backgroundColor: '#fff3cd',
    marginHorizontal: -8,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 8,
    marginVertical: 4,
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
  bonusValue: {
    color: '#856404',
    fontSize: 16,
    fontWeight: 'bold',
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
  placeBetButton: {
    backgroundColor: '#ff3b30',
  },
  doneButton: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  placeBetText: {
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

export default BetFundingSuccessModal;