const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Simple test to add one deactivated user
async function addDeactivatedUser() {
  try {
    // Connect to MongoDB
    await mongoose.connect('mongodb://localhost:27017/taskmanager');
    console.log('Connected to MongoDB');

    // Import UserNew model
    const UserNew = require('./models/UserNew');

    // Create a deactivated user
    const hashedPassword = await bcrypt.hash('test123', 10);
    
    const deactivatedUser = await UserNew.create({
      author_id: 'test-deactivated-001',
      name: 'Test Deactivated User',
      email: 'test.deactivated@example.com',
      password: hashedPassword,
      role: 'trainee',
      isActive: false,
      accountStatus: 'deactivated',
      accountCreated: true,
      accountCreatedAt: new Date(),
      deactivatedAt: new Date(),
      deactivatedBy: null,
      deactivationReason: 'Test deactivation - this is a demo user'
    });

    console.log('✅ Deactivated user created successfully!');
    console.log('User ID:', deactivatedUser._id);
    console.log('Name:', deactivatedUser.name);
    console.log('Email:', deactivatedUser.email);
    console.log('Reason:', deactivatedUser.deactivationReason);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

addDeactivatedUser();
