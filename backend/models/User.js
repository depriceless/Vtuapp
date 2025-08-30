const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    trim: true,
    lowercase: true,
    minlength: [3, 'Username must be at least 3 characters'],
    maxlength: [30, 'Username cannot exceed 30 characters'],
    match: [/^[a-zA-Z0-9._-]+$/, 'Username can only contain letters, numbers, dots, underscores, and hyphens']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address']
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    unique: true,
    trim: true,
    match: [/^\d{10,15}$/, 'Phone number must be 10-15 digits']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false
  },
  pin: {
    type: String,
    select: false,
    match: [/^\d{4}$/, 'PIN must be exactly 4 digits']
  },
  isPinSetup: { type: Boolean, default: false },
  isEmailVerified: { type: Boolean, default: false },
  isPhoneVerified: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  lastLogin: { type: Date },

  resetPasswordToken: String,
  resetPasswordExpires: Date,
  emailVerificationToken: String,
  emailVerificationExpires: Date,

  avatar: { type: String, default: null },
  dateOfBirth: { type: Date },
  address: {
    street: String,
    city: String,
    state: String,
    country: { type: String, default: 'Nigeria' },
    zipCode: String
  },

  preferences: {
    currency: { type: String, default: 'NGN', enum: ['NGN', 'USD', 'EUR'] },
    language: { type: String, default: 'en', enum: ['en', 'yo', 'ig', 'ha'] },
    timezone: { type: String, default: 'Africa/Lagos' },
    notifications: {
      email: { type: Boolean, default: true },
      sms: { type: Boolean, default: true },
      push: { type: Boolean, default: true },
      marketing: { type: Boolean, default: false }
    }
  },

  accountType: { type: String, enum: ['basic', 'premium', 'business'], default: 'basic' },
  kycLevel: { type: Number, min: 0, max: 3, default: 0 },
  kycData: {
    bvn: String,
    nin: String,
    idType: { type: String, enum: ['national_id', 'drivers_license', 'voters_card', 'passport'] },
    idNumber: String,
    idExpiryDate: Date,
    verificationStatus: { type: String, enum: ['pending', 'verified', 'rejected'], default: 'pending' }
  }
}, {
  timestamps: true,
  toJSON: { 
    virtuals: true,
    transform: function(doc, ret) {
      delete ret.password;
      delete ret.pin;
      delete ret.resetPasswordToken;
      delete ret.emailVerificationToken;
      delete ret.__v;
      return ret;
    }
  },
  toObject: { virtuals: true }
});

// Indexes
userSchema.index({ email: 1 });
userSchema.index({ username: 1 });
userSchema.index({ phone: 1 });
userSchema.index({ isActive: 1 });
userSchema.index({ kycLevel: 1 });
userSchema.index({ accountType: 1 });

// Virtuals
userSchema.virtual('displayName').get(function() { return this.name || this.username; });
userSchema.virtual('accountAge').get(function() {
  if (!this.createdAt) return 0;
  return Math.ceil((new Date() - this.createdAt) / (1000 * 60 * 60 * 24));
});
userSchema.virtual('wallet', { ref: 'Wallet', localField: '_id', foreignField: 'userId', justOne: true });
userSchema.virtual('transactions', { ref: 'Transaction', localField: '_id', foreignField: 'userId' });

// Hash password
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12;
  this.password = await bcrypt.hash(this.password, saltRounds);
  next();
});

// Hash PIN
userSchema.pre('save', async function(next) {
  if (!this.isModified('pin') || !this.pin) return next();
  const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12;
  this.pin = await bcrypt.hash(this.pin, saltRounds);
  next();
});

// Auto-create wallet after user is saved
userSchema.post('save', async function(doc, next) {
  try {
    const Wallet = mongoose.model('Wallet');
    const existingWallet = await Wallet.findOne({ userId: doc._id });
    if (!existingWallet) {
      await Wallet.createForUser(doc._id);
      console.log('Wallet automatically created for user:', doc._id);
    }
    next();
  } catch (err) {
    next(err);
  }
});

// Instance methods
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};
userSchema.methods.comparePin = async function(candidatePin) {
  if (!this.pin) throw new Error('PIN not set');
  return await bcrypt.compare(candidatePin, this.pin);
};
userSchema.methods.updateLastLogin = function() {
  this.lastLogin = new Date();
  return this.save();
};
userSchema.methods.getWallet = async function() {
  const Wallet = mongoose.model('Wallet');
  return await Wallet.findByUserId(this._id);
};
userSchema.methods.createWallet = async function() {
  const Wallet = mongoose.model('Wallet');
  return await Wallet.createForUser(this._id);
};
userSchema.methods.getTransactions = async function(options = {}) {
  const Transaction = mongoose.model('Transaction');
  return await Transaction.getUserTransactions(this._id, options);
};
userSchema.methods.canTransact = function(amount) {
  const limits = { 0: 50000, 1: 200000, 2: 1000000, 3: 10000000 };
  return amount <= limits[this.kycLevel];
};
userSchema.methods.getTransactionLimit = function() {
  const limits = { 0: 50000, 1: 200000, 2: 1000000, 3: 10000000 };
  return limits[this.kycLevel] || 50000;
};

// Static methods
userSchema.statics.findByEmailOrPhone = function(emailOrPhone) {
  const emailRegex = /^\S+@\S+\.\S+$/;
  const phoneRegex = /^\d+$/;
  if (emailRegex.test(emailOrPhone)) return this.findOne({ email: emailOrPhone.toLowerCase() });
  if (phoneRegex.test(emailOrPhone.replace(/[\s\-\(\)]/g, ''))) {
    const cleanPhone = emailOrPhone.replace(/[\s\-\(\)]/g, '');
    return this.findOne({ phone: cleanPhone });
  }
  return null;
};
userSchema.statics.findActiveUsers = function() { return this.find({ isActive: true }); };
userSchema.statics.findByKycLevel = function(level) { return this.find({ kycLevel: level }); };

module.exports = mongoose.model('User', userSchema);
