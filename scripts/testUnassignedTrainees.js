const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');

connectDB();

const testUnassignedTrainees = async () => {
  try {
    console.log('=== Testing Unassigned Trainees Query ===');

    // Test the exact query that's failing
    const query = {
      role: 'trainee',
      $or: [
        { assignedTrainer: { $exists: false } },
        { assignedTrainer: null },
        { assignedTrainer: '' }
      ]
    };

    console.log('Query:', JSON.stringify(query, null, 2));

    // Test the query without populate
    console.log('\n--- Testing without populate ---');
    const unassignedTrainees = await User.find(query).select("-password");
    console.log(`Found ${unassignedTrainees.length} unassigned trainees:`);
    unassignedTrainees.forEach(trainee => {
      console.log(`- ${trainee.name} (${trainee.email}) - assignedTrainer: ${trainee.assignedTrainer}`);
    });

    // Test the query with populate (this might be causing the issue)
    console.log('\n--- Testing with populate ---');
    try {
      const unassignedTraineesWithPopulate = await User.find(query)
        .populate('assignedTrainer', 'name email author_id')
        .select("-password");
      console.log(`Found ${unassignedTraineesWithPopulate.length} unassigned trainees with populate`);
    } catch (populateError) {
      console.error('Error with populate:', populateError.message);
    }

    // Test all trainees to see the data structure
    console.log('\n--- Testing all trainees ---');
    const allTrainees = await User.find({ role: 'trainee' }).select("-password");
    console.log(`Found ${allTrainees.length} total trainees:`);
    allTrainees.forEach(trainee => {
      console.log(`- ${trainee.name}: assignedTrainer type: ${typeof trainee.assignedTrainer}, value: ${trainee.assignedTrainer}`);
    });

    console.log('\n=== Test completed ===');

  } catch (error) {
    console.error('Error during test:', error);
    console.error('Error stack:', error.stack);
  } finally {
    mongoose.disconnect();
  }
};

testUnassignedTrainees();
