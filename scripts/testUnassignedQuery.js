const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');

connectDB();

const testUnassignedQuery = async () => {
  try {
    console.log('=== Testing Unassigned Query ===');

    // Test the exact query from the controller
    const query = {
      role: 'trainee',
      $or: [
        { assignedTrainer: { $exists: false } },
        { assignedTrainer: null }
      ]
    };

    console.log('Query:', JSON.stringify(query, null, 2));

    // Test the query
    const unassignedTrainees = await User.find(query).select("-password");
    console.log(`Found ${unassignedTrainees.length} unassigned trainees`);

    // Also test all trainees to see their assignedTrainer values
    const allTrainees = await User.find({ role: 'trainee' }).select("-password");
    console.log(`\nAll ${allTrainees.length} trainees:`);
    
    allTrainees.forEach((trainee, index) => {
      console.log(`${index + 1}. ${trainee.name}: assignedTrainer = ${trainee.assignedTrainer} (type: ${typeof trainee.assignedTrainer})`);
    });

    // Test if the field exists in the schema
    console.log('\n--- Schema check ---');
    const sampleTrainee = await User.findOne({ role: 'trainee' });
    if (sampleTrainee) {
      console.log('Sample trainee fields:', Object.keys(sampleTrainee.toObject()));
      console.log('assignedTrainer field exists:', 'assignedTrainer' in sampleTrainee.toObject());
    }

    console.log('\n=== Test completed ===');

  } catch (error) {
    console.error('Error during test:', error);
  } finally {
    mongoose.disconnect();
  }
};

testUnassignedQuery();
