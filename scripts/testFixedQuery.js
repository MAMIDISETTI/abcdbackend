const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');

connectDB();

const testFixedQuery = async () => {
  try {
    // Test the corrected query
    const query = {
      role: 'trainee',
      $or: [
        { assignedTrainer: { $exists: false } },
        { assignedTrainer: null }
      ]
    };

    // Test the query
    const unassignedTrainees = await User.find(query).select("-password");
    unassignedTrainees.forEach(trainee => {
      });

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

testFixedQuery();
