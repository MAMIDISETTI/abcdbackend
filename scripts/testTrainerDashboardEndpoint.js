const mongoose = require('mongoose');
const User = require('../models/User');
const jwt = require('jsonwebtoken');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/taskmanager', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const testTrainerDashboardEndpoint = async () => {
  try {
    console.log('Testing trainer dashboard endpoint...');
    
    // Find a trainer
    const trainer = await User.findOne({ role: 'trainer' })
      .populate('assignedTrainees', 'name email employeeId department lastClockIn lastClockOut')
      .select('name email assignedTrainees');
    
    if (!trainer) {
      console.log('No trainer found');
      return;
    }
    
    console.log(`Testing with trainer: ${trainer.name}`);
    console.log(`Assigned trainees: ${trainer.assignedTrainees.length}`);
    
    // Create a JWT token for the trainer
    const token = jwt.sign(
      { id: trainer._id, role: trainer.role },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );
    
    console.log('JWT Token created');
    
    // Test the dashboard controller logic
    const trainerId = trainer._id;
    const traineeIds = trainer.assignedTrainees.map(t => t._id);
    
    console.log('Trainer ID:', trainerId);
    console.log('Trainee IDs:', traineeIds);
    
    // Test date filter
    const defaultEndDate = new Date();
    const defaultStartDate = new Date();
    defaultStartDate.setDate(defaultStartDate.getDate() - 30);
    
    const dateFilter = {
      $gte: defaultStartDate,
      $lte: defaultEndDate
    };
    
    console.log('Date filter:', dateFilter);
    
    // Test if we can create the response structure
    const response = {
      overview: {
        assignedTrainees: trainer.assignedTrainees.length,
        totalDayPlans: 0,
        totalObservations: 0,
        unreadNotifications: 0
      },
      attendance: {
        totalRecords: 0,
        presentCount: 0,
        absentCount: 0,
        lateCount: 0,
        averageHours: 0
      },
      dayPlans: {
        totalPlans: 0,
        publishedPlans: 0,
        completedPlans: 0
      },
      observations: {
        totalObservations: 0,
        submittedObservations: 0,
        draftObservations: 0
      },
      assignedTrainees: trainer.assignedTrainees,
      recentDayPlans: [],
      recentObservations: [],
      notifications: []
    };
    
    console.log('Response structure created successfully');
    console.log('Overview:', response.overview);
    console.log('Assigned trainees:', response.assignedTrainees.length);
    
  } catch (error) {
    console.error('Error testing trainer dashboard endpoint:', error);
    console.error('Error stack:', error.stack);
  } finally {
    mongoose.connection.close();
  }
};

testTrainerDashboardEndpoint();
