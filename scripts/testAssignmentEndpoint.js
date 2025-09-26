const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');

connectDB();

const testAssignmentEndpoint = async () => {
  try {
    console.log('Testing assignment endpoint logic...');

    // Find a trainer
    const trainer = await User.findOne({ role: 'trainer' })
      .populate('assignedTrainees', 'name email employeeId department lastClockIn lastClockOut')
      .select('name email assignedTrainees');

    if (!trainer) {
      console.log('No trainer found in the database. Please create one first.');
      return;
    }

    console.log(`Found trainer: ${trainer.name}`);
    console.log(`Assigned trainees: ${trainer.assignedTrainees?.length || 0}`);
    
    if (trainer.assignedTrainees && trainer.assignedTrainees.length > 0) {
      console.log('Trainees:');
      trainer.assignedTrainees.forEach(trainee => {
        console.log(`- ${trainee.name} (${trainee.email})`);
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

    console.log('\nResponse structure:');
    console.log(JSON.stringify(response, null, 2));

    console.log('\nAssignment endpoint test completed successfully!');

  } catch (error) {
    console.error('Error during assignment endpoint test:', error);
  } finally {
    mongoose.disconnect();
  }
};

testAssignmentEndpoint();
