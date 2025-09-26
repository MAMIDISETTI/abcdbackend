const express = require('express');
const router = express.Router();
const { upload, uploadDemo, getDemos, getDemoById, updateDemo, deleteDemo, masterReviewDemo } = require('../controllers/demoControllerSimple');
const { protect } = require('../middlewares/authMiddleware');

// Apply authentication middleware to all routes
router.use(protect);

// Upload demo
router.post('/upload', upload.single('file'), uploadDemo);

// Get all demos
router.get('/', getDemos);

// Get demo by ID
router.get('/:id', getDemoById);

// Update demo (for reviews)
router.put('/:id', updateDemo);

// Review demo (specific endpoint for trainer reviews)
router.put('/:id/review', updateDemo);

// Master trainer final review
router.put('/:id/master-review', masterReviewDemo);

// Delete demo
router.delete('/:id', deleteDemo);

module.exports = router;
