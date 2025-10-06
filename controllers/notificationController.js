const Notification = require('../models/Notification');
const MCQDeployment = require('../models/MCQDeployment');
const User = require('../models/User');

// Get notifications for current user
const getNotifications = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const userId = req.user.author_id;
    
    const notifications = await Notification.getUserNotifications(userId, parseInt(page), parseInt(limit));
    const unreadCount = await Notification.getUnreadCount(userId);
    
    res.json({
      success: true,
      notifications,
      unreadCount,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: notifications.length
      }
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notifications'
    });
  }
};

// Get unread count only
const getUnreadCount = async (req, res) => {
  try {
    const userId = req.user.author_id;
    const unreadCount = await Notification.getUnreadCount(userId);
    
    res.json({
      success: true,
      unreadCount
    });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch unread count'
    });
  }
};

// Mark notification as read
const markAsRead = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user.author_id;
    
    const notification = await Notification.markAsRead(notificationId, userId);
    
    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }
    
    res.json({
      success: true,
      notification
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark notification as read'
    });
  }
};

// Mark all notifications as read
const markAllAsRead = async (req, res) => {
  try {
    const userId = req.user.author_id;
    
    await Notification.markAllAsRead(userId);
    
    res.json({
      success: true,
      message: 'All notifications marked as read'
    });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark all notifications as read'
    });
  }
};

// Delete notification
const deleteNotification = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user.author_id;
    
    const notification = await Notification.findOneAndDelete({
      _id: notificationId,
      recipientId: userId
    });
    
    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Notification deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete notification'
    });
  }
};

// Create notification (internal use)
const createNotification = async (notificationData) => {
  try {
    const notification = await Notification.createNotification(notificationData);
    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
};

// Notification helper functions
const createAssignmentNotification = async (traineeId, assignmentName, type) => {
  const messages = {
    assignment_created: `New assignment "${assignmentName}" has been created for you`,
    assignment_started: `Assignment "${assignmentName}" has been started`,
    assignment_completed: `Assignment "${assignmentName}" has been completed`,
    assignment_expired: `Assignment "${assignmentName}" has expired`
  };
  
  return await createNotification({
    recipientId: traineeId,
    recipientRole: 'trainee',
    type,
    title: 'Assignment Update',
    message: messages[type],
    priority: type === 'assignment_expired' ? 'high' : 'medium',
    relatedEntityType: 'assignment',
    data: { assignmentName }
  });
};

const createDemoNotification = async (trainerId, traineeName, demoType, type) => {
  const messages = {
    demo_submitted: `Demo submitted by ${traineeName} is pending your review`,
    demo_approved: `Your demo has been approved by the master trainer`,
    demo_rejected: `Your demo has been rejected by the master trainer`
  };
  
  const recipientRole = type === 'demo_submitted' ? 'trainer' : 'trainee';
  
  return await createNotification({
    recipientId: trainerId,
    recipientRole,
    type,
    title: 'Demo Update',
    message: messages[type],
    priority: 'medium',
    relatedEntityType: 'demo',
    data: { traineeName, demoType }
  });
};

const createExamNotification = async (traineeId, examName, type) => {
  const messages = {
    exam_scheduled: `New exam "${examName}" has been scheduled for you`,
    exam_starting_soon: `Exam "${examName}" will start soon`,
    exam_completed: `Exam "${examName}" has been completed`,
    result_available: `Results for "${examName}" are now available`
  };
  
  return await createNotification({
    recipientId: traineeId,
    recipientRole: 'trainee',
    type,
    title: 'Exam Update',
    message: messages[type],
    priority: type === 'exam_starting_soon' ? 'high' : 'medium',
    relatedEntityType: 'exam',
    data: { examName }
  });
};

const createResultNotification = async (traineeId, examName, score, percentage) => {
  return await createNotification({
    recipientId: traineeId,
    recipientRole: 'trainee',
    type: 'result_available',
    title: 'Exam Results Available',
    message: `Your results for "${examName}" are ready. Score: ${score} (${percentage}%)`,
    priority: 'medium',
    relatedEntityType: 'result',
    data: { examName, score, percentage }
  });
};

const createSystemNotification = async (recipientId, recipientRole, title, message, priority = 'medium') => {
  return await createNotification({
    recipientId,
    recipientRole,
    type: 'system_announcement',
    title,
    message,
    priority,
    relatedEntityType: 'system'
  });
};

module.exports = {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  createNotification,
  createAssignmentNotification,
  createDemoNotification,
  createExamNotification,
  createResultNotification,
  createSystemNotification
};