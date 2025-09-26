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
    console.log('Creating test assignment...');
    
    // Find or create a trainer
    let trainer = await User.findOne({ role: 'trainer' });
    if (!trainer) {
      console.log('No trainer found, creating one...');
      trainer = await User.create({
        author_id: 'TEST_TRAINER_001',
        name: 'Test Trainer',
        email: 'testtrainer@example.com',
        password: 'password123',
        role: 'trainer',
        department: 'IT',
        assignedTrainees: []
      });
      console.log('Created trainer:', trainer.name);
    } else {
      console.log('Using existing trainer:', trainer.name);
    }
    
    // Find or create a trainee
    let trainee = await User.findOne({ role: 'trainee' });
    if (!trainee) {
      console.log('No trainee found, creating one...');
      trainee = await User.create({
        author_id: 'TEST_TRAINEE_001',
        name: 'Test Trainee',
        email: 'testtrainee@example.com',
        password: 'password123',
        role: 'trainee',
        department: 'IT',
        assignedTrainer: null
      });
      console.log('Created trainee:', trainee.name);
    } else {
      console.log('Using existing trainee:', trainee.name);
    }
    
    // Check if assignment already exists
    let assignment = await Assignment.findOne({
      trainer: trainer.author_id,
      status: 'active'
    });
    
    if (!assignment) {
      console.log('Creating assignment...');
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
      console.log('Created assignment:', assignment._id);
    } else {
      console.log('Assignment already exists:', assignment._id);
    }
    
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
    
    if (updatedTrainer.assignedTrainees.length > 0) {
      console.log('Assigned trainees:');
      updatedTrainer.assignedTrainees.forEach((trainee, index) => {
        console.log(`  ${index + 1}. ${trainee.name} (${trainee.email})`);
      });
    }
    
  } catch (error) {
    console.error('Error creating test assignment:', error);
  } finally {
    mongoose.connection.close();
  }
};

createTestAssignment();