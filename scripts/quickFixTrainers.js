const mongoose = require('mongoose');
const User = require('../models/User');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/taskmanager', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const quickFixTrainers = async () => {
  try {
    console.log('Quick fixing trainers...');
    
    // Update all trainers to have assignedTrainees field
    const result = await User.updateMany(
      { role: 'trainer' },
      { $set: { assignedTrainees: [] } }
    );
    
    console.log(`Updated ${result.modifiedCount} trainers`);
    
    // Verify the fix
    const trainers = await User.find({ role: 'trainer' })
      .select('name email assignedTrainees');
    
    console.log('\nVerification:');
    trainers.forEach(trainer => {
      console.log(`- ${trainer.name}: assignedTrainees = ${Array.isArray(trainer.assignedTrainees) ? trainer.assignedTrainees.length : 'NOT ARRAY'}`);
    });
    
  } catch (error) {
    console.error('Error fixing trainers:', error);
  } finally {
    mongoose.connection.close();
  }
};

quickFixTrainers();
