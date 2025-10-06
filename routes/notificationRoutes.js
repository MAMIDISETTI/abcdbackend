const express = require('express');
const router = express.Router();
const {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification
} = require('../controllers/notificationController');
const { protect, trainerOnly, masterTrainerOnly, traineeOnly, boaOnly } = require('../middlewares/authMiddleware');

// Get notifications for current user
router.get('/', protect, getNotifications);

// Get unread count only
router.get('/unread-count', protect, getUnreadCount);

// Mark specific notification as read
router.patch('/:notificationId/read', protect, markAsRead);

// Mark all notifications as read
router.patch('/mark-all-read', protect, markAllAsRead);

// Delete notification
router.delete('/:notificationId', protect, deleteNotification);

module.exports = router;