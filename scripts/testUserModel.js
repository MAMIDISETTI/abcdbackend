const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');

connectDB();

const testUserModel = async () => {
  try {
    // Test 1: Basic connection
    const userCount = await User.countDocuments();
    // Test 2: Find trainers
    const trainers = await User.find({ role: 'trainer' }).select('name email assignedTrainees');
    if (trainers.length > 0) {
      const trainer = trainers[0];
      }

    // Test 3: Test populate
    if (trainers.length > 0) {
      const trainerId = trainers[0]._id;
      try {
        const populatedTrainer = await User.findById(trainerId)
          .populate('assignedTrainees', 'name email employeeId department lastClockIn lastClockOut')
          .select('name email assignedTrainees');
        
        if (populatedTrainer.assignedTrainees && populatedTrainer.assignedTrainees.length > 0) {
          populatedTrainer.assignedTrainees.forEach((trainee, index) => {
            });
        }
        
      } catch (populateError) {
        }
    }

    // Test 4: Check for any validation issues
    try {
      const testUser = new User({
        name: 'Test User',
        email: 'test@example.com',
        role: 'trainer',
        password: 'password123',
        assignedTrainees: []
      });
      
      // Don't save, just validate
      await testUser.validate();
      } catch (validationError) {
      }

    } catch (error) {
    console.error('❌ Error during User model test:', error);
  } finally {
    mongoose.disconnect();
  }
};

testUserModel();
