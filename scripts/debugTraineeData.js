const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');

connectDB();

const debugTraineeData = async () => {
  try {
    // Get all trainees without populate first
    const rawTrainees = await User.find({ role: 'trainee' }).select("-password");
    rawTrainees.forEach((trainee, index) => {
      });

    // Test the unassigned query
    const unassignedQuery = {
      role: 'trainee',
      $or: [
        { assignedTrainer: { $exists: false } },
        { assignedTrainer: null }
      ]
    };
    
    const unassignedTrainees = await User.find(unassignedQuery).select("-password");
    // Test with populate
    const traineesWithPopulate = await User.find({ role: 'trainee' })
      .populate('assignedTrainer', 'name email author_id')
      .select("-password");
    
    traineesWithPopulate.forEach((trainee, index) => {
      if (trainee.assignedTrainer) {
        }
    });

    // Count trainees with assigned trainers
    const traineesWithTrainers = traineesWithPopulate.filter(t => t.assignedTrainer);
    } catch (error) {
    console.error('Error during debug:', error);
    console.error('Error stack:', error.stack);
  } finally {
    mongoose.disconnect();
  }
};

debugTraineeData();
