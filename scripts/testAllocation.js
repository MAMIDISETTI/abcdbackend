const mongoose = require('mongoose');
const Allocation = require('../models/Allocation');
const User = require('../models/User');
const Campus = require('../models/Campus');

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/taskmanager', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function testAllocation() {
  try {
    // Find a trainee
    const trainee = await User.findOne({ role: 'trainee' });
    if (!trainee) {
      return;
    }
    
    // Find a campus
    const campus = await Campus.findOne();
    if (!campus) {
      const newCampus = await Campus.create({
        name: 'Test Campus',
        location: 'Test Location',
        capacity: 100,
        createdBy: trainee._id
      });
      }
    
    const campusToUse = campus || await Campus.findOne();
    // Check existing allocations
    const existingAllocations = await Allocation.find({});
    existingAllocations.forEach(alloc => {
      });
    
    // Create a test allocation
    const testAllocation = await Allocation.create({
      traineeId: trainee.author_id || trainee._id.toString(),
      campusId: campusToUse._id.toString(),
      campusName: campusToUse.name,
      allocatedDate: new Date(),
      status: 'confirmed',
      notes: 'Test allocation',
      allocatedBy: trainee._id
    });
    
    // Test querying by trainee ID
    const traineeIdToQuery = trainee.author_id || trainee._id.toString();
    const foundAllocations = await Allocation.find({
      $or: [
        { traineeId: traineeIdToQuery },
        { traineeId: traineeIdToQuery.toString() }
      ]
    });
    
    foundAllocations.forEach(alloc => {
      });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    mongoose.connection.close();
  }
}

testAllocation();
