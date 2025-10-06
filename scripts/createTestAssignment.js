const mongoose = require('mongoose');
const User = require('../models/User');
const Assignment = require('../models/Assignment');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/taskmanager', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const createTestAssignment = async () => {
  try {
    // Find or create a trainer
    let trainer = await User.findOne({ role: 'trainer' });
    if (!trainer) {
      trainer = await User.create({
        author_id: 'TEST_TRAINER_001',
        name: 'Test Trainer',
        email: 'testtrainer@example.com',
        password: 'password123',
        role: 'trainer',
        department: 'IT',
        assignedTrainees: []
      });
      } else {
      }
    
    // Find or create a trainee
    let trainee = await User.findOne({ role: 'trainee' });
    if (!trainee) {
      trainee = await User.create({
        author_id: 'TEST_TRAINEE_001',
        name: 'Test Trainee',
        email: 'testtrainee@example.com',
        password: 'password123',
        role: 'trainee',
        department: 'IT',
        assignedTrainer: null
      });
      } else {
      }
    
    // Check if assignment already exists
    let assignment = await Assignment.findOne({
      trainer: trainer.author_id,
      status: 'active'
    });
    
    if (!assignment) {
      assignment = await Assignment.create({
        masterTrainer: trainer._id,
        trainer: trainer.author_id,
        trainees: [trainee.author_id],
        assignmentDate: new Date(),
        effectiveDate: new Date(),
        totalTrainees: 1,
        activeTrainees: 1,
        notes: "Test assignment",
        instructions: "Test instructions",
        createdBy: trainer._id,
        status: "active"
      });
      } else {
      }
    
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
    
    if (updatedTrainer.assignedTrainees.length > 0) {
      updatedTrainer.assignedTrainees.forEach((trainee, index) => {
        });
    }
    
  } catch (error) {
    console.error('Error creating test assignment:', error);
  } finally {
    mongoose.connection.close();
  }
};

createTestAssignment();