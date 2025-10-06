const mongoose = require('mongoose');
const User = require('../models/User');
const Assignment = require('../models/Assignment');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/taskmanager', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const fixAssignments = async () => {
  try {
    // Get all assignments
    const assignments = await Assignment.find({ status: 'active' });
    for (const assignment of assignments) {
      // Get trainer ObjectId
      const trainer = await User.findOne({ author_id: assignment.trainer }).select('_id');
      if (!trainer) {
        continue;
      }
      
      // Get trainee ObjectIds
      const trainees = await User.find({ author_id: { $in: assignment.trainees } }).select('_id');
      const traineeObjectIds = trainees.map(t => t._id);
      
      // Update trainer's assignedTrainees
      await User.findByIdAndUpdate(trainer._id, {
        assignedTrainees: traineeObjectIds
      });
      
      // Update trainees' assignedTrainer
      await User.updateMany(
        { author_id: { $in: assignment.trainees } },
        { assignedTrainer: trainer._id }
      );
      
      }
    
    // Verify the fix
    const trainersWithTrainees = await User.find({ 
      role: 'trainer', 
      assignedTrainees: { $exists: true, $ne: [] } 
    }).populate('assignedTrainees', 'name email');
    
    trainersWithTrainees.forEach(trainer => {
      });
    
  } catch (error) {
    console.error('Error fixing assignments:', error);
  } finally {
    mongoose.connection.close();
  }
};

fixAssignments();
