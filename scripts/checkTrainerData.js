const mongoose = require('mongoose');
const User = require('../models/User');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/taskmanager', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const checkTrainerData = async () => {
  try {
    // Find all trainers
    const trainers = await User.find({ role: 'trainer' })
      .populate('assignedTrainees', 'name email')
      .select('name email assignedTrainees author_id');
    
    if (trainers.length === 0) {
      return;
    }
    
    trainers.forEach((trainer, index) => {
      if (trainer.assignedTrainees.length > 0) {
        trainer.assignedTrainees.forEach((trainee, traineeIndex) => {
          });
      } else {
        }
    });
    
    // Check if there are any trainees
    const trainees = await User.find({ role: 'trainee' }).select('name email assignedTrainer author_id');
    if (trainees.length > 0) {
      trainees.forEach((trainee, index) => {
        });
    }
    
  } catch (error) {
    console.error('Error checking trainer data:', error);
  } finally {
    mongoose.connection.close();
  }
};

checkTrainerData();
