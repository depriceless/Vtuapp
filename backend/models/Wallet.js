const mongoose = require('mongoose');

const walletSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  balance: {
    type: Number,
    default: 0,
    min: [0, 'Wallet balance cannot be negative']
  },
  currency: {
    type: String,
    default: 'NGN',
    enum: ['NGN', 'USD', 'EUR']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isDormant: {
    type: Boolean,
    default: false
  },
  lastTransactionDate: {
    type: Date
  },
  
  // Wallet limits and settings
  dailyLimit: {
    type: Number,
    default: 1000000 // 1 million naira
  },
  monthlyLimit: {
    type: Number,
    default: 10000000 // 10 million naira
  },
  minimumBalance: {
    type: Number,
    default: 0
  },
  
  // Statistics for quick access
  stats: {
    totalCredits: {
      type: Number,
      default: 0
    },
    totalDebits: {
      type: Number,
      default: 0
    },
    transactionCount: {
      type: Number,
      default: 0
    },
    averageTransactionAmount: {
      type: Number,
      default: 0
    }
  },
  
  // Metadata
  metadata: {
    createdBy: String,
    notes: String,
    tags: [String],
    riskLevel: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'low'
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
walletSchema.index({ userId: 1 });
walletSchema.index({ balance: 1 });
walletSchema.index({ isActive: 1 });

// Virtual for formatted balance
walletSchema.virtual('formattedBalance').get(function() {
  return `₦${this.balance.toLocaleString()}`;
});

// Methods
walletSchema.methods.credit = async function(amount, description, reference) {
  if (amount <= 0) throw new Error('Credit amount must be positive');
  
  const Transaction = mongoose.model('Transaction');
  const previousBalance = this.balance;
  
  // Update balance
  this.balance += amount;
  this.lastTransactionDate = new Date();
  
  // Update stats
  this.stats.totalCredits += amount;
  this.stats.transactionCount += 1;
  this.stats.averageTransactionAmount = 
    (this.stats.totalCredits + this.stats.totalDebits) / this.stats.transactionCount;
  
  // Create transaction record
  const transaction = new Transaction({
    walletId: this._id,
    userId: this.userId,
    type: 'credit',
    amount,
    previousBalance,
    newBalance: this.balance,
    description: description || `Wallet credited with ₦${amount.toLocaleString()}`,
    reference: reference || `TXN_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    status: 'completed'
  });
  
  // Save both wallet and transaction
  await this.save();
  await transaction.save();
  
  return { wallet: this, transaction };
};

walletSchema.methods.debit = async function(amount, description, reference) {
  if (amount <= 0) throw new Error('Debit amount must be positive');
  if (this.balance < amount) throw new Error('Insufficient wallet balance');
  
  const Transaction = mongoose.model('Transaction');
  const previousBalance = this.balance;
  
  // Update balance
  this.balance -= amount;
  this.lastTransactionDate = new Date();
  
  // Update stats
  this.stats.totalDebits += amount;
  this.stats.transactionCount += 1;
  this.stats.averageTransactionAmount = 
    (this.stats.totalCredits + this.stats.totalDebits) / this.stats.transactionCount;
  
  // Create transaction record
  const transaction = new Transaction({
    walletId: this._id,
    userId: this.userId,
    type: 'debit',
    amount,
    previousBalance,
    newBalance: this.balance,
    description: description || `Wallet debited with ₦${amount.toLocaleString()}`,
    reference: reference || `TXN_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    status: 'completed'
  });
  
  // Save both wallet and transaction
  await this.save();
  await transaction.save();
  
  return { wallet: this, transaction };
};

walletSchema.methods.transfer = async function(recipientWallet, amount, description) {
  if (this.balance < amount) throw new Error('Insufficient balance for transfer');
  
  const transferReference = `TRF_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Debit sender
  await this.debit(amount, `Transfer to wallet ${recipientWallet._id}`, transferReference);
  
  // Credit recipient
  await recipientWallet.credit(amount, `Transfer from wallet ${this._id}`, transferReference);
  
  return { reference: transferReference, amount };
};

walletSchema.methods.freeze = function() {
  this.isActive = false;
  return this.save();
};

walletSchema.methods.unfreeze = function() {
  this.isActive = true;
  return this.save();
};

// Static methods
walletSchema.statics.createForUser = async function(userId) {
  const existingWallet = await this.findOne({ userId });
  if (existingWallet) throw new Error('User already has a wallet');
  
  const wallet = new this({ userId });
  return wallet.save();
};

walletSchema.statics.findByUserId = function(userId) {
  return this.findOne({ userId }).populate('userId', 'name email phone');
};

module.exports = mongoose.model('Wallet', walletSchema);