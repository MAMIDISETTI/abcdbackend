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
    console.log('Starting assignment fix...');
    
    // Get all assignments
    const assignments = await Assignment.find({ status: 'active' });
    console.log(`Found ${assignments.length} active assignments`);
    
    for (const assignment of assignments) {
      console.log(`Processing assignment for trainer ${assignment.trainer}`);
      
      // Get trainer ObjectId
      const trainer = await User.findOne({ author_id: assignment.trainer }).select('_id');
      if (!trainer) {
        console.log(`Trainer not found: ${assignment.trainer}`);
        continue;
      }
      
      // Get trainee ObjectIds
      const trainees = await User.find({ author_id: { $in: assignment.trainees } }).select('_id');
      const traineeObjectIds = trainees.map(t => t._id);
      
      console.log(`Found ${traineeObjectIds.length} trainees for trainer ${assignment.trainer}`);
      
      // Update trainer's assignedTrainees
      await User.findByIdAndUpdate(trainer._id, {
        assignedTrainees: traineeObjectIds
      });
      
      // Update trainees' assignedTrainer
      await User.updateMany(
        { author_id: { $in: assignment.trainees } },
        { assignedTrainer: trainer._id }
      );
      
      console.log(`Updated assignment for trainer ${assignment.trainer}`);
    }
    
    console.log('Assignment fix completed successfully!');
    
    // Verify the fix
    const trainersWithTrainees = await User.find({ 
      role: 'trainer', 
      assignedTrainees: { $exists: true, $ne: [] } 
    }).populate('assignedTrainees', 'name email');
    
    console.log(`\nVerification: Found ${trainersWithTrainees.length} trainers with assigned trainees`);
    trainersWithTrainees.forEach(trainer => {
      console.log(`- ${trainer.name}: ${trainer.assignedTrainees.length} trainees`);
    });
    
  } catch (error) {
    console.error('Error fixing assignments:', error);
  } finally {
    mongoose.connection.close();
  }
};

fixAssignments();
