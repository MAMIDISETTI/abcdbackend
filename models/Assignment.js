const mongoose = require("mongoose");

const AssignmentSchema = new mongoose.Schema(
  {
    masterTrainer: { 
      type: String, 
      ref: "User", 
      required: true 
    },
    trainer: { 
      type: String, 
      ref: "User", 
      required: true 
    },
    trainees: [{ 
      type: String, 
      ref: "User" 
    }],
    
    // Assignment details
    assignmentDate: { type: Date, required: true },
    effectiveDate: { type: Date, required: true },
    endDate: { type: Date, default: null },
    
    // Status
    status: { 
      type: String, 
      enum: ["active", "inactive", "completed", "cancelled"], 
      default: "active" 
    },
    
    // Assignment notes
    notes: { type: String, default: "" },
    instructions: { type: String, default: "" },
    
    // Validation
    isAcknowledged: { type: Boolean, default: false },
    acknowledgedAt: { type: Date, default: null },
    
    // Performance tracking
    totalTrainees: { type: Number, required: true },
    activeTrainees: { type: Number, default: 0 },
    
    // Audit trail
    createdBy: { 
      type: String, 
      ref: "User", 
      required: true 
    },
    modifiedBy: { 
      type: String, 
      ref: "User" 
    },
    modifiedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

// Index for efficient queries
AssignmentSchema.index({ masterTrainer: 1, trainer: 1, status: 1 });
AssignmentSchema.index({ trainees: 1, status: 1 });

module.exports = mongoose.model("Assignment", AssignmentSchema);
