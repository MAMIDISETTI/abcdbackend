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
    console.log('Testing JWT authentication...');
    
    // Find a trainer
    const trainer = await User.findOne({ role: 'trainer' });
    if (!trainer) {
      console.log('No trainer found, creating one...');
      const newTrainer = await User.create({
        author_id: 'TEST_TRAINER_001',
        name: 'Test Trainer',
        email: 'testtrainer@example.com',
        password: 'password123',
        role: 'trainer',
        department: 'IT',
        assignedTrainees: []
      });
      console.log('Created trainer:', newTrainer.name);
      trainer = newTrainer;
    }
    
    console.log(`Using trainer: ${trainer.name} (${trainer.email})`);
    
    // Create JWT token
    const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
    const token = jwt.sign(
      { id: trainer._id, role: trainer.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    console.log('JWT Token created successfully');
    console.log('Token length:', token.length);
    
    // Verify the token
    const decoded = jwt.verify(token, JWT_SECRET);
    console.log('Token decoded successfully:');
    console.log('- ID:', decoded.id);
    console.log('- Role:', decoded.role);
    console.log('- Expires:', new Date(decoded.exp * 1000));
    
    // Test if the ID matches
    if (decoded.id.toString() === trainer._id.toString()) {
      console.log('✅ JWT authentication test passed');
    } else {
      console.log('❌ JWT authentication test failed - ID mismatch');
    }
    
  } catch (error) {
    console.error('JWT test failed:', error);
    console.error('Error stack:', error.stack);
  } finally {
    mongoose.connection.close();
  }
};

testJWT();
