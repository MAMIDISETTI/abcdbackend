const mongoose = require("mongoose");

const ObservationSchema = new mongoose.Schema(
  {
    trainer: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User", 
      required: true 
    },
    trainee: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User", 
      required: true 
    },
    date: { type: Date, required: true },
    
    // Observation categories
    culture: {
      communication: { 
        type: String, 
        enum: ["excellent", "good", "average", "needs_improvement"], 
        required: true 
      },
      teamwork: { 
        type: String, 
        enum: ["excellent", "good", "average", "needs_improvement"], 
        required: true 
      },
      discipline: { 
        type: String, 
        enum: ["excellent", "good", "average", "needs_improvement"], 
        required: true 
      },
      attitude: { 
        type: String, 
        enum: ["excellent", "good", "average", "needs_improvement"], 
        required: true 
      },
      notes: { type: String, default: "" }
    },
    
    grooming: {
      dressCode: { 
        type: String, 
        enum: ["excellent", "good", "average", "needs_improvement"], 
        required: true 
      },
      neatness: { 
        type: String, 
        enum: ["excellent", "good", "average", "needs_improvement"], 
        required: true 
      },
      punctuality: { 
        type: String, 
        enum: ["excellent", "good", "average", "needs_improvement"], 
        required: true 
      },
      notes: { type: String, default: "" }
    },
    
    // Overall assessment
    overallRating: { 
      type: String, 
      enum: ["excellent", "good", "average", "needs_improvement"], 
      required: true 
    },
    
    // Detailed feedback
    strengths: [{ type: String }],
    areasForImprovement: [{ type: String }],
    recommendations: { type: String, default: "" },
    
    // Status
    status: { 
      type: String, 
      enum: ["draft", "submitted", "reviewed"], 
      default: "draft" 
    },
    submittedAt: { type: Date, default: null },
    reviewedAt: { type: Date, default: null },
    
    // Review by Master Trainer
    reviewedBy: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User" 
    },
    masterTrainerNotes: { type: String, default: "" }
  },
  { timestamps: true }
);

// Index for efficient queries
ObservationSchema.index({ trainer: 1, trainee: 1, date: 1 });

module.exports = mongoose.model("Observation", ObservationSchema);
