const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');

connectDB();

const testUsersAPI = async () => {
  try {
    // Test 1: Get all trainees
    const allTrainees = await User.find({ role: 'trainee' })
      .populate('assignedTrainer', 'name email author_id')
      .select("-password");
    const traineesWithTrainers = allTrainees.filter(user => user.assignedTrainer);
    traineesWithTrainers.forEach(trainee => {
      });

    // Test 2: Get unassigned trainees
    const unassignedQuery = {
      role: 'trainee',
      $or: [
        { assignedTrainer: { $exists: false } },
        { assignedTrainer: null },
        { assignedTrainer: '' }
      ]
    };
    
    const unassignedTrainees = await User.find(unassignedQuery).select("-password");
    unassignedTrainees.forEach(trainee => {
      });

    // Test 3: Get all users (for BOA dashboard)
    const allUsers = await User.find({})
      .populate('assignedTrainer', 'name email author_id')
      .select("-password");
    } catch (error) {
    console.error('Error during test:', error);
  } finally {
    mongoose.disconnect();
  }
};

testUsersAPI();
