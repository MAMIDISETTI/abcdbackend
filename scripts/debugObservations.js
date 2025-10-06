const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');

connectDB();

const debugObservations = async () => {
  try {
    // 1. Check if there are any trainers
    const trainers = await User.find({ role: 'trainer' }).select('name email assignedTrainees');
    trainers.forEach((trainer, index) => {
      });

    if (trainers.length === 0) {
      return;
    }

    // 2. Test the assignment logic for each trainer
    for (const trainer of trainers) {
      try {
        // Simulate the getTrainerAssignment logic
        const trainerWithTrainees = await User.findById(trainer._id)
          .populate('assignedTrainees', 'name email employeeId department lastClockIn lastClockOut')
          .select('name email assignedTrainees');

        if (trainerWithTrainees.assignedTrainees && trainerWithTrainees.assignedTrainees.length > 0) {
          trainerWithTrainees.assignedTrainees.forEach(trainee => {
            });
        }

        // Simulate the response structure
        const response = {
          trainer: {
            _id: trainerWithTrainees._id,
            name: trainerWithTrainees.name,
            email: trainerWithTrainees.email
          },
          trainees: trainerWithTrainees.assignedTrainees || [],
          totalTrainees: trainerWithTrainees.assignedTrainees?.length || 0,
          activeTrainees: trainerWithTrainees.assignedTrainees?.length || 0
        };

        } catch (error) {
        }
    }

    // 3. Check if there are any trainees
    const trainees = await User.find({ role: 'trainee' }).select('name email assignedTrainer');
    trainees.forEach((trainee, index) => {
      });

    // 4. Check for any potential issues
    const trainersWithoutTrainees = trainers.filter(t => !t.assignedTrainees || t.assignedTrainees.length === 0);
    if (trainersWithoutTrainees.length > 0) {
      }

    const traineesWithoutTrainer = trainees.filter(t => !t.assignedTrainer);
    if (traineesWithoutTrainer.length > 0) {
      }

    } catch (error) {
    console.error('❌ Error during debug:', error);
  } finally {
    mongoose.disconnect();
  }
};

debugObservations();
