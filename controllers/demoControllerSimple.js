const { cloudinary, upload } = require('../config/cloudinary');
const User = require('../models/User');

// Cloudinary configuration is now in config/cloudinary.js

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
      // Cloudinary automatically provides the secure URL
      fileUrl = req.file.path; // Cloudinary stores the URL in req.file.path
      console.log('File uploaded to Cloudinary successfully:');
      console.log('Original name:', req.file.originalname);
      console.log('Cloudinary URL:', fileUrl);
      console.log('Public ID:', req.file.filename);
    } else {
      console.log('No file uploaded');
    }

    // Create demo object
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

    // Save demo to user's demo_managements_details array
    if (traineeId) {
      try {
        console.log('Looking for user with author_id:', traineeId);
        const user = await User.findOne({ author_id: traineeId });
        if (user) {
          console.log('User found:', user.name, 'Current demo_managements_details length:', user.demo_managements_details.length);
          user.demo_managements_details.push(demo);
          await user.save();
          console.log('Demo saved to user database. New length:', user.demo_managements_details.length);
          console.log('Demo object saved:', demo);
        } else {
          console.log('User not found with traineeId:', traineeId);
          // Let's also check if there are any users in the database
          const allUsers = await User.find({}, 'author_id name email role');
          console.log('Available users:', allUsers.map(u => ({ author_id: u.author_id, name: u.name, email: u.email, role: u.role })));
        }
      } catch (dbError) {
        console.error('Error saving demo to user database:', dbError);
        // Continue with response even if database save fails
      }
    } else {
      console.log('No traineeId provided');
    }

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

// Get all demos for a trainee or trainer
const getDemos = async (req, res) => {
  try {
    const { traineeId, trainerId, status, traineeIds } = req.query;
    const requestingUser = req.user; // From auth middleware
    
    console.log('Fetching demos with params:', { traineeId, trainerId, status, traineeIds });
    console.log('Requesting user:', { id: requestingUser.id, role: requestingUser.role });
    
    // If traineeId is provided, fetch demos for that specific trainee
    if (traineeId) {
      const user = await User.findOne({ author_id: traineeId }).select('demo_managements_details name');
      
      if (!user) {
        console.log('User not found with author_id:', traineeId);
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      let demos = user.demo_managements_details || [];
      
      // Filter by status if provided
      if (status) {
        const statusArray = status.split(',');
        demos = demos.filter(demo => statusArray.includes(demo.status));
      }
      
      console.log('User found:', user.name, 'Demos count:', demos.length);
      console.log('Fetched demos from database:', demos);

      res.status(200).json({
        success: true,
        demos: demos
      });
      return;
    }
    
    // If trainerId is provided or user is a trainer, fetch demos from assigned trainees
    if (trainerId || requestingUser.role === 'trainer') {
      // Use the MongoDB _id for database queries, not the author_id UUID
      const trainerIdToUse = trainerId || requestingUser.id;
      
      console.log('Looking for trainer with ID:', trainerIdToUse);
      console.log('Requesting user:', { id: requestingUser.id, author_id: requestingUser.author_id, role: requestingUser.role });
      
      // Find trainer by MongoDB _id
      const trainer = await User.findById(trainerIdToUse).populate('assignedTrainees', 'author_id name email');
      
      if (!trainer) {
        console.log('Trainer not found with _id:', trainerIdToUse);
        return res.status(404).json({
          success: false,
          message: 'Trainer not found'
        });
      }
      
      console.log('Found trainer:', { id: trainer._id, author_id: trainer.author_id, name: trainer.name });
      console.log('Assigned trainees count:', trainer.assignedTrainees?.length || 0);
      
      if (!trainer.assignedTrainees || trainer.assignedTrainees.length === 0) {
        console.log('No assigned trainees found for trainer:', trainerIdToUse);
        return res.json({
          success: true,
          demos: []
        });
      }
      
      const assignedTraineeIds = trainer.assignedTrainees.map(trainee => trainee.author_id);
      console.log('Assigned trainee IDs:', assignedTraineeIds);
      
      // Fetch demos from all assigned trainees
      const trainees = await User.find({ 
        author_id: { $in: assignedTraineeIds } 
      }).select('author_id name email demo_managements_details');
      
      console.log('Found trainees with demos:', trainees.length);
      
      let allDemos = [];
      
      trainees.forEach(trainee => {
        console.log(`Trainee ${trainee.name} has ${trainee.demo_managements_details?.length || 0} demos`);
        if (trainee.demo_managements_details && trainee.demo_managements_details.length > 0) {
          trainee.demo_managements_details.forEach((demo, index) => {
            console.log(`Demo ${index} from DB:`, {
              id: demo.id,
              title: demo.title,
              status: demo.status,
              trainerStatus: demo.trainerStatus,
              masterTrainerStatus: demo.masterTrainerStatus,
              reviewedBy: demo.reviewedBy,
              reviewedByName: demo.reviewedByName,
              feedback: demo.feedback
            });
          });
          
          const traineeDemos = trainee.demo_managements_details.map(demo => ({
            ...demo,
            traineeId: trainee.author_id,
            traineeName: trainee.name,
            traineeEmail: trainee.email
          }));
          allDemos = allDemos.concat(traineeDemos);
        }
      });
      
      console.log('Total demos before filtering:', allDemos.length);
      
      // Log demo details for debugging
      allDemos.forEach((demo, index) => {
        console.log(`Demo ${index} details:`, {
          id: demo.id,
          title: demo.title,
          status: demo.status,
          trainerStatus: demo.trainerStatus,
          masterTrainerStatus: demo.masterTrainerStatus
        });
      });
      
      // Filter by status if provided
      if (status) {
        const statusArray = status.split(',');
        allDemos = allDemos.filter(demo => statusArray.includes(demo.status));
        console.log('Demos after status filter:', allDemos.length);
      }
      
      // Filter by specific trainee IDs if provided
      if (traineeIds) {
        const traineeIdArray = traineeIds.split(',');
        allDemos = allDemos.filter(demo => traineeIdArray.includes(demo.traineeId));
        console.log('Demos after trainee filter:', allDemos.length);
      }
      
      console.log('Final demos for trainer:', allDemos.length);
      
      res.json({
        success: true,
        demos: allDemos
      });
      return;
    }
    
    // If user is a master trainer and no specific parameters, fetch all demos from all trainees
    if (requestingUser.role === 'master_trainer') {
      console.log('Master trainer requesting all demos');
      
      // Fetch all trainees with demos
      const trainees = await User.find({ 
        role: 'trainee',
        'demo_managements_details.0': { $exists: true }
      }).select('author_id name email demo_managements_details');
      
      console.log('Found trainees with demos:', trainees.length);
      
      let allDemos = [];
      
      trainees.forEach(trainee => {
        console.log(`Trainee ${trainee.name} has ${trainee.demo_managements_details?.length || 0} demos`);
        if (trainee.demo_managements_details && trainee.demo_managements_details.length > 0) {
          trainee.demo_managements_details.forEach((demo, index) => {
            console.log(`Demo ${index} from DB:`, {
              id: demo.id,
              title: demo.title,
              status: demo.status,
              trainerStatus: demo.trainerStatus,
              masterTrainerStatus: demo.masterTrainerStatus,
              reviewedBy: demo.reviewedBy,
              reviewedByName: demo.reviewedByName,
              feedback: demo.feedback
            });
          });
          
          const traineeDemos = trainee.demo_managements_details.map(demo => ({
            ...demo,
            traineeId: trainee.author_id,
            traineeName: trainee.name,
            traineeEmail: trainee.email
          }));
          allDemos = allDemos.concat(traineeDemos);
        }
      });
      
      console.log('Total demos for master trainer:', allDemos.length);
      
      // Filter by status if provided
      if (status) {
        const statusArray = status.split(',');
        allDemos = allDemos.filter(demo => statusArray.includes(demo.status));
        console.log('Demos after status filter:', allDemos.length);
      }
      
      res.status(200).json({
        success: true,
        demos: allDemos
      });
      return;
    }
    
    // If no specific parameters, return error
    return res.status(400).json({
      success: false,
      message: 'Either traineeId or trainerId is required'
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
    
    // Mock data for now
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
    const { action, rating, feedback, reviewedBy, reviewedAt } = req.body;
    
    console.log('Updating demo review:', { id, action, rating, feedback, reviewedBy });
    
    // Get trainer's name for display
    let trainerName = 'Unknown Trainer';
    if (reviewedBy) {
      try {
        const trainer = await User.findById(reviewedBy).select('name');
        if (trainer) {
          trainerName = trainer.name;
        }
      } catch (error) {
        console.error('Error fetching trainer name:', error);
      }
    }
    
    // Find the demo in the trainee's demo_managements_details array
    const trainee = await User.findOne({ 
      'demo_managements_details.id': id 
    });
    
    if (!trainee) {
      return res.status(404).json({
        success: false,
        message: 'Demo not found'
      });
    }
    
    // Find the specific demo in the array
    const demoIndex = trainee.demo_managements_details.findIndex(demo => demo.id === id);
    
    if (demoIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Demo not found in trainee records'
      });
    }
    
    // Update the demo based on the action
    if (action === 'approve') {
      // Keep status as 'under_review' until master trainer approves
      trainee.demo_managements_details[demoIndex].status = 'under_review';
      trainee.demo_managements_details[demoIndex].rating = rating;
      trainee.demo_managements_details[demoIndex].feedback = feedback;
      trainee.demo_managements_details[demoIndex].reviewedBy = reviewedBy;
      trainee.demo_managements_details[demoIndex].reviewedByName = trainerName;
      trainee.demo_managements_details[demoIndex].reviewedAt = reviewedAt;
      trainee.demo_managements_details[demoIndex].trainerStatus = 'approved';
      trainee.demo_managements_details[demoIndex].masterTrainerStatus = 'pending';
    } else if (action === 'reject') {
      trainee.demo_managements_details[demoIndex].status = 'trainer_rejected';
      trainee.demo_managements_details[demoIndex].rating = 0;
      trainee.demo_managements_details[demoIndex].feedback = '';
      trainee.demo_managements_details[demoIndex].rejectionReason = feedback;
      trainee.demo_managements_details[demoIndex].reviewedBy = reviewedBy;
      trainee.demo_managements_details[demoIndex].reviewedByName = trainerName;
      trainee.demo_managements_details[demoIndex].reviewedAt = reviewedAt;
      trainee.demo_managements_details[demoIndex].trainerStatus = 'rejected';
      trainee.demo_managements_details[demoIndex].masterTrainerStatus = null;
    }
    
    // Mark the field as modified to ensure Mongoose saves it
    trainee.markModified('demo_managements_details');
    
    // Save the updated trainee document
    await trainee.save();
    
    console.log('Demo review updated successfully:', trainee.demo_managements_details[demoIndex]);
    console.log('trainerStatus after save:', trainee.demo_managements_details[demoIndex].trainerStatus);
    console.log('masterTrainerStatus after save:', trainee.demo_managements_details[demoIndex].masterTrainerStatus);
    
    res.status(200).json({
      success: true,
      message: `Demo ${action === 'approve' ? 'approved' : 'rejected'} successfully`,
      demo: trainee.demo_managements_details[demoIndex]
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
    const { traineeId } = req.query;
    
    if (!traineeId) {
      return res.status(400).json({
        success: false,
        message: 'Trainee ID is required'
      });
    }

    // Find user and remove demo from their demo_managements_details array
    const user = await User.findOne({ author_id: traineeId });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Remove demo from the array
    user.demo_managements_details = user.demo_managements_details.filter(demo => demo.id !== id);
    await user.save();
    
    console.log('Demo deleted from user database:', id);

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

// Master trainer final review
const masterReviewDemo = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, rating, feedback, reviewedBy, reviewedAt } = req.body;
    
    console.log('Master trainer reviewing demo:', { id, action, rating, feedback, reviewedBy });
    
    // Find the demo in the trainee's demo_managements_details array
    const trainee = await User.findOne({ 
      'demo_managements_details.id': id 
    });
    
    if (!trainee) {
      return res.status(404).json({
        success: false,
        message: 'Demo not found'
      });
    }
    
    // Find the specific demo in the array
    const demoIndex = trainee.demo_managements_details.findIndex(demo => demo.id === id);
    
    if (demoIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Demo not found in trainee records'
      });
    }
    
    // Update the demo based on the action
    if (action === 'approve') {
      // Final approval - change main status to approved
      trainee.demo_managements_details[demoIndex].status = 'approved';
      trainee.demo_managements_details[demoIndex].masterTrainerReview = feedback;
      trainee.demo_managements_details[demoIndex].masterTrainerReviewedBy = reviewedBy;
      trainee.demo_managements_details[demoIndex].masterTrainerReviewedAt = reviewedAt;
      trainee.demo_managements_details[demoIndex].masterTrainerStatus = 'approved';
    } else if (action === 'reject') {
      // Final rejection
      trainee.demo_managements_details[demoIndex].status = 'master_trainer_rejected';
      trainee.demo_managements_details[demoIndex].masterTrainerReview = feedback;
      trainee.demo_managements_details[demoIndex].masterTrainerReviewedBy = reviewedBy;
      trainee.demo_managements_details[demoIndex].masterTrainerReviewedAt = reviewedAt;
      trainee.demo_managements_details[demoIndex].masterTrainerStatus = 'rejected';
    }
    
    // Mark the field as modified to ensure Mongoose saves it
    trainee.markModified('demo_managements_details');
    
    // Save the updated trainee document
    await trainee.save();
    
    console.log('Master trainer review completed successfully:', trainee.demo_managements_details[demoIndex]);
    console.log('Final status after master trainer review:', trainee.demo_managements_details[demoIndex].status);
    
    res.status(200).json({
      success: true,
      message: `Demo ${action === 'approve' ? 'approved' : 'rejected'} by master trainer successfully`,
      demo: trainee.demo_managements_details[demoIndex]
    });
  } catch (error) {
    console.error('Error in master trainer review:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process master trainer review',
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
  deleteDemo,
  masterReviewDemo
};
