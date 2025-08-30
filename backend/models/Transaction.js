const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema({
  walletId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Wallet",
    required: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: ["credit", "debit", "transfer_in", "transfer_out"],
    required: true,
    index: true
  },
  amount: {
    type: Number,
    required: true,
    min: [0, "Transaction amount cannot be negative"]
  },
  previousBalance: {
    type: Number,
    required: true
  },
  newBalance: {
    type: Number,
    required: true
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, "Description cannot exceed 500 characters"]
    // ❌ removed required:true (some auto-transactions won’t need it)
  },
  reference: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  status: {
    type: String,
    enum: ["pending", "completed", "failed", "cancelled"],
    default: "completed",
    index: true
  },
  category: {
    type: String,
    enum: ["funding", "withdrawal", "transfer", "payment", "refund", "fee", "bonus", "betting"],

    default: "funding"
  },

  // For transfers
  relatedTransactionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Transaction"
  },
  relatedWalletId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Wallet"
  },

  // Payment gateway details
  gateway: {
    provider: String, // "paystack", "flutterwave", "manual", etc.
    gatewayReference: String,
    gatewayResponse: mongoose.Schema.Types.Mixed
  },

  // Additional metadata (✅ now has defaults)
 metadata: {
  ip_address: { type: String },
  user_agent: { type: String },
  source: { type: String },
  notes: { type: String },
  tags: [{ type: String }],
  failureReason: String,
  cancellationReason: String,
  betting: {
    provider: { 
      type: String, 
      enum: ['BET9JA', 'SPORTYBET', 'NAIRABET', 'BETWAY', '1XBET', 'BETKING', 'MERRYBET']
    },
    customerId: String,
    customerName: String,
    retryCount: { type: Number, default: 0 },
    lastRetryAt: Date,
    providerResponse: mongoose.Schema.Types.Mixed
  }
},

  // Timestamps
  processedAt: {
    type: Date,
    default: Date.now
  },
  completedAt: Date,
  failedAt: Date
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
transactionSchema.index({ walletId: 1, createdAt: -1 });
transactionSchema.index({ userId: 1, createdAt: -1 });
transactionSchema.index({ type: 1, status: 1 });
transactionSchema.index({ "gateway.gatewayReference": 1 });

// ✅ Virtual for formatted amount
transactionSchema.virtual("formattedAmount").get(function () {
  if (!this.amount) return "₦0";
  return `₦${this.amount.toLocaleString()}`;
});

// ✅ Virtual for age
transactionSchema.virtual("age").get(function () {
  const now = new Date();
  const diffMs = now - this.createdAt;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 60) return `${diffMins} minute(s) ago`;
  if (diffHours < 24) return `${diffHours} hour(s) ago`;
  return `${diffDays} day(s) ago`;
});

// Instance methods
transactionSchema.methods.complete = function () {
  this.status = "completed";
  this.completedAt = new Date();
  return this.save();
};

transactionSchema.methods.fail = function (reason) {
  this.status = "failed";
  this.failedAt = new Date();
  if (reason) this.metadata.failureReason = reason;
  return this.save();
};

transactionSchema.methods.cancel = function (reason) {
  if (this.status === "completed") {
    throw new Error("Cannot cancel completed transaction");
  }
  this.status = "cancelled";
  if (reason) this.metadata.cancellationReason = reason;
  return this.save();
};

// Static methods
transactionSchema.statics.findByReference = function (reference) {
  return this.findOne({ reference });
};

transactionSchema.statics.getUserTransactions = function (userId, options = {}) {
  const { page = 1, limit = 20, type = null, status = null, startDate = null, endDate = null } = options;

  const query = { userId };
  if (type) query.type = type;
  if (status) query.status = status;
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }

  return this.find(query)
    .populate("walletId", "balance")
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip((page - 1) * limit);
};

transactionSchema.statics.getWalletTransactions = function (walletId, options = {}) {
  const { page = 1, limit = 20, type = null, status = null } = options;

  const query = { walletId };
  if (type) query.type = type;
  if (status) query.status = status;

  return this.find(query)
    .populate("userId", "name email")
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip((page - 1) * limit);
};

// ✅ Better unique reference generator
transactionSchema.statics.generateReference = function (prefix = "TXN") {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${prefix}_${timestamp}_${random}`;
};

// Get user's betting transactions
transactionSchema.statics.getUserBettingTransactions = function(userId, options = {}) {
  const {
    page = 1,
    limit = 20,
    provider,
    status,
    startDate,
    endDate
  } = options;

  const query = {
    userId,
    category: 'betting'
  };

  if (provider) query['metadata.betting.provider'] = provider.toUpperCase();
  if (status) query.status = status;
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }

  return this.find(query)
    .populate('walletId', 'balance')
    .populate('userId', 'name username')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);
};

// Get betting statistics
transactionSchema.statics.getBettingStats = function(userId, period = '30d') {
  const periodDays = {
    '24h': 1,
    '7d': 7,
    '30d': 30,
    '90d': 90
  };

  const days = periodDays[period] || 30;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const match = {
    userId: mongoose.Types.ObjectId(userId),
    category: 'betting',
    createdAt: { $gte: startDate }
  };

  return this.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalAmount: { $sum: '$amount' }
      }
    }
  ]);
};

// Get daily betting total
transactionSchema.statics.getDailyBettingTotal = function(userId) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return this.aggregate([
    {
      $match: {
        userId: mongoose.Types.ObjectId(userId),
        category: 'betting',
        status: 'completed',
        createdAt: { $gte: today }
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$amount' },
        count: { $sum: 1 }
      }
    }
  ]);
};

// Instance method to check if betting transaction can be retried
transactionSchema.methods.canRetryBetting = function() {
  return this.status === 'failed' && 
         this.category === 'betting' && 
         (this.metadata?.betting?.retryCount || 0) < 3;
};

// Instance method to mark betting transaction as successful
transactionSchema.methods.markBettingSuccess = function(successMessage, providerResponse = null) {
  this.status = 'completed';
  this.completedAt = new Date();
  if (!this.metadata) this.metadata = {};
  
  this.metadata.notes = successMessage;
  if (providerResponse && this.metadata.betting) {
    this.metadata.betting.providerResponse = providerResponse;
  }
  
  return this.save();
};

// Instance method to mark betting transaction as failed
transactionSchema.methods.markBettingFailed = function(errorMessage, providerResponse = null) {
  this.status = 'failed';
  this.failedAt = new Date();
  if (!this.metadata) this.metadata = {};
  
  this.metadata.failureReason = errorMessage;
  if (providerResponse && this.metadata.betting) {
    this.metadata.betting.providerResponse = providerResponse;
  }
  
  return this.save();
};

// Instance method to increment retry count for betting
transactionSchema.methods.incrementBettingRetry = function() {
  if (!this.metadata) this.metadata = {};
  if (!this.metadata.betting) this.metadata.betting = {};
  
  this.metadata.betting.retryCount = (this.metadata.betting.retryCount || 0) + 1;
  this.metadata.betting.lastRetryAt = new Date();
  this.status = 'pending';
  
  return this.save();
};

module.exports = mongoose.model("Transaction", transactionSchema);
