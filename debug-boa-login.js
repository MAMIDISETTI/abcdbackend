const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');

// Connect to database
const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/taskmanager';
    await mongoose.connect(mongoUri, {});
    } catch (err) {
    console.error("Error connecting to MongoDB", err);
    process.exit(1);
  }
};

// Debug BOA login
const debugBOALogin = async () => {
  try {
    await connectDB();
    
    // Check total users
    const totalUsers = await User.countDocuments();
    // Check all users
    const allUsers = await User.find({}).select('email name role');
    // Check BOA users specifically
    const boaUsers = await User.find({ role: 'boa' });
    if (boaUsers.length > 0) {
      for (const user of boaUsers) {
        }
    } else {
      }
    
    // Test with common email variations
    const testEmails = [
      'admin@example.com',
      'boa@example.com',
      'test@example.com',
      'user@example.com'
    ];
    
    for (const email of testEmails) {
      const user = await User.findOne({ email: email.toLowerCase() });
      if (user) {
        } else {
        }
    }
    
  } catch (error) {
    console.error('Debug error:', error);
  } finally {
    mongoose.connection.close();
    }
};

debugBOALogin();
