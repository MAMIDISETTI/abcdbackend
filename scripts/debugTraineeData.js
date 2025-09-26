const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');

connectDB();

const debugTraineeData = async () => {
  try {
    console.log('=== DEBUGGING TRAINEE DATA ===');

    // Get all trainees without populate first
    console.log('\n--- Raw trainee data (no populate) ---');
    const rawTrainees = await User.find({ role: 'trainee' }).select("-password");
    console.log(`Found ${rawTrainees.length} raw trainees:`);
    
    rawTrainees.forEach((trainee, index) => {
      console.log(`\nTrainee ${index + 1}:`);
      console.log(`  Name: ${trainee.name}`);
      console.log(`  Email: ${trainee.email}`);
      console.log(`  assignedTrainer: ${trainee.assignedTrainer}`);
      console.log(`  assignedTrainer type: ${typeof trainee.assignedTrainer}`);
      console.log(`  assignedTrainer exists: ${trainee.assignedTrainer !== undefined}`);
      console.log(`  assignedTrainer is null: ${trainee.assignedTrainer === null}`);
      console.log(`  assignedTrainer is empty: ${trainee.assignedTrainer === ''}`);
    });

    // Test the unassigned query
    console.log('\n--- Testing unassigned query ---');
    const unassignedQuery = {
      role: 'trainee',
      $or: [
        { assignedTrainer: { $exists: false } },
        { assignedTrainer: null }
      ]
    };
    
    console.log('Unassigned query:', JSON.stringify(unassignedQuery, null, 2));
    const unassignedTrainees = await User.find(unassignedQuery).select("-password");
    console.log(`Found ${unassignedTrainees.length} unassigned trainees`);

    // Test with populate
    console.log('\n--- Testing with populate ---');
    const traineesWithPopulate = await User.find({ role: 'trainee' })
      .populate('assignedTrainer', 'name email author_id')
      .select("-password");
    
    console.log(`Found ${traineesWithPopulate.length} trainees with populate:`);
    traineesWithPopulate.forEach((trainee, index) => {
      console.log(`\nTrainee ${index + 1}:`);
      console.log(`  Name: ${trainee.name}`);
      console.log(`  assignedTrainer: ${trainee.assignedTrainer}`);
      console.log(`  assignedTrainer type: ${typeof trainee.assignedTrainer}`);
      if (trainee.assignedTrainer) {
        console.log(`  Trainer Name: ${trainee.assignedTrainer.name}`);
      }
    });

    // Count trainees with assigned trainers
    const traineesWithTrainers = traineesWithPopulate.filter(t => t.assignedTrainer);
    console.log(`\nTrainees with assigned trainers: ${traineesWithTrainers.length}`);

    console.log('\n=== Debug completed ===');

  } catch (error) {
    console.error('Error during debug:', error);
    console.error('Error stack:', error.stack);
  } finally {
    mongoose.disconnect();
  }
};

debugTraineeData();
