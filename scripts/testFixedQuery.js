const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');

connectDB();

const testFixedQuery = async () => {
  try {
    console.log('=== Testing Fixed Unassigned Trainees Query ===');

    // Test the corrected query
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
    console.log(`Found ${unassignedTrainees.length} unassigned trainees:`);
    unassignedTrainees.forEach(trainee => {
      console.log(`- ${trainee.name} (${trainee.email}) - assignedTrainer: ${trainee.assignedTrainer}`);
    });

    // Test all trainees to see the data structure
    console.log('\n--- All trainees data structure ---');
    const allTrainees = await User.find({ role: 'trainee' }).select("-password");
    console.log(`Found ${allTrainees.length} total trainees:`);
    allTrainees.forEach(trainee => {
      console.log(`- ${trainee.name}: assignedTrainer type: ${typeof trainee.assignedTrainer}, value: ${trainee.assignedTrainer}`);
    });

    console.log('\n=== Test completed successfully ===');

  } catch (error) {
    console.error('Error during test:', error);
    console.error('Error stack:', error.stack);
  } finally {
    mongoose.disconnect();
  }
};

testFixedQuery();
