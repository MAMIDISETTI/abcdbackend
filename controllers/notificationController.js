const Notification = require("../models/Notification");
const User = require("../models/User");

// @desc    Get user notifications
// @route   GET /api/notifications
// @access  Private
const getNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    const { isRead, type, priority, page = 1, limit = 20 } = req.query;

    let query = { recipient: userId };

    if (isRead !== undefined) {
      query.isRead = isRead === 'true';
    }

    if (type) {
      query.type = type;
    }

    if (priority) {
      query.priority = priority;
    }

    const notifications = await Notification.find(query)
      .populate('sender', 'name email role')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Notification.countDocuments(query);

    res.json({
      notifications,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });

  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Get unread notification count
// @route   GET /api/notifications/unread-count
// @access  Private
const getUnreadCount = async (req, res) => {
  try {
    const userId = req.user.id;

    const count = await Notification.countDocuments({
      recipient: userId,
      isRead: false
    });

    res.json({ unreadCount: count });

  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Mark notification as read
// @route   PUT /api/notifications/:id/read
// @access  Private
const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const notification = await Notification.findOne({
      _id: id,
      recipient: userId
    });

    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }

    notification.isRead = true;
    notification.readAt = new Date();
    await notification.save();

    res.json({
      message: "Notification marked as read",
      notification
    });

  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Mark all notifications as read
// @route   PUT /api/notifications/mark-all-read
// @access  Private
const markAllAsRead = async (req, res) => {
  try {
    const userId = req.user.id;

    await Notification.updateMany(
      { recipient: userId, isRead: false },
      { 
        isRead: true, 
        readAt: new Date() 
      }
    );

    res.json({ message: "All notifications marked as read" });

  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Delete notification
// @route   DELETE /api/notifications/:id
// @access  Private
const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const notification = await Notification.findOneAndDelete({
      _id: id,
      recipient: userId
    });

    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }

    res.json({ message: "Notification deleted successfully" });

  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Create notification (internal use)
// @route   POST /api/notifications/create
// @access  Private (Master Trainer, Trainer)
const createNotification = async (req, res) => {
  try {
    const senderId = req.user.id;
    const {
      recipientId,
      title,
      message,
      type,
      priority = "medium",
      requiresAction = false,
      actionUrl = null,
      relatedEntity = null
    } = req.body;

    // Validate recipient exists
    const recipient = await User.findById(recipientId);
    if (!recipient) {
      return res.status(400).json({ message: "Recipient not found" });
    }

    const notification = await Notification.create({
      recipient: recipientId,
      sender: senderId,
      title,
      message,
      type,
      priority,
      requiresAction,
      actionUrl,
      relatedEntity
    });

    res.status(201).json({
      message: "Notification created successfully",
      notification
    });

  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Send bulk notifications
// @route   POST /api/notifications/bulk
// @access  Private (Master Trainer, Trainer)
const sendBulkNotifications = async (req, res) => {
  try {
    const senderId = req.user.id;
    const {
      recipientIds,
      title,
      message,
      type,
      priority = "medium",
      requiresAction = false,
      actionUrl = null
    } = req.body;

    // Validate recipients exist
    const recipients = await User.find({ _id: { $in: recipientIds } });
    if (recipients.length !== recipientIds.length) {
      return res.status(400).json({ message: "Some recipients not found" });
    }

    const notifications = [];
    for (const recipientId of recipientIds) {
      const notification = await Notification.create({
        recipient: recipientId,
        sender: senderId,
        title,
        message,
        type,
        priority,
        requiresAction,
        actionUrl
      });
      notifications.push(notification);
    }

    res.status(201).json({
      message: `${notifications.length} notifications sent successfully`,
      notifications
    });

  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Get notification statistics
// @route   GET /api/notifications/stats
// @access  Private
const getNotificationStats = async (req, res) => {
  try {
    const userId = req.user.id;
    const { startDate, endDate } = req.query;

    let matchQuery = { recipient: userId };

    if (startDate && endDate) {
      matchQuery.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const stats = await Notification.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          totalNotifications: { $sum: 1 },
          unreadNotifications: {
            $sum: { $cond: [{ $eq: ["$isRead", false] }, 1, 0] }
          },
          readNotifications: {
            $sum: { $cond: [{ $eq: ["$isRead", true] }, 1, 0] }
          },
          urgentNotifications: {
            $sum: { $cond: [{ $eq: ["$priority", "urgent"] }, 1, 0] }
          },
          highPriorityNotifications: {
            $sum: { $cond: [{ $eq: ["$priority", "high"] }, 1, 0] }
          },
          actionRequiredNotifications: {
            $sum: { $cond: [{ $eq: ["$requiresAction", true] }, 1, 0] }
          }
        }
      }
    ]);

    res.json(stats[0] || {
      totalNotifications: 0,
      unreadNotifications: 0,
      readNotifications: 0,
      urgentNotifications: 0,
      highPriorityNotifications: 0,
      actionRequiredNotifications: 0
    });

  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Create sign-in notification for Master Trainer
// @route   POST /api/notifications/sign-in
// @access  Private (Internal)
const createSignInNotification = async (req, res) => {
  try {
    const { userId, userRole, userName } = req.body;

    // Find all Master Trainers
    const masterTrainers = await User.find({ role: 'master_trainer' });

    if (masterTrainers.length === 0) {
      return res.json({ message: "No Master Trainers found" });
    }

    const notifications = [];
    for (const masterTrainer of masterTrainers) {
      const notification = await Notification.create({
        recipient: masterTrainer._id,
        sender: userId,
        title: `${userRole === 'trainer' ? 'Trainer' : 'Trainee'} Signed In`,
        message: `${userName} (${userRole}) has signed in to the system`,
        type: "sign_in_notification",
        priority: "low",
        requiresAction: false
      });
      notifications.push(notification);
    }

    res.status(201).json({
      message: `Sign-in notification sent to ${notifications.length} Master Trainer(s)`,
      notifications
    });

  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

module.exports = {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  createNotification,
  sendBulkNotifications,
  getNotificationStats,
  createSignInNotification
};
