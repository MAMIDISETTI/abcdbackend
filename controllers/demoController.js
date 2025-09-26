const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/demos';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only video files are allowed!'), false);
    }
  }
});

// Upload demo
const uploadDemo = async (req, res) => {
  try {
    const { title, description, courseTag, type, traineeId, traineeName } = req.body;
    
    if (!title || !description || !traineeId) {
      return res.status(400).json({
        success: false,
        message: 'Title, description, and traineeId are required'
      });
    }

    let fileUrl = null;
    if (req.file) {
      fileUrl = `/uploads/demos/${req.file.filename}`;
    }

    // Here you would save to database
    // For now, we'll return a mock response
    const demo = {
      id: Date.now().toString(),
      title,
      description,
      courseTag: courseTag || '',
      type: type || 'online',
      fileName: req.file ? req.file.originalname : null,
      fileUrl,
      traineeId,
      traineeName: traineeName || 'Trainee',
      uploadedAt: new Date().toISOString(),
      status: 'under_review',
      rating: 0,
      feedback: '',
      reviewedBy: null,
      reviewedAt: null,
      masterTrainerReview: null,
      masterTrainerReviewedBy: null,
      masterTrainerReviewedAt: null,
      rejectionReason: null
    };

    res.status(201).json({
      success: true,
      message: 'Demo uploaded successfully',
      demo: demo
    });

  } catch (error) {
    console.error('Error uploading demo:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload demo',
      error: error.message
    });
  }
};

// Get all demos for a trainee
const getDemos = async (req, res) => {
  try {
    const { traineeId } = req.query;
    
    // Here you would fetch from database
    // For now, return mock data
    const demos = [
      {
        id: '1',
        title: 'React Component Demo',
        description: 'Demonstration of React component lifecycle and state management',
        courseTag: 'React',
        type: 'online',
        fileName: 'react-demo.mp4',
        fileUrl: '/uploads/demos/react-demo.mp4',
        traineeId: traineeId || 'trainee1',
        traineeName: 'Trainee',
        uploadedAt: new Date(Date.now() - 172800000).toISOString(),
        status: 'review_complete',
        rating: 4.5,
        feedback: 'Excellent demonstration of React concepts! Great job on explaining the lifecycle methods.',
        reviewedBy: 'John Trainer',
        reviewedAt: new Date(Date.now() - 86400000).toISOString(),
        masterTrainerReview: 'approved',
        masterTrainerReviewedBy: 'Sarah Master',
        masterTrainerReviewedAt: new Date(Date.now() - 43200000).toISOString(),
        rejectionReason: null
      }
    ];

    res.status(200).json({
      success: true,
      demos: demos
    });

  } catch (error) {
    console.error('Error fetching demos:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch demos',
      error: error.message
    });
  }
};

// Get demo by ID
const getDemoById = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Here you would fetch from database
    // For now, return mock data
    const demo = {
      id: id,
      title: 'Sample Demo',
      description: 'This is a sample demo',
      courseTag: 'React',
      type: 'online',
      fileName: 'sample-demo.mp4',
      fileUrl: '/uploads/demos/sample-demo.mp4',
      traineeId: 'trainee1',
      traineeName: 'Trainee',
      uploadedAt: new Date().toISOString(),
      status: 'under_review',
      rating: 0,
      feedback: '',
      reviewedBy: null,
      reviewedAt: null,
      masterTrainerReview: null,
      masterTrainerReviewedBy: null,
      masterTrainerReviewedAt: null,
      rejectionReason: null
    };

    res.status(200).json({
      success: true,
      demo: demo
    });

  } catch (error) {
    console.error('Error fetching demo:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch demo',
      error: error.message
    });
  }
};

// Update demo (for reviews)
const updateDemo = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, rating, feedback, reviewedBy, action } = req.body;
    
    // Here you would update in database
    // For now, return success
    res.status(200).json({
      success: true,
      message: 'Demo updated successfully'
    });

  } catch (error) {
    console.error('Error updating demo:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update demo',
      error: error.message
    });
  }
};

// Delete demo
const deleteDemo = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Here you would delete from database and remove file
    // For now, return success
    res.status(200).json({
      success: true,
      message: 'Demo deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting demo:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete demo',
      error: error.message
    });
  }
};

module.exports = {
  upload,
  uploadDemo,
  getDemos,
  getDemoById,
  updateDemo,
  deleteDemo
};
