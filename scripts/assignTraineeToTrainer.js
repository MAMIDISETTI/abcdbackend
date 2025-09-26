const mongoose = require('mongoose');
const User = require('../models/User');
const Assignment = require('../models/Assignment');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/taskmanager', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const assignTraineeToTrainer = async () => {
  try {
    console.log('Assigning trainee to trainer...');
    
    // Find a trainer
    const trainer = await User.findOne({ role: 'trainer' });
    if (!trainer) {
      console.log('No trainer found');
      return;
    }
    
    // Find a trainee
    const trainee = await User.findOne({ role: 'trainee' });
    if (!trainee) {
      console.log('No trainee found');
      return;
    }
    
    console.log(`Trainer: ${trainer.name} (${trainer.author_id})`);
    console.log(`Trainee: ${trainee.name} (${trainee.author_id})`);
    
    // Check if already assigned
    if (trainee.assignedTrainer) {
      console.log('Trainee is already assigned to a trainer');
      return;
    }
    
    // Create assignment
    const assignment = await Assignment.create({
      masterTrainer: trainer._id, // Use ObjectId for masterTrainer
      trainer: trainer.author_id, // Use author_id for trainer
      trainees: [trainee.author_id], // Use author_id for trainees
      assignmentDate: new Date(),
      effectiveDate: new Date(),
      totalTrainees: 1,
      activeTrainees: 1,
      notes: "Test assignment",
      instructions: "Test instructions",
      createdBy: trainer._id,
      status: "active"
    });
    
    console.log('Assignment created:', assignment._id);
    
    // Update trainer's assignedTrainees with ObjectId
    await User.findByIdAndUpdate(trainer._id, {
      $addToSet: { assignedTrainees: trainee._id }
    });
    
    // Update trainee's assignedTrainer with ObjectId
    await User.findByIdAndUpdate(trainee._id, {
      assignedTrainer: trainer._id
    });
    
    console.log('Assignment completed successfully!');
    
    // Verify the assignment
    const updatedTrainer = await User.findById(trainer._id)
      .populate('assignedTrainees', 'name email');
    
    const updatedTrainee = await User.findById(trainee._id)
      .populate('assignedTrainer', 'name email');
    
    console.log(`\nVerification:`);
    console.log(`Trainer ${updatedTrainer.name} now has ${updatedTrainer.assignedTrainees.length} trainees`);
    console.log(`Trainee ${updatedTrainee.name} is assigned to ${updatedTrainee.assignedTrainer?.name || 'No one'}`);
    
  } catch (error) {
    console.error('Error assigning trainee to trainer:', error);
  } finally {
    mongoose.connection.close();
  }
};

assignTraineeToTrainer();
