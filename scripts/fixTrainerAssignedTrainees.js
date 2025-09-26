const mongoose = require('mongoose');
const User = require('../models/User');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/taskmanager', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const fixTrainerAssignedTrainees = async () => {
  try {
    console.log('Fixing trainer assignedTrainees field...');
    
    // Find all trainers without assignedTrainees field or with undefined/null
    const trainers = await User.find({ 
      role: 'trainer',
      $or: [
        { assignedTrainees: { $exists: false } },
        { assignedTrainees: null },
        { assignedTrainees: undefined }
      ]
    });
    
    console.log(`Found ${trainers.length} trainers without assignedTrainees field`);
    
    if (trainers.length === 0) {
      console.log('No trainers need fixing');
      return;
    }
    
    // Update each trainer to have an empty assignedTrainees array
    for (const trainer of trainers) {
      await User.findByIdAndUpdate(trainer._id, {
        $set: { assignedTrainees: [] }
      });
      console.log(`Updated trainer: ${trainer.name}`);
    }
    
    console.log('All trainers updated successfully!');
    
    // Verify the fix
    const updatedTrainers = await User.find({ role: 'trainer' })
      .populate('assignedTrainees', 'name email')
      .select('name email assignedTrainees');
    
    console.log('\nVerification:');
    updatedTrainers.forEach(trainer => {
      console.log(`- ${trainer.name}: ${trainer.assignedTrainees.length} assigned trainees`);
    });
    
  } catch (error) {
    console.error('Error fixing trainer assignedTrainees:', error);
  } finally {
    mongoose.connection.close();
  }
};

fixTrainerAssignedTrainees();
