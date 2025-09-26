const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');

connectDB();

const testUserModel = async () => {
  try {
    console.log('=== TESTING USER MODEL ===');

    // Test 1: Basic connection
    console.log('1. Testing database connection...');
    const userCount = await User.countDocuments();
    console.log(`   ✅ Connected to database. Found ${userCount} users.`);

    // Test 2: Find trainers
    console.log('\n2. Testing trainer lookup...');
    const trainers = await User.find({ role: 'trainer' }).select('name email assignedTrainees');
    console.log(`   ✅ Found ${trainers.length} trainers`);

    if (trainers.length > 0) {
      const trainer = trainers[0];
      console.log(`   - First trainer: ${trainer.name}`);
      console.log(`   - assignedTrainees field exists: ${trainer.assignedTrainees !== undefined}`);
      console.log(`   - assignedTrainees is array: ${Array.isArray(trainer.assignedTrainees)}`);
      console.log(`   - assignedTrainees length: ${trainer.assignedTrainees?.length || 0}`);
    }

    // Test 3: Test populate
    console.log('\n3. Testing populate functionality...');
    if (trainers.length > 0) {
      const trainerId = trainers[0]._id;
      console.log(`   Testing populate for trainer: ${trainerId}`);
      
      try {
        const populatedTrainer = await User.findById(trainerId)
          .populate('assignedTrainees', 'name email employeeId department lastClockIn lastClockOut')
          .select('name email assignedTrainees');
        
        console.log(`   ✅ Populate successful`);
        console.log(`   - Name: ${populatedTrainer.name}`);
        console.log(`   - Email: ${populatedTrainer.email}`);
        console.log(`   - Assigned Trainees: ${populatedTrainer.assignedTrainees?.length || 0}`);
        
        if (populatedTrainer.assignedTrainees && populatedTrainer.assignedTrainees.length > 0) {
          console.log(`   - Trainees:`);
          populatedTrainer.assignedTrainees.forEach((trainee, index) => {
            console.log(`     ${index + 1}. ${trainee.name} (${trainee.email})`);
          });
        }
        
      } catch (populateError) {
        console.log(`   ❌ Populate failed:`, populateError.message);
      }
    }

    // Test 4: Check for any validation issues
    console.log('\n4. Testing User model validation...');
    try {
      const testUser = new User({
        name: 'Test User',
        email: 'test@example.com',
        role: 'trainer',
        password: 'password123',
        assignedTrainees: []
      });
      
      // Don't save, just validate
      await testUser.validate();
      console.log(`   ✅ User model validation passed`);
      
    } catch (validationError) {
      console.log(`   ❌ User model validation failed:`, validationError.message);
    }

    console.log('\n=== USER MODEL TEST COMPLETED ===');

  } catch (error) {
    console.error('❌ Error during User model test:', error);
  } finally {
    mongoose.disconnect();
  }
};

testUserModel();
