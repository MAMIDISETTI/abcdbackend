const mongoose = require('mongoose');
const User = require('../models/User');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/taskmanager', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const quickFixTrainers = async () => {
  try {
    // Update all trainers to have assignedTrainees field
    const result = await User.updateMany(
      { role: 'trainer' },
      { $set: { assignedTrainees: [] } }
    );
    
    // Verify the fix
    const trainers = await User.find({ role: 'trainer' })
      .select('name email assignedTrainees');
    
    trainers.forEach(trainer => {
      });
    
  } catch (error) {
    console.error('Error fixing trainers:', error);
  } finally {
    mongoose.connection.close();
  }
};

quickFixTrainers();
