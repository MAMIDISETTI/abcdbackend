const mongoose = require("mongoose");
const User = require("./models/User");

// Connect to MongoDB
mongoose.connect("mongodb://localhost:27017/taskmanager", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function testTrainerAssignments() {
  try {
    console.log("=== TESTING TRAINER ASSIGNMENTS ===");
    
    // Get all trainers
    const trainers = await User.find({ role: "trainer" }).select('name email assignedTrainees');
    console.log(`\nFound ${trainers.length} trainers:`);
    trainers.forEach(trainer => {
      console.log(`- ${trainer.name} (${trainer.email})`);
      console.log(`  assignedTrainees: ${trainer.assignedTrainees ? trainer.assignedTrainees.length : 0}`);
    });
    
    // Get all trainees
    const trainees = await User.find({ role: "trainee" }).select('name email assignedTrainer');
    console.log(`\nFound ${trainees.length} trainees:`);
    trainees.forEach(trainee => {
      console.log(`- ${trainee.name} (${trainee.email})`);
      console.log(`  assignedTrainer: ${trainee.assignedTrainer || 'None'}`);
    });
    
    // Check assignments
    console.log("\n=== ASSIGNMENT ANALYSIS ===");
    const traineesWithTrainers = trainees.filter(t => t.assignedTrainer);
    console.log(`Trainees with assigned trainers: ${traineesWithTrainers.length}`);
    
    const traineesWithoutTrainers = trainees.filter(t => !t.assignedTrainer);
    console.log(`Trainees without assigned trainers: ${traineesWithoutTrainers.length}`);
    
    // Check if any trainer has assigned trainees
    const trainersWithTrainees = trainers.filter(t => t.assignedTrainees && t.assignedTrainees.length > 0);
    console.log(`Trainers with assigned trainees: ${trainersWithTrainees.length}`);
    
    // Check reverse assignments (trainees pointing to trainers)
    console.log("\n=== REVERSE ASSIGNMENT CHECK ===");
    for (const trainer of trainers) {
      const traineesAssignedToThisTrainer = trainees.filter(trainee => 
        trainee.assignedTrainer && trainee.assignedTrainer.toString() === trainer._id.toString()
      );
      console.log(`${trainer.name}: ${traineesAssignedToThisTrainer.length} trainees assigned to them`);
    }
    
  } catch (error) {
    console.error("Error:", error);
  } finally {
    mongoose.connection.close();
  }
}

testTrainerAssignments();
