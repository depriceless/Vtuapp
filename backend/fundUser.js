const mongoose = require('mongoose');
const Wallet = require('./models/wallet');

const userId = '68af08e93757075a002c44d0';
const amountToAdd = 5000;

async function fundUser() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB');

  let wallet = await Wallet.findOne({ userId: new mongoose.Types.ObjectId(userId) });

  if (!wallet) {
    wallet = await Wallet.create({ userId: new mongoose.Types.ObjectId(userId) });
    console.log('Wallet created for user.');
  }

  wallet.balance += amountToAdd;
  await wallet.save();

  console.log('Wallet updated. New balance:', wallet.balance);

  await mongoose.disconnect();
}

fundUser().catch(console.error);
