const express = require('express');
const router = express.Router();
const mcqController = require('../controllers/mcqDeploymentController');
const { protect, adminOnly, traineeOnly, masterTrainerOnly, boaOnly } = require('../middlewares/authMiddleware');

// Admin routes (require admin role)
router.get('/admin', protect, adminOnly, mcqController.getMCQDeployments);
router.get('/admin/:id', protect, adminOnly, mcqController.getMCQDeploymentById);
router.post('/admin', protect, adminOnly, mcqController.createMCQDeployment);
router.put('/admin/:id', protect, adminOnly, mcqController.updateMCQDeployment);
router.delete('/admin/:id', protect, adminOnly, mcqController.deleteMCQDeployment);
router.get('/admin/:id/results', protect, adminOnly, mcqController.getDeploymentResults);

// Master Trainer routes
router.get('/master-trainer', protect, masterTrainerOnly, mcqController.getMCQDeployments);

// BOA routes (read-only access to deployments and results)
router.get('/boa', protect, boaOnly, mcqController.getMCQDeployments);
router.post('/boa/upload-results', protect, boaOnly, mcqController.uploadResults);

// Trainee routes
router.get('/trainee', protect, traineeOnly, mcqController.getTraineeDeployments);
router.get('/trainee/results', protect, traineeOnly, mcqController.getTraineeResults);
router.post('/trainee/:deploymentId/start', protect, traineeOnly, mcqController.startMCQAssignment);
router.post('/trainee/:deploymentId/submit', protect, traineeOnly, mcqController.submitMCQAnswers);

module.exports = router;
