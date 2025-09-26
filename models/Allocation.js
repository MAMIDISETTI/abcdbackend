const mongoose = require('mongoose');

const allocationSchema = new mongoose.Schema({
  traineeId: {
    type: String,
    required: true,
    ref: 'User'
  },
  campusId: {
    type: String,
    required: true,
    ref: 'Campus'
  },
  campusName: {
    type: String,
    required: true
  },
  allocatedDate: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['confirmed', 'pending', 'cancelled'],
    default: 'confirmed'
  },
  deploymentDate: {
    type: Date
  },
  notes: {
    type: String,
    trim: true
  },
  allocatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Index for better query performance
allocationSchema.index({ traineeId: 1 });
allocationSchema.index({ campusId: 1 });
allocationSchema.index({ status: 1 });
allocationSchema.index({ allocatedDate: 1 });

module.exports = mongoose.model('Allocation', allocationSchema);
