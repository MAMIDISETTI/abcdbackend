const mongoose = require('mongoose');
const User = require('../models/User');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/taskmanager', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const testDatabaseConnection = async () => {
  try {
    console.log('Testing database connection...');
    
    // Test basic connection
    console.log('MongoDB connected successfully');
    
    // Test User model
    console.log('Testing User model...');
    const userCount = await User.countDocuments();
    console.log(`Total users in database: ${userCount}`);
    
    // Test finding a trainer
    console.log('Looking for trainers...');
    const trainers = await User.find({ role: 'trainer' }).select('name email role');
    console.log(`Found ${trainers.length} trainers:`);
    trainers.forEach((trainer, index) => {
      console.log(`${index + 1}. ${trainer.name} (${trainer.email})`);
    });
    
    // Test finding a trainee
    console.log('Looking for trainees...');
    const trainees = await User.find({ role: 'trainee' }).select('name email role');
    console.log(`Found ${trainees.length} trainees:`);
    trainees.forEach((trainee, index) => {
      console.log(`${index + 1}. ${trainee.name} (${trainee.email})`);
    });
    
    // Test populate functionality
    if (trainers.length > 0) {
      console.log('Testing populate functionality...');
      const trainer = await User.findById(trainers[0]._id)
        .populate('assignedTrainees', 'name email')
        .select('name email assignedTrainees');
      
      console.log(`Trainer: ${trainer.name}`);
      console.log(`Assigned trainees: ${trainer.assignedTrainees.length}`);
    }
    
  } catch (error) {
    console.error('Database connection test failed:', error);
    console.error('Error stack:', error.stack);
  } finally {
    mongoose.connection.close();
  }
};

testDatabaseConnection();
