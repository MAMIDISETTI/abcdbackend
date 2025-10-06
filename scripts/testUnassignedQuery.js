const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');

connectDB();

const testUnassignedQuery = async () => {
  try {
    // Test the exact query from the controller
    const query = {
      role: 'trainee',
      $or: [
        { assignedTrainer: { $exists: false } },
        { assignedTrainer: null }
      ]
    };

    // Test the query
    const unassignedTrainees = await User.find(query).select("-password");
    // Also test all trainees to see their assignedTrainer values
    const allTrainees = await User.find({ role: 'trainee' }).select("-password");
    allTrainees.forEach((trainee, index) => {
      });

    // Test if the field exists in the schema
    const sampleTrainee = await User.findOne({ role: 'trainee' });
    if (sampleTrainee) {
      }

    } catch (error) {
    console.error('Error during test:', error);
  } finally {
    mongoose.disconnect();
  }
};

testUnassignedQuery();
