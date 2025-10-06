const mongoose = require('mongoose');
const User = require('../models/User');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/taskmanager', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const testTrainerDashboard = async () => {
  try {
    // Find a trainer
    const trainer = await User.findOne({ role: 'trainer' })
      .populate('assignedTrainees', 'name email employeeId department lastClockIn lastClockOut')
      .select('name email assignedTrainees');
    
    if (!trainer) {
      return;
    }
    
    if (trainer.assignedTrainees.length > 0) {
      trainer.assignedTrainees.forEach((trainee, index) => {
        });
    } else {
      }
    
    // Check if there are any assignments in the Assignment collection
    const Assignment = require('../models/Assignment');
    const assignments = await Assignment.find({ 
      trainer: trainer.author_id, 
      status: 'active' 
    });
    
    if (assignments.length > 0) {
      assignments.forEach((assignment, index) => {
        });
    }
    
  } catch (error) {
    console.error('Error testing trainer dashboard:', error);
  } finally {
    mongoose.connection.close();
  }
};

testTrainerDashboard();
