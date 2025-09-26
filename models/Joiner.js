const mongoose = require('mongoose');

const joinerSchema = new mongoose.Schema({
  // Basic Information
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  
  candidate_name: {
    type: String,
    trim: true,
    maxlength: [100, 'Candidate name cannot exceed 100 characters']
  },
  
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please enter a valid email address']
  },
  
  candidate_personal_mail_id: {
    type: String,
    lowercase: true,
    trim: true,
    match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please enter a valid email address']
  },
  
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    trim: true,
    match: [/^[\+]?[0-9][\d]{0,15}$/, 'Please enter a valid phone number']
  },
  
  phone_number: {
    type: String,
    trim: true,
    match: [/^[\+]?[0-9][\d]{0,15}$/, 'Please enter a valid phone number']
  },
  
  // Department and Role Information
  department: {
    type: String,
    required: [true, 'Department is required'],
    enum: ['IT', 'HR', 'Finance', 'SDM', 'SDI', 'OTHERS'],
    default: 'OTHERS'
  },
  
  top_department_name_as_per_darwinbox: {
    type: String,
    trim: true,
    maxlength: [100, 'Department name cannot exceed 100 characters']
  },
  
  role: {
    type: String,
    required: true,
    enum: ['trainee', 'trainer', 'master_trainer', 'boa'],
    default: 'trainee'
  },
  
  role_assign: {
    type: String,
    enum: ['SDM', 'SDI', 'SDF', 'OTHER'],
    default: 'OTHER'
  },
  
  qualification: {
    type: String,
    trim: true,
    maxlength: [200, 'Qualification cannot exceed 200 characters'],
    default: null
  },
  
  // Optional Information
  employeeId: {
    type: String,
    trim: true,
    maxlength: [50, 'Employee ID cannot exceed 50 characters']
  },
  
  genre: {
    type: String,
    enum: ['Male', 'Female', 'Other'],
    default: null
  },
  
  // Joining Information
  joiningDate: {
    type: Date,
    required: [true, 'Joining date is required'],
    default: Date.now
  },
  
  date_of_joining: {
    type: Date,
    default: null
  },
  
  joining_status: {
    type: String,
    enum: ['pending', 'confirmed', 'cancelled', 'postponed'],
    default: 'pending'
  },
  
  author_id: {
    type: String,
    required: true,
    unique: true
  },
  
  // Status and Workflow
  status: {
    type: String,
    enum: ['pending', 'active', 'inactive', 'completed'],
    default: 'pending'
  },
  
  // Account Creation
  accountCreated: {
    type: Boolean,
    default: false
  },
  
  accountCreatedAt: {
    type: Date,
    default: null
  },
  
  // User Account Reference (if account is created)
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  
  // Administrative Information
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Additional Notes
  notes: {
    type: String,
    maxlength: [500, 'Notes cannot exceed 500 characters'],
    default: ''
  },
  
  // Onboarding Checklist
  onboardingChecklist: {
    welcomeEmailSent: { type: Boolean, default: false },
    credentialsGenerated: { type: Boolean, default: false },
    accountActivated: { type: Boolean, default: false },
    trainingAssigned: { type: Boolean, default: false },
    documentsSubmitted: { type: Boolean, default: false }
  },
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for better query performance
joinerSchema.index({ email: 1 });
joinerSchema.index({ joiningDate: 1 });
joinerSchema.index({ department: 1 });
joinerSchema.index({ status: 1 });
joinerSchema.index({ createdBy: 1 });

// Pre-save middleware to update updatedAt
joinerSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Virtual for full name display
joinerSchema.virtual('displayName').get(function() {
  return this.name;
});

// Virtual for joining date formatted
joinerSchema.virtual('formattedJoiningDate').get(function() {
  return this.joiningDate.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
});

// Method to check if joiner is active
joinerSchema.methods.isActive = function() {
  return this.status === 'active';
};

// Method to check if account is created
joinerSchema.methods.hasAccount = function() {
  return this.accountCreated && this.userId;
};

// Static method to get joiners by date range
joinerSchema.statics.getByDateRange = function(startDate, endDate) {
  return this.find({
    joiningDate: {
      $gte: startDate,
      $lte: endDate
    }
  }).sort({ joiningDate: -1 });
};

// Static method to get joiners by department
joinerSchema.statics.getByDepartment = function(department) {
  return this.find({ department }).sort({ joiningDate: -1 });
};

// Static method to get pending joiners
joinerSchema.statics.getPending = function() {
  return this.find({ status: 'pending' }).sort({ joiningDate: -1 });
};

module.exports = mongoose.model('Joiner', joinerSchema);
