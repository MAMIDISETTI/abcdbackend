const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Import models
const User = require('./models/User');
const UserNew = require('./models/UserNew');
const Joiner = require('./models/Joiner');

// Database connection
const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/taskmanager';
    await mongoose.connect(mongoUri);
    console.log("MongoDB connected successfully");
  } catch (err) {
    console.error("Error connecting to MongoDB", err);
    process.exit(1);
  }
};

// Create test data
const createTestData = async () => {
  try {
    console.log('Creating test data...');

    // Clear existing data
    await User.deleteMany({});
    await UserNew.deleteMany({});
    await Joiner.deleteMany({});

    // Create admin user
    const hashedPassword = await bcrypt.hash('admin123', 10);
    
    const adminUser = await UserNew.create({
      author_id: 'admin-001',
      name: 'Admin User',
      email: 'admin@test.com',
      password: hashedPassword,
      role: 'admin',
      isActive: true,
      accountStatus: 'active',
      accountCreated: true,
      accountCreatedAt: new Date()
    });

    // Create active trainer
    const trainerUser = await UserNew.create({
      author_id: 'trainer-001',
      name: 'John Trainer',
      email: 'john.trainer@test.com',
      password: hashedPassword,
      role: 'trainer',
      isActive: true,
      accountStatus: 'active',
      accountCreated: true,
      accountCreatedAt: new Date()
    });

    // Create active trainee
    const traineeUser = await UserNew.create({
      author_id: 'trainee-001',
      name: 'Jane Trainee',
      email: 'jane.trainee@test.com',
      password: hashedPassword,
      role: 'trainee',
      isActive: true,
      accountStatus: 'active',
      accountCreated: true,
      accountCreatedAt: new Date(),
      assignedTrainer: trainerUser._id
    });

    // Create DEACTIVATED trainer with remarks
    const deactivatedTrainer = await UserNew.create({
      author_id: 'trainer-002',
      name: 'Mike Deactivated',
      email: 'mike.deactivated@test.com',
      password: hashedPassword,
      role: 'trainer',
      isActive: false,
      accountStatus: 'deactivated',
      accountCreated: true,
      accountCreatedAt: new Date(),
      deactivatedAt: new Date('2024-12-01'),
      deactivatedBy: adminUser._id,
      deactivationReason: 'Left the company voluntarily'
    });

    // Create DEACTIVATED trainee with remarks
    const deactivatedTrainee = await UserNew.create({
      author_id: 'trainee-002',
      name: 'Sarah Deactivated',
      email: 'sarah.deactivated@test.com',
      password: hashedPassword,
      role: 'trainee',
      isActive: false,
      accountStatus: 'deactivated',
      accountCreated: true,
      accountCreatedAt: new Date(),
      deactivatedAt: new Date('2024-12-05'),
      deactivatedBy: adminUser._id,
      deactivationReason: 'Performance issues - did not meet expectations'
    });

    // Create another DEACTIVATED trainee with different remarks
    const deactivatedTrainee2 = await UserNew.create({
      author_id: 'trainee-003',
      name: 'Tom Deactivated',
      email: 'tom.deactivated@test.com',
      password: hashedPassword,
      role: 'trainee',
      isActive: false,
      accountStatus: 'deactivated',
      accountCreated: true,
      accountCreatedAt: new Date(),
      deactivatedAt: new Date('2024-12-10'),
      deactivatedBy: adminUser._id,
      deactivationReason: 'Resigned for personal reasons'
    });

    // Create corresponding joiner records
    await Joiner.create({
      author_id: 'trainer-002',
      name: 'Mike Deactivated',
      candidate_name: 'Mike Deactivated',
      email: 'mike.deactivated@test.com',
      status: 'inactive',
      accountCreated: false,
      department: 'Training',
      role: 'trainer'
    });

    await Joiner.create({
      author_id: 'trainee-002',
      name: 'Sarah Deactivated',
      candidate_name: 'Sarah Deactivated',
      email: 'sarah.deactivated@test.com',
      status: 'inactive',
      accountCreated: false,
      department: 'IT',
      role: 'trainee'
    });

    await Joiner.create({
      author_id: 'trainee-003',
      name: 'Tom Deactivated',
      candidate_name: 'Tom Deactivated',
      email: 'tom.deactivated@test.com',
      status: 'inactive',
      accountCreated: false,
      department: 'Marketing',
      role: 'trainee'
    });

    console.log('✅ Test data created successfully!');
    console.log('📊 Summary:');
    console.log('- 1 Admin (active)');
    console.log('- 1 Trainer (active)');
    console.log('- 1 Trainee (active)');
    console.log('- 1 Trainer (deactivated) - "Left the company voluntarily"');
    console.log('- 1 Trainee (deactivated) - "Performance issues"');
    console.log('- 1 Trainee (deactivated) - "Resigned for personal reasons"');
    console.log('');
    console.log('🎯 Now you can test the remarks feature:');
    console.log('1. Go to Admin → Account Activation');
    console.log('2. Set Status filter to "Inactive"');
    console.log('3. You should see 3 deactivated users with their remarks!');

  } catch (error) {
    console.error('Error creating test data:', error);
  }
};

// Main function
const main = async () => {
  await connectDB();
  await createTestData();
  process.exit(0);
};

main();
