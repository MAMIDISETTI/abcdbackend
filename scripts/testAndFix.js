const mongoose = require('mongoose');
const User = require('../models/User');
const Assignment = require('../models/Assignment');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/taskmanager', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const testAndFix = async () => {
  try {
    // Step 1: Fix all trainers
    const result = await User.updateMany(
      { role: 'trainer' },
      { $set: { assignedTrainees: [] } }
    );
    // Step 2: Check if we have trainees
    const trainees = await User.find({ role: 'trainee' }).select('name email');
    if (trainees.length === 0) {
      const newTrainee = await User.create({
        author_id: 'TEST_TRAINEE_' + Date.now(),
        name: 'Test Trainee',
        email: 'testtrainee@example.com',
        password: 'password123',
        role: 'trainee',
        department: 'IT',
        assignedTrainer: null
      });
      trainees.push(newTrainee);
    }
    
    // Step 3: Get a trainer
    const trainer = await User.findOne({ role: 'trainer' });
    if (!trainer) {
      return;
    }
    // Step 4: Create assignment
    const assignment = await Assignment.create({
      masterTrainer: trainer._id,
      trainer: trainer.author_id,
      trainees: [trainees[0].author_id],
      assignmentDate: new Date(),
      effectiveDate: new Date(),
      totalTrainees: 1,
      activeTrainees: 1,
      notes: "Test assignment",
      instructions: "Test instructions",
      createdBy: trainer._id,
      status: "active"
    });
    // Step 5: Update trainer's assignedTrainees
    await User.findByIdAndUpdate(trainer._id, {
      $addToSet: { assignedTrainees: trainees[0]._id }
    });
    
    // Step 6: Update trainee's assignedTrainer
    await User.findByIdAndUpdate(trainees[0]._id, {
      assignedTrainer: trainer._id
    });
    
    // Step 7: Verify
    const updatedTrainer = await User.findById(trainer._id)
      .populate('assignedTrainees', 'name email');
    
    if (updatedTrainer.assignedTrainees.length > 0) {
      updatedTrainer.assignedTrainees.forEach((trainee, index) => {
        });
    }
    
  } catch (error) {
    console.error('Error in test and fix:', error);
  } finally {
    mongoose.connection.close();
  }
};

testAndFix();
