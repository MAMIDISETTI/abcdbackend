const mongoose = require("mongoose");

const NotificationSchema = new mongoose.Schema(
  {
    recipient: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User", 
      required: true 
    },
    sender: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User", 
      required: true 
    },
    
    // Notification content
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: { 
      type: String, 
      enum: [
        "assignment", 
        "day_plan", 
        "trainee_day_plan",
        "attendance_reminder", 
        "observation_reminder", 
        "clock_in_reminder", 
        "clock_out_reminder",
        "sign_in_notification",
        "general"
      ], 
      required: true 
    },
    
    // Related entities
    relatedEntity: {
      type: { 
        type: String, 
        enum: ["day_plan", "trainee_day_plan", "observation", "attendance", "assignment"] 
      },
      id: { type: mongoose.Schema.Types.ObjectId }
    },
    
    // Status
    isRead: { type: Boolean, default: false },
    readAt: { type: Date, default: null },
    
    // Priority
    priority: { 
      type: String, 
      enum: ["low", "medium", "high", "urgent"], 
      default: "medium" 
    },
    
    // Expiry
    expiresAt: { type: Date, default: null },
    
    // Action required
    requiresAction: { type: Boolean, default: false },
    actionUrl: { type: String, default: null }
  },
  { timestamps: true }
);

// Index for efficient queries
NotificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });

module.exports = mongoose.model("Notification", NotificationSchema);
