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
    console.log('=== Testing Allocation System ===');
    
    // Find a trainee
    const trainee = await User.findOne({ role: 'trainee' });
    if (!trainee) {
      console.log('No trainee found');
      return;
    }
    
    console.log('Found trainee:', {
      _id: trainee._id,
      author_id: trainee.author_id,
      name: trainee.name,
      email: trainee.email
    });
    
    // Find a campus
    const campus = await Campus.findOne();
    if (!campus) {
      console.log('No campus found, creating one...');
      const newCampus = await Campus.create({
        name: 'Test Campus',
        location: 'Test Location',
        capacity: 100,
        createdBy: trainee._id
      });
      console.log('Created campus:', newCampus);
    }
    
    const campusToUse = campus || await Campus.findOne();
    console.log('Using campus:', {
      _id: campusToUse._id,
      name: campusToUse.name
    });
    
    // Check existing allocations
    const existingAllocations = await Allocation.find({});
    console.log('Existing allocations:', existingAllocations.length);
    existingAllocations.forEach(alloc => {
      console.log('  - Allocation:', {
        id: alloc._id,
        traineeId: alloc.traineeId,
        campusName: alloc.campusName,
        status: alloc.status
      });
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
    
    console.log('Created test allocation:', {
      id: testAllocation._id,
      traineeId: testAllocation.traineeId,
      campusName: testAllocation.campusName,
      status: testAllocation.status
    });
    
    // Test querying by trainee ID
    const traineeIdToQuery = trainee.author_id || trainee._id.toString();
    console.log('Querying with traineeId:', traineeIdToQuery);
    
    const foundAllocations = await Allocation.find({
      $or: [
        { traineeId: traineeIdToQuery },
        { traineeId: traineeIdToQuery.toString() }
      ]
    });
    
    console.log('Found allocations for trainee:', foundAllocations.length);
    foundAllocations.forEach(alloc => {
      console.log('  - Found allocation:', {
        id: alloc._id,
        traineeId: alloc.traineeId,
        campusName: alloc.campusName
      });
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    mongoose.connection.close();
  }
}

testAllocation();
