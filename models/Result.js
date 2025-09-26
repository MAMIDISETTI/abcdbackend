const mongoose = require("mongoose");

const ResultSchema = new mongoose.Schema(
  {
    author_id: {
      type: String,
      required: true,
      index: true // For faster queries by author_id
    },
    trainee_name: {
      type: String,
      required: true
    },
    email: {
      type: String,
      required: true
    },
    exam_type: {
      type: String,
      required: true,
      validate: {
        validator: function(v) {
          // Allow specific patterns: fortnight1, fortnight2, daily1, daily2, course1, course2, etc.
          return /^(fortnight|daily|course)\d*$/i.test(v);
        },
        message: 'Exam type must be in format: fortnight1, fortnight2, daily1, daily2, course1, course2, etc.'
      }
    },
    result_name: {
      type: String,
      required: true // e.g., "FortnightResults1", "DailyQuizResults2"
    },
    score: {
      type: Number,
      required: true
    },
    total_marks: {
      type: Number,
      required: true
    },
    percentage: {
      type: Number,
      required: true
    },
    exam_date: {
      type: Date,
      required: true
    },
    uploaded_at: {
      type: Date,
      default: Date.now
    },
    uploaded_by: {
      type: String,
      ref: "User",
      required: true
    },
    status: {
      type: String,
      enum: ['passed', 'failed', 'pending'],
      default: 'pending'
    },
    remarks: {
      type: String,
      default: ''
    },
    // Additional fields that might come from Google Sheets
    department: {
      type: String,
      default: ''
    },
    trainer_name: {
      type: String,
      default: ''
    },
    batch_name: {
      type: String,
      default: ''
    }
  },
  { timestamps: true }
);

// Index for better query performance
ResultSchema.index({ author_id: 1, exam_type: 1 }, { unique: true }); // Ensure unique combination
ResultSchema.index({ exam_type: 1, exam_date: -1 });
ResultSchema.index({ uploaded_at: -1 });

module.exports = mongoose.model("Result", ResultSchema);
