const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');

connectDB();

const testAssignmentEndpoint = async () => {
  try {
    // Find a trainer
    const trainer = await User.findOne({ role: 'trainer' })
      .populate('assignedTrainees', 'name email employeeId department lastClockIn lastClockOut')
      .select('name email assignedTrainees');

    if (!trainer) {
      return;
    }

    if (trainer.assignedTrainees && trainer.assignedTrainees.length > 0) {
      trainer.assignedTrainees.forEach(trainee => {
        });
    }

    // Simulate the response structure
    const response = {
      trainer: {
        _id: trainer._id,
        name: trainer.name,
        email: trainer.email
      },
      trainees: trainer.assignedTrainees || [],
      totalTrainees: trainer.assignedTrainees?.length || 0,
      activeTrainees: trainer.assignedTrainees?.length || 0
    };

    } catch (error) {
    console.error('Error during assignment endpoint test:', error);
  } finally {
    mongoose.disconnect();
  }
};

testAssignmentEndpoint();
