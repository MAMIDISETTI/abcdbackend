const express = require('express');
const router = express.Router();
const { protect, trainerOnly } = require('../middlewares/authMiddleware');
const { getAssignedTrainees, getTraineeResults } = require('../controllers/trainerController');

// @route   GET /api/trainer/assigned-trainees
// @desc    Get trainees assigned to the trainer
// @access  Private (Trainer)
router.get('/assigned-trainees', protect, trainerOnly, getAssignedTrainees);

// @route   GET /api/trainer/trainee-results
// @desc    Get results of trainees assigned to the trainer
// @access  Private (Trainer)
router.get('/trainee-results', protect, trainerOnly, getTraineeResults);

module.exports = router;
