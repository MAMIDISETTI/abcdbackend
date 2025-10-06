const mongoose = require('mongoose');
const User = require('../models/User');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/taskmanager', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const testDatabaseConnection = async () => {
  try {
    // Test basic connection
    // Test User model
    const userCount = await User.countDocuments();
    // Test finding a trainer
    const trainers = await User.find({ role: 'trainer' }).select('name email role');
    trainers.forEach((trainer, index) => {
      });
    
    // Test finding a trainee
    const trainees = await User.find({ role: 'trainee' }).select('name email role');
    trainees.forEach((trainee, index) => {
      });
    
    // Test populate functionality
    if (trainers.length > 0) {
      const trainer = await User.findById(trainers[0]._id)
        .populate('assignedTrainees', 'name email')
        .select('name email assignedTrainees');
      
      }
    
  } catch (error) {
    console.error('Database connection test failed:', error);
    console.error('Error stack:', error.stack);
  } finally {
    mongoose.connection.close();
  }
};

testDatabaseConnection();
