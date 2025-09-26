const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');

connectDB();

const debugObservations = async () => {
  try {
    console.log('=== DEBUGGING OBSERVATIONS ISSUE ===');

    // 1. Check if there are any trainers
    const trainers = await User.find({ role: 'trainer' }).select('name email assignedTrainees');
    console.log(`\n1. Found ${trainers.length} trainers:`);
    trainers.forEach((trainer, index) => {
      console.log(`   ${index + 1}. ${trainer.name} (${trainer.email})`);
      console.log(`      assignedTrainees: ${trainer.assignedTrainees?.length || 0}`);
    });

    if (trainers.length === 0) {
      console.log('\n❌ No trainers found! This is the problem.');
      return;
    }

    // 2. Test the assignment logic for each trainer
    for (const trainer of trainers) {
      console.log(`\n2. Testing trainer: ${trainer.name}`);
      
      try {
        // Simulate the getTrainerAssignment logic
        const trainerWithTrainees = await User.findById(trainer._id)
          .populate('assignedTrainees', 'name email employeeId department lastClockIn lastClockOut')
          .select('name email assignedTrainees');

        console.log(`   ✅ Successfully populated trainer data`);
        console.log(`   - Name: ${trainerWithTrainees.name}`);
        console.log(`   - Email: ${trainerWithTrainees.email}`);
        console.log(`   - Assigned Trainees: ${trainerWithTrainees.assignedTrainees?.length || 0}`);

        if (trainerWithTrainees.assignedTrainees && trainerWithTrainees.assignedTrainees.length > 0) {
          console.log(`   - Trainees:`);
          trainerWithTrainees.assignedTrainees.forEach(trainee => {
            console.log(`     * ${trainee.name} (${trainee.email})`);
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

        console.log(`   ✅ Response structure is valid`);
        console.log(`   - Total trainees in response: ${response.trainees.length}`);

      } catch (error) {
        console.log(`   ❌ Error testing trainer ${trainer.name}:`, error.message);
      }
    }

    // 3. Check if there are any trainees
    const trainees = await User.find({ role: 'trainee' }).select('name email assignedTrainer');
    console.log(`\n3. Found ${trainees.length} trainees:`);
    trainees.forEach((trainee, index) => {
      console.log(`   ${index + 1}. ${trainee.name} (${trainee.email})`);
      console.log(`      assignedTrainer: ${trainee.assignedTrainer || 'None'}`);
    });

    // 4. Check for any potential issues
    console.log(`\n4. Potential issues:`);
    
    const trainersWithoutTrainees = trainers.filter(t => !t.assignedTrainees || t.assignedTrainees.length === 0);
    if (trainersWithoutTrainees.length > 0) {
      console.log(`   ⚠️  ${trainersWithoutTrainees.length} trainers have no assigned trainees`);
    }

    const traineesWithoutTrainer = trainees.filter(t => !t.assignedTrainer);
    if (traineesWithoutTrainer.length > 0) {
      console.log(`   ⚠️  ${traineesWithoutTrainer.length} trainees have no assigned trainer`);
    }

    console.log(`\n=== DEBUG COMPLETED ===`);

  } catch (error) {
    console.error('❌ Error during debug:', error);
  } finally {
    mongoose.disconnect();
  }
};

debugObservations();
