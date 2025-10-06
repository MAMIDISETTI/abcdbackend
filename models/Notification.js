const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  recipientId: {
    type: String,
    required: true,
    index: true
  },
  recipientRole: {
    type: String,
    required: true,
    enum: ['trainer', 'master_trainer', 'trainee', 'boa']
  },
  type: {
    type: String,
    required: true,
    enum: [
      'assignment_created',
      'assignment_started',
      'assignment_completed',
      'assignment_expired',
      'demo_submitted',
      'demo_approved',
      'demo_rejected',
      'result_uploaded',
      'result_available',
      'system_announcement',
      'deadline_reminder',
      'exam_scheduled',
      'exam_starting_soon',
      'exam_completed',
      'feedback_received',
      'status_update'
    ]
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  isRead: {
    type: Boolean,
    default: false
  },
  readAt: {
    type: Date,
    default: null
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  expiresAt: {
    type: Date,
    default: null
  },
  relatedEntityId: {
    type: String,
    default: null
  },
  relatedEntityType: {
    type: String,
    enum: ['assignment', 'demo', 'result', 'exam', 'user', 'system'],
    default: null
  }
}, {
  timestamps: true
});

// Indexes for better performance
NotificationSchema.index({ recipientId: 1, isRead: 1, createdAt: -1 });
NotificationSchema.index({ recipientRole: 1, isRead: 1, createdAt: -1 });
NotificationSchema.index({ type: 1, createdAt: -1 });
NotificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Static method to create notification
NotificationSchema.statics.createNotification = async function(notificationData) {
  try {
    const notification = new this(notificationData);
    await notification.save();
    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
};

// Static method to get unread count
NotificationSchema.statics.getUnreadCount = async function(recipientId) {
  try {
    return await this.countDocuments({ 
      recipientId, 
      isRead: false,
      $or: [
        { expiresAt: null },
        { expiresAt: { $gt: new Date() } }
      ]
    });
  } catch (error) {
    console.error('Error getting unread count:', error);
    return 0;
  }
};

// Static method to mark as read
NotificationSchema.statics.markAsRead = async function(notificationId, recipientId) {
  try {
    return await this.findOneAndUpdate(
      { _id: notificationId, recipientId },
      { isRead: true, readAt: new Date() },
      { new: true }
    );
  } catch (error) {
    console.error('Error marking notification as read:', error);
    throw error;
  }
};

// Static method to mark all as read
NotificationSchema.statics.markAllAsRead = async function(recipientId) {
  try {
    return await this.updateMany(
      { recipientId, isRead: false },
      { isRead: true, readAt: new Date() }
    );
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    throw error;
  }
};

// Static method to get notifications for user
NotificationSchema.statics.getUserNotifications = async function(recipientId, page = 1, limit = 20) {
  try {
    const skip = (page - 1) * limit;
    const notifications = await this.find({
      recipientId,
      $or: [
        { expiresAt: null },
        { expiresAt: { $gt: new Date() } }
      ]
    })
    .sort({ createdAt: -1, priority: -1 }) // Always newest first, never oldest
    .skip(skip)
    .limit(limit);
    
    return notifications;
  } catch (error) {
    console.error('Error getting user notifications:', error);
    return [];
  }
};

module.exports = mongoose.model('Notification', NotificationSchema);