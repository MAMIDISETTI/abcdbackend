const MCQDeployment = require('../models/MCQDeployment');
const User = require('../models/User');
const { createExamNotification, createResultNotification } = require('./notificationController');

// Get all MCQ deployments
const getMCQDeployments = async (req, res) => {
  try {
    const deployments = await MCQDeployment.find()
      .populate('createdBy', 'name email author_id')
      .sort({ createdAt: -1 });
    
    res.status(200).json({
      success: true,
      deployments
    });
  } catch (error) {
    console.error('Error fetching MCQ deployments:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch MCQ deployments',
      error: error.message
    });
  }
};

// Get MCQ deployment by ID
const getMCQDeploymentById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const deployment = await MCQDeployment.findById(id)
      .populate('createdBy', 'name email author_id');
    
    if (!deployment) {
      return res.status(404).json({
        success: false,
        message: 'MCQ deployment not found'
      });
    }
    
    res.status(200).json({
      success: true,
      deployment
    });
  } catch (error) {
    console.error('Error fetching MCQ deployment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch MCQ deployment',
      error: error.message
    });
  }
};

// Create new MCQ deployment
const createMCQDeployment = async (req, res) => {
  try {
    const {
      name,
      apiUrl,
      questions,
      scheduledDateTime,
      duration,
      targetTrainees
    } = req.body;
    
    // Validate required fields
    if (!name || !apiUrl || !questions || !scheduledDateTime || !duration || !targetTrainees) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be provided'
      });
    }
    
    // Validate questions format
    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Questions must be a non-empty array'
      });
    }
    
    // Validate each question
    for (let i = 0; i < questions.length; i++) {
      const question = questions[i];
      if (!question.question || !question.options || !Array.isArray(question.options) || question.options.length < 2) {
        return res.status(400).json({
          success: false,
          message: `Question ${i + 1} must have question text and at least 2 options`
        });
      }
    }
    
    // Validate target trainees
    if (!Array.isArray(targetTrainees) || targetTrainees.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one target trainee must be specified'
      });
    }
    
    // Verify trainees exist
    const trainees = await User.find({ 
      author_id: { $in: targetTrainees },
      role: 'trainee',
      isActive: true
    });
    
    if (trainees.length !== targetTrainees.length) {
      return res.status(400).json({
        success: false,
        message: 'One or more target trainees not found'
      });
    }
    
    // Create deployment
    const deployment = new MCQDeployment({
      name,
      apiUrl,
      questions,
      scheduledDateTime: new Date(scheduledDateTime),
      duration,
      targetTrainees,
      createdBy: req.user.id
    });
    
    await deployment.save();
    
    // Populate the created deployment
    await deployment.populate('createdBy', 'name email author_id');
    
    // Send notifications to all target trainees
    try {
      for (const traineeId of targetTrainees) {
        await createExamNotification(traineeId, name, 'exam_scheduled');
      }
    } catch (notificationError) {
      console.error('Error sending exam notifications:', notificationError);
      // Don't fail the deployment if notifications fail
    }
    
    res.status(201).json({
      success: true,
      message: 'MCQ deployment created successfully',
      deployment
    });
  } catch (error) {
    console.error('Error creating MCQ deployment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create MCQ deployment',
      error: error.message
    });
  }
};

// Update MCQ deployment
const updateMCQDeployment = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    // Remove fields that shouldn't be updated directly
    delete updates.createdBy;
    delete updates.results;
    delete updates.statistics;
    
    const deployment = await MCQDeployment.findByIdAndUpdate(
      id,
      updates,
      { new: true, runValidators: true }
    ).populate('createdBy', 'name email author_id');
    
    if (!deployment) {
      return res.status(404).json({
        success: false,
        message: 'MCQ deployment not found'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'MCQ deployment updated successfully',
      deployment
    });
  } catch (error) {
    console.error('Error updating MCQ deployment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update MCQ deployment',
      error: error.message
    });
  }
};

// Delete MCQ deployment
const deleteMCQDeployment = async (req, res) => {
  try {
    const { id } = req.params;
    
    const deployment = await MCQDeployment.findByIdAndDelete(id);
    
    if (!deployment) {
      return res.status(404).json({
        success: false,
        message: 'MCQ deployment not found'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'MCQ deployment deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting MCQ deployment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete MCQ deployment',
      error: error.message
    });
  }
};

// Get deployments for a specific trainee
const getTraineeDeployments = async (req, res) => {
  try {
    const traineeId = req.user.author_id;
    
    const deployments = await MCQDeployment.find({
      targetTrainees: traineeId,
      status: { $in: ['scheduled', 'active', 'expired'] }
    }).populate('createdBy', 'name email author_id');

    // Update status for each deployment
    for (let deployment of deployments) {
      try {
        await deployment.updateStatus();
      } catch (updateError) {
        console.error('Error updating deployment status:', updateError);
        // Continue with other deployments even if one fails
      }
    }
    
    res.status(200).json({
      success: true,
      deployments
    });
  } catch (error) {
    console.error('Error fetching trainee deployments:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch trainee deployments',
      error: error.message
    });
  }
};

// Start MCQ assignment for trainee
const startMCQAssignment = async (req, res) => {
  try {
    const { deploymentId } = req.params;
    const traineeId = req.user.author_id;
    
    const deployment = await MCQDeployment.findById(deploymentId);
    
    if (!deployment) {
      return res.status(404).json({
        success: false,
        message: 'MCQ deployment not found'
      });
    }
    
    // Check if trainee is authorized
    if (!deployment.targetTrainees.includes(traineeId)) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to take this assignment'
      });
    }
    
    // Check if deployment is active
    await deployment.updateStatus();
    
    if (deployment.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'This assignment is not currently active'
      });
    }
    
    // Check if already started/completed
    const existingResult = deployment.results.find(r => r.traineeId === traineeId);
    
    if (existingResult && existingResult.status === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'You have already completed this assignment'
      });
    }
    
    // If not started, mark as in progress
    if (!existingResult) {
      deployment.results.push({
        traineeId,
        traineeName: req.user.name,
        answers: [],
        totalScore: 0,
        maxScore: deployment.questions.length,
        percentage: 0,
        timeSpent: 0,
        startedAt: new Date(),
        status: 'in_progress'
      });
      await deployment.save();
    }
    
    res.status(200).json({
      success: true,
      deployment: {
        id: deployment._id,
        name: deployment.name,
        questions: deployment.questions,
        duration: deployment.duration,
        startedAt: existingResult?.startedAt || new Date()
      }
    });
  } catch (error) {
    console.error('Error starting MCQ assignment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to start MCQ assignment',
      error: error.message
    });
  }
};

// Submit MCQ assignment answers
const submitMCQAnswers = async (req, res) => {
  try {
    const { deploymentId } = req.params;
    const { answers, timeSpent } = req.body;
    const traineeId = req.user.author_id;
    
    const deployment = await MCQDeployment.findById(deploymentId);
    
    if (!deployment) {
      return res.status(404).json({
        success: false,
        message: 'MCQ deployment not found'
      });
    }
    
    // Check if trainee is authorized
    if (!deployment.targetTrainees.includes(traineeId)) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to submit this assignment'
      });
    }
    
    // Find existing result
    const resultIndex = deployment.results.findIndex(r => r.traineeId === traineeId);
    
    if (resultIndex === -1) {
      return res.status(400).json({
        success: false,
        message: 'Assignment not started'
      });
    }
    
    // Process answers and calculate score
    const processedAnswers = answers.map(answer => {
      const question = deployment.questions[answer.questionIndex];
      const isCorrect = answer.selectedAnswer === question.correctAnswer;
      
      return {
        questionIndex: answer.questionIndex,
        selectedAnswer: answer.selectedAnswer,
        isCorrect,
        timeSpent: answer.timeSpent || 0
      };
    });
    
    // Add result to deployment
    await deployment.addTraineeResult(traineeId, req.user.name, processedAnswers, timeSpent);
    
    // Send completion notification to trainee
    try {
      await createExamNotification(traineeId, deployment.name, 'exam_completed');
    } catch (notificationError) {
      console.error('Error sending completion notification:', notificationError);
    }
    
    res.status(200).json({
      success: true,
      message: 'Answers submitted successfully',
      result: deployment.results[resultIndex]
    });
  } catch (error) {
    console.error('Error submitting MCQ answers:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit answers',
      error: error.message
    });
  }
};

// Get deployment results/statistics
const getDeploymentResults = async (req, res) => {
  try {
    const { id } = req.params;
    
    const deployment = await MCQDeployment.findById(id)
      .populate('createdBy', 'name email author_id');
    
    if (!deployment) {
      return res.status(404).json({
        success: false,
        message: 'MCQ deployment not found'
      });
    }
    
    res.status(200).json({
      success: true,
      deployment: {
        id: deployment._id,
        name: deployment.name,
        status: deployment.status,
        statistics: deployment.statistics,
        results: deployment.results
      }
    });
  } catch (error) {
    console.error('Error fetching deployment results:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch deployment results',
      error: error.message
    });
  }
};

// Get trainee's completed exam results
const getTraineeResults = async (req, res) => {
  try {
    const traineeId = req.user.author_id;
    
    // Find all deployments where this trainee has completed results that have been uploaded by BOA
    const deployments = await MCQDeployment.find({
      'results.traineeId': traineeId,
      'results.status': 'completed'
    }).select('name questions results scheduledDateTime duration');

    // Filter to only include results that have been uploaded
    const uploadedDeployments = deployments.filter(deployment => {
      const traineeResult = deployment.results.find(r => r.traineeId === traineeId);
      return traineeResult && traineeResult.uploadedToTrainee === true;
    });

    // Process results to include exam details
    const results = [];
    uploadedDeployments.forEach(deployment => {
      const traineeResult = deployment.results.find(r => r.traineeId === traineeId && r.uploadedToTrainee === true);
      if (traineeResult) {
        results.push({
          _id: traineeResult._id,
          examName: deployment.name,
          examId: deployment._id,
          questions: deployment.questions,
          totalScore: traineeResult.totalScore,
          maxScore: traineeResult.maxScore,
          percentage: traineeResult.percentage,
          timeSpent: traineeResult.timeSpent,
          completedAt: traineeResult.completedAt,
          startedAt: traineeResult.startedAt,
          answers: traineeResult.answers,
          status: traineeResult.status,
          uploadedAt: traineeResult.uploadedAt
        });
      }
    });
    
    // Sort by completion date (newest first)
    results.sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));
    
    res.status(200).json({
      success: true,
      results
    });
  } catch (error) {
    console.error('Error fetching trainee results:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch trainee results',
      error: error.message
    });
  }
};

// Upload results to trainee accounts (BOA only)
const uploadResults = async (req, res) => {
  try {
    const { examId, results } = req.body;

    if (!examId || !results || !Array.isArray(results)) {
      return res.status(400).json({
        success: false,
        message: 'Exam ID and results array are required'
      });
    }

    // Find the exam
    const exam = await MCQDeployment.findById(examId);
    if (!exam) {
      return res.status(404).json({
        success: false,
        message: 'Exam not found'
      });
    }

    // Process each result
    let uploadedCount = 0;
    const errors = [];

    for (const result of results) {
      try {
        // Find the trainee result in the exam
        const traineeResult = exam.results.find(r => r.traineeId === result.traineeId);
        
        if (traineeResult && traineeResult.status === 'completed') {
          // Mark as uploaded to trainee account
          traineeResult.uploadedToTrainee = true;
          traineeResult.uploadedAt = new Date();
          uploadedCount++;
        } else {
          errors.push(`Trainee ${result.traineeName || result.traineeId} has no completed result`);
        }
      } catch (error) {
        errors.push(`Error processing result for trainee ${result.traineeName || result.traineeId}: ${error.message}`);
      }
    }

    // Save the exam with updated results
    await exam.save();
    
    // Send result notifications to all trainees whose results were uploaded
    try {
      for (const result of results) {
        if (result.uploadedToTrainee) {
          const percentage = Math.round((result.totalScore / result.maxScore) * 100);
          await createResultNotification(
            result.traineeId, 
            exam.name, 
            `${result.totalScore}/${result.maxScore}`, 
            percentage
          );
        }
      }
    } catch (notificationError) {
      console.error('Error sending result notifications:', notificationError);
    }

    res.status(200).json({
      success: true,
      message: `Successfully uploaded results for ${uploadedCount} trainees`,
      uploadedCount,
      totalResults: results.length,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('Error uploading results:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload results',
      error: error.message
    });
  }
};

module.exports = {
  getMCQDeployments,
  getMCQDeploymentById,
  createMCQDeployment,
  updateMCQDeployment,
  deleteMCQDeployment,
  getTraineeDeployments,
  startMCQAssignment,
  submitMCQAnswers,
  getDeploymentResults,
  getTraineeResults,
  uploadResults
};
