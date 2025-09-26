const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');

// Connect to database
const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/taskmanager';
    console.log('Connecting to MongoDB with URI:', mongoUri);
    await mongoose.connect(mongoUri, {});
    console.log("MongoDB connected successfully");
  } catch (err) {
    console.error("Error connecting to MongoDB", err);
    process.exit(1);
  }
};

// Debug BOA login
const debugBOALogin = async () => {
  try {
    await connectDB();
    
    console.log('\n=== DEBUGGING BOA LOGIN ===\n');
    
    // Check total users
    const totalUsers = await User.countDocuments();
    console.log('Total users in database:', totalUsers);
    
    // Check all users
    const allUsers = await User.find({}).select('email name role');
    console.log('All users:', allUsers.map(u => ({ email: u.email, name: u.name, role: u.role })));
    
    // Check BOA users specifically
    const boaUsers = await User.find({ role: 'boa' });
    console.log('\nBOA users found:', boaUsers.length);
    
    if (boaUsers.length > 0) {
      console.log('BOA users details:');
      for (const user of boaUsers) {
        console.log({
          email: user.email,
          name: user.name,
          role: user.role,
          hasPassword: !!user.password,
          passwordLength: user.password ? user.password.length : 0
        });
      }
    } else {
      console.log('No BOA users found in database');
      console.log('Available roles:', [...new Set(allUsers.map(u => u.role))]);
    }
    
    // Test with common email variations
    const testEmails = [
      'admin@example.com',
      'boa@example.com',
      'test@example.com',
      'user@example.com'
    ];
    
    console.log('\nTesting common email variations:');
    for (const email of testEmails) {
      const user = await User.findOne({ email: email.toLowerCase() });
      if (user) {
        console.log(`Found user with email: ${email}`, { role: user.role, name: user.name });
      } else {
        console.log(`No user found with email: ${email}`);
      }
    }
    
  } catch (error) {
    console.error('Debug error:', error);
  } finally {
    mongoose.connection.close();
    console.log('\nDatabase connection closed');
  }
};

debugBOALogin();
