const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();
const authRoutes = require('./routes/auth');
const balanceRoutes = require('./routes/balance');
const userRoutes = require("./routes/user");
const walletRoutes = require('./routes/wallet');
const purchaseRoutes = require('./routes/purchase');
const dataRoutes = require('./routes/dataplan'); 
const cableRoutes = require('./routes/cabletv')


const app = express();
const PORT = process.env.PORT || 5000;

// Security middleware
app.use(helmet());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// CORS configuration - UPDATED to include port 8081
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:8081', 'exp://localhost:19000', 'http://localhost:19006'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => {
  console.error('MongoDB connection error:', err.message);
  process.exit(1);
});

// Base API route
app.get('/api', (req, res) => {
  res.status(200).json({ 
    message: 'API is running',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/balance', balanceRoutes);
app.use("/api/user", userRoutes);
app.use('/api', walletRoutes);
app.use('/api/purchase', purchaseRoutes);
app.use('/api/data', dataRoutes); 
app.use('/api', cableRoutes);
app.use('/api/recharge', purchaseRoutes);
app.use('/api/airtime', require('./routes/airtime'));
app.use('/api/betting', require('./routes/betting'));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    success: false, 
    message: 'Route not found' 
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  
  if (process.env.NODE_ENV === 'production') {
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  } else {
    res.status(500).json({
      success: false,
      message: err.message,
      stack: err.stack
    });
  }
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down server...');
  await mongoose.connection.close();
  process.exit(0);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`API Base: http://localhost:${PORT}/api/`);
  console.log(`Auth endpoints: http://localhost:${PORT}/api/auth/`);
  console.log(`Data endpoints: http://localhost:${PORT}/api/data/`);
});