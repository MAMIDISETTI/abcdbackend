const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');

connectDB();

const ensureTrainerData = async () => {
  try {
    console.log('Ensuring trainer has assigned trainees...');

    // Find or create a trainer
    let trainer = await User.findOne({ role: 'trainer' });
    if (!trainer) {
      console.log('No trainer found. Creating a test trainer...');
      trainer = await User.create({
        name: 'Test Trainer',
        email: 'test.trainer@example.com',
        role: 'trainer',
        author_id: `trainer-${Date.now()}`,
        password: 'password123',
        passwordChanged: true,
        assignedTrainees: []
      });
      console.log('Test trainer created:', trainer.name);
    } else {
      console.log('Using existing trainer:', trainer.name);
    }

    // Find or create a trainee
    let trainee = await User.findOne({ role: 'trainee', assignedTrainer: null });
    if (!trainee) {
      console.log('No unassigned trainee found. Creating a test trainee...');
      trainee = await User.create({
        name: 'Test Trainee',
        email: 'test.trainee@example.com',
        role: 'trainee',
        author_id: `trainee-${Date.now()}`,
        password: 'password123',
        passwordChanged: false,
        assignedTrainer: null
      });
      console.log('Test trainee created:', trainee.name);
    } else {
      console.log('Using existing trainee:', trainee.name);
    }

    // Ensure trainer's assignedTrainees is an array
    if (!trainer.assignedTrainees || !Array.isArray(trainer.assignedTrainees)) {
      trainer.assignedTrainees = [];
      await trainer.save();
      console.log('Trainer assignedTrainees initialized.');
    }

    // Check if trainee is already assigned to this trainer
    if (!trainer.assignedTrainees.some(tId => tId.equals(trainee._id))) {
      // Assign trainee to trainer
      trainer.assignedTrainees.push(trainee._id);
      await trainer.save();
      console.log(`Trainee ${trainee.name} assigned to trainer ${trainer.name}.`);
    } else {
      console.log(`Trainee ${trainee.name} is already assigned to trainer ${trainer.name}.`);
    }

    // Update trainee's assignedTrainer
    if (!trainee.assignedTrainer || !trainee.assignedTrainer.equals(trainer._id)) {
      trainee.assignedTrainer = trainer._id;
      await trainee.save();
      console.log(`Trainee ${trainee.name} assignedTrainer updated to ${trainer.name}.`);
    } else {
      console.log(`Trainee ${trainee.name} already has assignedTrainer set to ${trainer.name}.`);
    }

    // Verify the assignment
    const updatedTrainer = await User.findById(trainer._id)
      .populate('assignedTrainees', 'name email')
      .select('name email assignedTrainees');

    console.log(`\nFinal verification:`);
    console.log(`Trainer: ${updatedTrainer.name}`);
    console.log(`Assigned trainees: ${updatedTrainer.assignedTrainees.length}`);
    updatedTrainer.assignedTrainees.forEach(t => {
      console.log(`- ${t.name} (${t.email})`);
    });

    console.log('\nTrainer data setup completed successfully!');

  } catch (error) {
    console.error('Error setting up trainer data:', error);
  } finally {
    mongoose.disconnect();
  }
};

ensureTrainerData();
