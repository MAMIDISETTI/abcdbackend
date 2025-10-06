const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');

connectDB();

const checkAssignedTrainees = async () => {
  try {
    // Get all trainees with populated assignedTrainer
    const trainees = await User.find({ role: 'trainee' })
      .populate('assignedTrainer', 'name email author_id')
      .select("-password");

    trainees.forEach((trainee, index) => {
      if (trainee.assignedTrainer) {
        } else {
        }
    });

    // Check unassigned trainees
    const unassignedQuery = {
      role: 'trainee',
      $or: [
        { assignedTrainer: { $exists: false } },
        { assignedTrainer: null }
      ]
    };
    
    const unassignedTrainees = await User.find(unassignedQuery).select("-password");
    } catch (error) {
    console.error('Error during check:', error);
  } finally {
    mongoose.disconnect();
  }
};

checkAssignedTrainees();
