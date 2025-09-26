const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/taskmanager';
    // console.log('Connecting to MongoDB with URI:', mongoUri);
    await mongoose.connect(mongoUri, {});
    // console.log("MongoDB connected successfully");
  } catch (err) {
    console.error("Error connecting to MongoDB", err);
    process.exit(1);
  }
};

module.exports = connectDB;
