const mongoose = require('mongoose');
const User = require('../models/User');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/taskmanager', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const testTrainerDashboard = async () => {
  try {
    console.log('Testing trainer dashboard data...');
    
    // Find a trainer
    const trainer = await User.findOne({ role: 'trainer' })
      .populate('assignedTrainees', 'name email employeeId department lastClockIn lastClockOut')
      .select('name email assignedTrainees');
    
    if (!trainer) {
      console.log('No trainer found');
      return;
    }
    
    console.log(`\nTrainer: ${trainer.name} (${trainer.email})`);
    console.log(`Assigned Trainees: ${trainer.assignedTrainees.length}`);
    
    if (trainer.assignedTrainees.length > 0) {
      console.log('\nTrainee Details:');
      trainer.assignedTrainees.forEach((trainee, index) => {
        console.log(`${index + 1}. ${trainee.name} (${trainee.email})`);
        console.log(`   - Employee ID: ${trainee.employeeId || 'N/A'}`);
        console.log(`   - Department: ${trainee.department || 'N/A'}`);
        console.log(`   - Last Clock In: ${trainee.lastClockIn || 'Never'}`);
        console.log(`   - Last Clock Out: ${trainee.lastClockOut || 'Never'}`);
      });
    } else {
      console.log('No trainees assigned to this trainer');
    }
    
    // Check if there are any assignments in the Assignment collection
    const Assignment = require('../models/Assignment');
    const assignments = await Assignment.find({ 
      trainer: trainer.author_id, 
      status: 'active' 
    });
    
    console.log(`\nActive Assignments: ${assignments.length}`);
    if (assignments.length > 0) {
      assignments.forEach((assignment, index) => {
        console.log(`${index + 1}. Assignment ID: ${assignment._id}`);
        console.log(`   - Trainees: ${assignment.trainees.length}`);
        console.log(`   - Status: ${assignment.status}`);
      });
    }
    
  } catch (error) {
    console.error('Error testing trainer dashboard:', error);
  } finally {
    mongoose.connection.close();
  }
};

testTrainerDashboard();
