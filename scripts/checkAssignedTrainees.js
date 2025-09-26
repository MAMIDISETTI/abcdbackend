const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');

connectDB();

const checkAssignedTrainees = async () => {
  try {
    console.log('=== Checking Assigned Trainees Data ===');

    // Get all trainees with populated assignedTrainer
    const trainees = await User.find({ role: 'trainee' })
      .populate('assignedTrainer', 'name email author_id')
      .select("-password");

    console.log(`Found ${trainees.length} trainees:`);
    
    trainees.forEach((trainee, index) => {
      console.log(`\n--- Trainee ${index + 1} ---`);
      console.log(`Name: ${trainee.name}`);
      console.log(`Email: ${trainee.email}`);
      console.log(`assignedTrainer: ${trainee.assignedTrainer}`);
      console.log(`assignedTrainer type: ${typeof trainee.assignedTrainer}`);
      
      if (trainee.assignedTrainer) {
        console.log(`Trainer Name: ${trainee.assignedTrainer.name}`);
        console.log(`Trainer Email: ${trainee.assignedTrainer.email}`);
      } else {
        console.log('No assigned trainer');
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
    console.log(`\nUnassigned trainees: ${unassignedTrainees.length}`);

    console.log('\n=== Check completed ===');

  } catch (error) {
    console.error('Error during check:', error);
  } finally {
    mongoose.disconnect();
  }
};

checkAssignedTrainees();
