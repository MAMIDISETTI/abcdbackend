const mongoose = require("mongoose");

const AttendanceSchema = new mongoose.Schema(
  {
    user: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User", 
      required: true 
    },
    date: { type: Date, required: true },
    
    // Clock in/out times
    clockIn: { 
      time: { type: Date, required: true },
      location: { type: String, default: null },
      ipAddress: { type: String, default: null }
    },
    clockOut: { 
      time: { type: Date, default: null },
      location: { type: String, default: null },
      ipAddress: { type: String, default: null }
    },
    
    // Duration calculation
    totalHours: { type: Number, default: 0 }, // Total hours worked
    isFullDay: { type: Boolean, default: false }, // 8+ hours
    
    // Status tracking
    status: { 
      type: String, 
      enum: ["present", "absent", "late", "half_day", "overtime"], 
      default: "present" 
    },
    
    // Validation
    isValidated: { type: Boolean, default: false },
    validatedBy: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User" 
    },
    validatedAt: { type: Date, default: null },
    
    // Notes
    notes: { type: String, default: "" },
    reason: { type: String, default: "" } // For absences or late arrivals
  },
  { timestamps: true }
);

// Index for efficient queries
AttendanceSchema.index({ user: 1, date: 1 }, { unique: true });

module.exports = mongoose.model("Attendance", AttendanceSchema);
