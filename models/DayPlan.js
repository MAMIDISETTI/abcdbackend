const mongoose = require("mongoose");

const DayPlanSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    date: { type: Date, required: true },
    startTime: { type: String, required: true }, // Format: "09:00"
    endTime: { type: String, required: true },   // Format: "17:00"
    duration: { type: Number, required: true },  // Duration in hours (should be 8)
    
    // Tasks/Activities for the day
    tasks: [{
      title: { type: String, required: true },
      description: { type: String },
      startTime: { type: String, required: true },
      endTime: { type: String, required: true },
      status: { 
        type: String, 
        enum: ["pending", "in_progress", "completed"], 
        default: "pending" 
      },
      completedAt: { type: Date, default: null }
    }],
    
    // Assignment details
    trainer: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User", 
      required: true 
    },
    assignedTrainees: [{ 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User" 
    }],
    
    // Status tracking
    status: { 
      type: String, 
      enum: ["draft", "published", "completed"], 
      default: "draft" 
    },
    publishedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    
    // Validation
    isValidated: { type: Boolean, default: false },
    validatedBy: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User" 
    },
    validatedAt: { type: Date, default: null },
    
    // Notes and feedback
    notes: { type: String, default: "" },
    feedback: { type: String, default: "" }
  },
  { timestamps: true }
);

module.exports = mongoose.model("DayPlan", DayPlanSchema);
