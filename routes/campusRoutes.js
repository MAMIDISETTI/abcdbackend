const express = require('express');
const router = express.Router();
const { protect, requireRoles } = require('../middlewares/authMiddleware');
const {
  createCampus,
  getCampuses,
  getCampusById,
  updateCampus,
  deleteCampus
} = require('../controllers/campusController');

// Master Trainer and BOA routes
router.post('/', protect, requireRoles(['master_trainer', 'boa']), createCampus);
router.get('/', protect, requireRoles(['master_trainer', 'boa', 'trainer']), getCampuses);
router.get('/:id', protect, requireRoles(['master_trainer', 'boa', 'trainer']), getCampusById);
router.put('/:id', protect, requireRoles(['master_trainer', 'boa']), updateCampus);
router.delete('/:id', protect, requireRoles(['master_trainer', 'boa']), deleteCampus);

module.exports = router;
