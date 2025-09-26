const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');

connectDB();

const testUsersAPI = async () => {
  try {
    console.log('=== Testing Users API Logic ===');

    // Test 1: Get all trainees
    console.log('\n--- Test 1: Get all trainees ---');
    const allTrainees = await User.find({ role: 'trainee' })
      .populate('assignedTrainer', 'name email author_id')
      .select("-password");
    console.log(`Found ${allTrainees.length} total trainees`);
    
    const traineesWithTrainers = allTrainees.filter(user => user.assignedTrainer);
    console.log(`Found ${traineesWithTrainers.length} trainees with assigned trainers:`);
    traineesWithTrainers.forEach(trainee => {
      console.log(`- ${trainee.name}: assigned to ${trainee.assignedTrainer?.name || 'Unknown'}`);
    });

    // Test 2: Get unassigned trainees
    console.log('\n--- Test 2: Get unassigned trainees ---');
    const unassignedQuery = {
      role: 'trainee',
      $or: [
        { assignedTrainer: { $exists: false } },
        { assignedTrainer: null },
        { assignedTrainer: '' }
      ]
    };
    
    const unassignedTrainees = await User.find(unassignedQuery).select("-password");
    console.log(`Found ${unassignedTrainees.length} unassigned trainees:`);
    unassignedTrainees.forEach(trainee => {
      console.log(`- ${trainee.name} (${trainee.email})`);
    });

    // Test 3: Get all users (for BOA dashboard)
    console.log('\n--- Test 3: Get all users ---');
    const allUsers = await User.find({})
      .populate('assignedTrainer', 'name email author_id')
      .select("-password");
    console.log(`Found ${allUsers.length} total users`);

    console.log('\n=== Test completed successfully ===');

  } catch (error) {
    console.error('Error during test:', error);
  } finally {
    mongoose.disconnect();
  }
};

testUsersAPI();
