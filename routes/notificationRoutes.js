const express = require("express");
const router = express.Router();
const { protect, requireRoles } = require("../middlewares/authMiddleware");
const {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  createNotification,
  sendBulkNotifications,
  getNotificationStats,
  createSignInNotification
} = require("../controllers/notificationController");

// General notification routes
router.get("/", protect, getNotifications);
router.get("/unread-count", protect, getUnreadCount);
router.get("/stats", protect, getNotificationStats);
router.put("/:id/read", protect, markAsRead);
router.put("/mark-all-read", protect, markAllAsRead);
router.delete("/:id", protect, deleteNotification);

// Create notification routes (Master Trainer, Trainer)
router.post("/create", protect, requireRoles(["master_trainer", "trainer"]), createNotification);
router.post("/bulk", protect, requireRoles(["master_trainer", "trainer"]), sendBulkNotifications);

// Sign-in notification route (Internal use)
router.post("/sign-in", createSignInNotification);

module.exports = router;
