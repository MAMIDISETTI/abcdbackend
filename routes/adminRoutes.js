const express = require('express');
const { protect, adminOnly } = require('../middlewares/authMiddleware');
const {
  createAdmin,
  promoteUser,
  deactivateUser,
  reactivateUser,
  getAllUsers,
  getUserRoleHistory,
  getSystemStats,
  createTraineeAccount,
  getPendingUsers,
  fixJoinerStatuses,
  checkStatus,
  getDeactivatedUsers,
  getDeactivatedUserDetails,
  reinstateUser
} = require('../controllers/adminController');

const router = express.Router();

// Create admin account (public route with invite token)
router.post('/create', createAdmin);

// All other routes require authentication and admin role
router.use(protect);
router.use(adminOnly);

// User management
router.get('/users', getAllUsers);
router.get('/pending-users', getPendingUsers);
router.get('/users/:userId/role-history', getUserRoleHistory);
router.put('/users/promote', promoteUser);
router.put('/users/deactivate', deactivateUser);
router.put('/users/reactivate', reactivateUser);
router.post('/users/create-trainee', createTraineeAccount);

// System statistics
router.get('/stats', getSystemStats);

// Fix joiner statuses
router.post('/fix-joiner-statuses', fixJoinerStatuses);

// Check current status
router.get('/check-status', checkStatus);

// Deactivated users management
router.get('/deactivated-users', getDeactivatedUsers);
router.get('/deactivated-users/:id', getDeactivatedUserDetails);
router.put('/deactivated-users/:id/reinstate', reinstateUser);

module.exports = router;
