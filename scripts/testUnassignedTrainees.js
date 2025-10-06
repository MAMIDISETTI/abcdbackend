const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');

connectDB();

const testUnassignedTrainees = async () => {
  try {
    // Test the exact query that's failing
    const query = {
      role: 'trainee',
      $or: [
        { assignedTrainer: { $exists: false } },
        { assignedTrainer: null },
        { assignedTrainer: '' }
      ]
    };

    // Test the query without populate
    const unassignedTrainees = await User.find(query).select("-password");
    unassignedTrainees.forEach(trainee => {
      });

    // Test the query with populate (this might be causing the issue)
    try {
      const unassignedTraineesWithPopulate = await User.find(query)
        .populate('assignedTrainer', 'name email author_id')
        .select("-password");
      } catch (populateError) {
      console.error('Error with populate:', populateError.message);
    }

    // Test all trainees to see the data structure
    const allTrainees = await User.find({ role: 'trainee' }).select("-password");
    allTrainees.forEach(trainee => {
      });

    } catch (error) {
    console.error('Error during test:', error);
    console.error('Error stack:', error.stack);
  } finally {
    mongoose.disconnect();
  }
};

testUnassignedTrainees();
