const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');

connectDB();

const ensureTrainerData = async () => {
  try {
    // Find or create a trainer
    let trainer = await User.findOne({ role: 'trainer' });
    if (!trainer) {
      trainer = await User.create({
        name: 'Test Trainer',
        email: 'test.trainer@example.com',
        role: 'trainer',
        author_id: `trainer-${Date.now()}`,
        password: 'password123',
        passwordChanged: true,
        assignedTrainees: []
      });
      } else {
      }

    // Find or create a trainee
    let trainee = await User.findOne({ role: 'trainee', assignedTrainer: null });
    if (!trainee) {
      trainee = await User.create({
        name: 'Test Trainee',
        email: 'test.trainee@example.com',
        role: 'trainee',
        author_id: `trainee-${Date.now()}`,
        password: 'password123',
        passwordChanged: false,
        assignedTrainer: null
      });
      } else {
      }

    // Ensure trainer's assignedTrainees is an array
    if (!trainer.assignedTrainees || !Array.isArray(trainer.assignedTrainees)) {
      trainer.assignedTrainees = [];
      await trainer.save();
      }

    // Check if trainee is already assigned to this trainer
    if (!trainer.assignedTrainees.some(tId => tId.equals(trainee._id))) {
      // Assign trainee to trainer
      trainer.assignedTrainees.push(trainee._id);
      await trainer.save();
      } else {
      }

    // Update trainee's assignedTrainer
    if (!trainee.assignedTrainer || !trainee.assignedTrainer.equals(trainer._id)) {
      trainee.assignedTrainer = trainer._id;
      await trainee.save();
      } else {
      }

    // Verify the assignment
    const updatedTrainer = await User.findById(trainer._id)
      .populate('assignedTrainees', 'name email')
      .select('name email assignedTrainees');

    updatedTrainer.assignedTrainees.forEach(t => {
      });

    } catch (error) {
    console.error('Error setting up trainer data:', error);
  } finally {
    mongoose.disconnect();
  }
};

ensureTrainerData();
