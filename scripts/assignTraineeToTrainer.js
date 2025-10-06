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
    // Find a trainer
    const trainer = await User.findOne({ role: 'trainer' });
    if (!trainer) {
      return;
    }
    
    // Find a trainee
    const trainee = await User.findOne({ role: 'trainee' });
    if (!trainee) {
      return;
    }
    
    // Check if already assigned
    if (trainee.assignedTrainer) {
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
    
    // Update trainer's assignedTrainees with ObjectId
    await User.findByIdAndUpdate(trainer._id, {
      $addToSet: { assignedTrainees: trainee._id }
    });
    
    // Update trainee's assignedTrainer with ObjectId
    await User.findByIdAndUpdate(trainee._id, {
      assignedTrainer: trainer._id
    });
    
    // Verify the assignment
    const updatedTrainer = await User.findById(trainer._id)
      .populate('assignedTrainees', 'name email');
    
    const updatedTrainee = await User.findById(trainee._id)
      .populate('assignedTrainer', 'name email');
    
    } catch (error) {
    console.error('Error assigning trainee to trainer:', error);
  } finally {
    mongoose.connection.close();
  }
};

assignTraineeToTrainer();
