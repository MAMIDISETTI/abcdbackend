const express = require('express');
const { protect, adminOnly } = require('../middlewares/authMiddleware');
const { getCandidateDashboardData } = require('../controllers/candidateDashboardController');

const router = express.Router();

// @route   POST /api/admin/candidate-dashboard
// @desc    Get candidate dashboard data
// @access  Private (Admin)
router.post('/', protect, adminOnly, getCandidateDashboardData);

module.exports = router;
