const mongoose = require('mongoose');
const User = require('../models/User');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/taskmanager', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const fixTrainerAssignedTrainees = async () => {
  try {
    // Find all trainers without assignedTrainees field or with undefined/null
    const trainers = await User.find({ 
      role: 'trainer',
      $or: [
        { assignedTrainees: { $exists: false } },
        { assignedTrainees: null },
        { assignedTrainees: undefined }
      ]
    });
    
    if (trainers.length === 0) {
      return;
    }
    
    // Update each trainer to have an empty assignedTrainees array
    for (const trainer of trainers) {
      await User.findByIdAndUpdate(trainer._id, {
        $set: { assignedTrainees: [] }
      });
      }
    
    // Verify the fix
    const updatedTrainers = await User.find({ role: 'trainer' })
      .populate('assignedTrainees', 'name email')
      .select('name email assignedTrainees');
    
    updatedTrainers.forEach(trainer => {
      });
    
  } catch (error) {
    console.error('Error fixing trainer assignedTrainees:', error);
  } finally {
    mongoose.connection.close();
  }
};

fixTrainerAssignedTrainees();
