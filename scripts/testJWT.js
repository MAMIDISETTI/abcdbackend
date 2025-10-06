const mongoose = require('mongoose');
const User = require('../models/User');
const jwt = require('jsonwebtoken');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/taskmanager', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const testJWT = async () => {
  try {
    // Find a trainer
    const trainer = await User.findOne({ role: 'trainer' });
    if (!trainer) {
      const newTrainer = await User.create({
        author_id: 'TEST_TRAINER_001',
        name: 'Test Trainer',
        email: 'testtrainer@example.com',
        password: 'password123',
        role: 'trainer',
        department: 'IT',
        assignedTrainees: []
      });
      trainer = newTrainer;
    }
    
    // Create JWT token
    const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
    const token = jwt.sign(
      { id: trainer._id, role: trainer.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    // Verify the token
    const decoded = jwt.verify(token, JWT_SECRET);
    // Test if the ID matches
    if (decoded.id.toString() === trainer._id.toString()) {
      } else {
      }
    
  } catch (error) {
    console.error('JWT test failed:', error);
    console.error('Error stack:', error.stack);
  } finally {
    mongoose.connection.close();
  }
};

testJWT();
