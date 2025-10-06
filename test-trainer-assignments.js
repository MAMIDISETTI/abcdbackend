const mongoose = require("mongoose");
const User = require("./models/User");

// Connect to MongoDB
mongoose.connect("mongodb://localhost:27017/taskmanager", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function testTrainerAssignments() {
  try {
    // Get all trainers
    const trainers = await User.find({ role: "trainer" }).select('name email assignedTrainees');
    trainers.forEach(trainer => {
      });
    
    // Get all trainees
    const trainees = await User.find({ role: "trainee" }).select('name email assignedTrainer');
    trainees.forEach(trainee => {
      });
    
    // Check assignments
    const traineesWithTrainers = trainees.filter(t => t.assignedTrainer);
    const traineesWithoutTrainers = trainees.filter(t => !t.assignedTrainer);
    // Check if any trainer has assigned trainees
    const trainersWithTrainees = trainers.filter(t => t.assignedTrainees && t.assignedTrainees.length > 0);
    // Check reverse assignments (trainees pointing to trainers)
    for (const trainer of trainers) {
      const traineesAssignedToThisTrainer = trainees.filter(trainee => 
        trainee.assignedTrainer && trainee.assignedTrainer.toString() === trainer._id.toString()
      );
      }
    
  } catch (error) {
    console.error("Error:", error);
  } finally {
    mongoose.connection.close();
  }
}

testTrainerAssignments();
