const express = require('express');
const router = express.Router();
const { protect, requireRoles } = require('../middlewares/authMiddleware');
const {
  createAllocation,
  getAllocations,
  getAllocationById,
  updateAllocation,
  deleteAllocation,
  debugAllocations
} = require('../controllers/allocationController');

// Master Trainer and BOA routes
router.post('/', protect, requireRoles(['master_trainer', 'boa']), createAllocation);
router.get('/debug', protect, requireRoles(['master_trainer', 'boa']), debugAllocations);
router.get('/', protect, requireRoles(['master_trainer', 'boa', 'trainer', 'trainee']), getAllocations);
router.get('/:id', protect, requireRoles(['master_trainer', 'boa', 'trainer', 'trainee']), getAllocationById);
router.put('/:id', protect, requireRoles(['master_trainer', 'boa']), updateAllocation);
router.delete('/:id', protect, requireRoles(['master_trainer', 'boa']), deleteAllocation);

module.exports = router;
