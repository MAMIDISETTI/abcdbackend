const mongoose = require('mongoose');
const User = require('../models/User');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/taskmanager', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const checkTrainerData = async () => {
  try {
    console.log('Checking trainer data...');
    
    // Find all trainers
    const trainers = await User.find({ role: 'trainer' })
      .populate('assignedTrainees', 'name email')
      .select('name email assignedTrainees author_id');
    
    console.log(`Found ${trainers.length} trainers`);
    
    if (trainers.length === 0) {
      console.log('No trainers found in database');
      return;
    }
    
    trainers.forEach((trainer, index) => {
      console.log(`\n${index + 1}. Trainer: ${trainer.name} (${trainer.email})`);
      console.log(`   - Author ID: ${trainer.author_id}`);
      console.log(`   - Assigned Trainees: ${trainer.assignedTrainees.length}`);
      
      if (trainer.assignedTrainees.length > 0) {
        trainer.assignedTrainees.forEach((trainee, traineeIndex) => {
          console.log(`     ${traineeIndex + 1}. ${trainee.name} (${trainee.email})`);
        });
      } else {
        console.log('     No trainees assigned');
      }
    });
    
    // Check if there are any trainees
    const trainees = await User.find({ role: 'trainee' }).select('name email assignedTrainer author_id');
    console.log(`\nFound ${trainees.length} trainees`);
    
    if (trainees.length > 0) {
      console.log('\nTrainee assignments:');
      trainees.forEach((trainee, index) => {
        console.log(`${index + 1}. ${trainee.name} (${trainee.email})`);
        console.log(`   - Author ID: ${trainee.author_id}`);
        console.log(`   - Assigned Trainer: ${trainee.assignedTrainer || 'None'}`);
      });
    }
    
  } catch (error) {
    console.error('Error checking trainer data:', error);
  } finally {
    mongoose.connection.close();
  }
};

checkTrainerData();
