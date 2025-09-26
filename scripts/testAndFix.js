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
    console.log('Testing and fixing trainer data...');
    
    // Step 1: Fix all trainers
    console.log('Step 1: Fixing trainers...');
    const result = await User.updateMany(
      { role: 'trainer' },
      { $set: { assignedTrainees: [] } }
    );
    console.log(`Updated ${result.modifiedCount} trainers`);
    
    // Step 2: Check if we have trainees
    console.log('\nStep 2: Checking trainees...');
    const trainees = await User.find({ role: 'trainee' }).select('name email');
    console.log(`Found ${trainees.length} trainees`);
    
    if (trainees.length === 0) {
      console.log('Creating a test trainee...');
      const newTrainee = await User.create({
        author_id: 'TEST_TRAINEE_' + Date.now(),
        name: 'Test Trainee',
        email: 'testtrainee@example.com',
        password: 'password123',
        role: 'trainee',
        department: 'IT',
        assignedTrainer: null
      });
      console.log('Created trainee:', newTrainee.name);
      trainees.push(newTrainee);
    }
    
    // Step 3: Get a trainer
    console.log('\nStep 3: Getting trainer...');
    const trainer = await User.findOne({ role: 'trainer' });
    if (!trainer) {
      console.log('No trainer found!');
      return;
    }
    console.log('Using trainer:', trainer.name);
    
    // Step 4: Create assignment
    console.log('\nStep 4: Creating assignment...');
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
    console.log('Created assignment:', assignment._id);
    
    // Step 5: Update trainer's assignedTrainees
    console.log('\nStep 5: Updating trainer assignments...');
    await User.findByIdAndUpdate(trainer._id, {
      $addToSet: { assignedTrainees: trainees[0]._id }
    });
    
    // Step 6: Update trainee's assignedTrainer
    await User.findByIdAndUpdate(trainees[0]._id, {
      assignedTrainer: trainer._id
    });
    
    console.log('Assignment completed!');
    
    // Step 7: Verify
    console.log('\nStep 7: Verification...');
    const updatedTrainer = await User.findById(trainer._id)
      .populate('assignedTrainees', 'name email');
    
    console.log(`Trainer ${updatedTrainer.name} now has ${updatedTrainer.assignedTrainees.length} assigned trainees`);
    
    if (updatedTrainer.assignedTrainees.length > 0) {
      console.log('Assigned trainees:');
      updatedTrainer.assignedTrainees.forEach((trainee, index) => {
        console.log(`  ${index + 1}. ${trainee.name} (${trainee.email})`);
      });
    }
    
  } catch (error) {
    console.error('Error in test and fix:', error);
  } finally {
    mongoose.connection.close();
  }
};

testAndFix();
