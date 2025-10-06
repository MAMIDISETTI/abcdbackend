const mongoose = require('mongoose');

const MCQDeploymentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  apiUrl: {
    type: String,
    required: true,
    trim: true
  },
  questions: [{
    id: {
      type: String,
      default: null
    },
    question: {
      type: String,
      required: true
    },
    options: [{
      type: mongoose.Schema.Types.Mixed,
      required: true
    }],
    option_type: {
      type: String,
      enum: ['DEFAULT', 'IMAGE', 'SINGLE_SELECT'],
      default: 'DEFAULT'
    },
    correctAnswer: {
      type: String,
      required: true
    },
    explanation: {
      type: String,
      default: ''
    },
    difficulty: {
      type: String,
      enum: ['easy', 'medium', 'hard'],
      default: 'medium'
    },
    points: {
      type: Number,
      default: 1
    }
  }],
  scheduledDateTime: {
    type: Date,
    required: true
  },
  duration: {
    type: Number, // in minutes
    required: true,
    min: 5,
    max: 180
  },
  status: {
    type: String,
    enum: ['scheduled', 'active', 'expired', 'cancelled'],
    default: 'scheduled'
  },
  targetTrainees: [{
    type: String, // author_id of trainees
    required: true
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  results: [{
    traineeId: {
      type: String, // author_id
      required: true
    },
    traineeName: {
      type: String,
      required: true
    },
    answers: [{
      questionIndex: {
        type: Number,
        required: true
      },
      selectedAnswer: {
        type: String,
        required: true
      },
      isCorrect: {
        type: Boolean,
        required: true
      },
      timeSpent: {
        type: Number, // in seconds
        default: 0
      }
    }],
    totalScore: {
      type: Number,
      default: 0
    },
    maxScore: {
      type: Number,
      required: true
    },
    percentage: {
      type: Number,
      default: 0
    },
    timeSpent: {
      type: Number, // total time in seconds
      default: 0
    },
    startedAt: {
      type: Date,
      default: null
    },
    completedAt: {
      type: Date,
      default: null
    },
    status: {
      type: String,
      enum: ['not_started', 'in_progress', 'completed', 'abandoned'],
      default: 'not_started'
    },
    uploadedToTrainee: {
      type: Boolean,
      default: false
    },
    uploadedAt: {
      type: Date,
      default: null
    }
  }],
  statistics: {
    totalAttempts: {
      type: Number,
      default: 0
    },
    completedAttempts: {
      type: Number,
      default: 0
    },
    averageScore: {
      type: Number,
      default: 0
    },
    averageTime: {
      type: Number,
      default: 0
    }
  }
}, {
  timestamps: true
});

// Index for better query performance
MCQDeploymentSchema.index({ scheduledDateTime: 1 });
MCQDeploymentSchema.index({ status: 1 });
MCQDeploymentSchema.index({ createdBy: 1 });
MCQDeploymentSchema.index({ 'targetTrainees': 1 });

// Virtual for checking if deployment is currently active
MCQDeploymentSchema.virtual('isActive').get(function() {
  const now = new Date();
  const startTime = this.scheduledDateTime;
  const endTime = new Date(startTime.getTime() + (this.duration * 60 * 1000));
  
  return this.status === 'active' && now >= startTime && now <= endTime;
});

// Pre-save middleware to handle data transformation
MCQDeploymentSchema.pre('save', function(next) {
  // Transform options if they are strings to objects
  if (this.questions && this.questions.length > 0) {
    this.questions.forEach(question => {
      if (question.options && question.options.length > 0) {
        question.options = question.options.map(option => {
          // If option is a string, convert to object format
          if (typeof option === 'string') {
            return {
              text: option,
              image: null,
              imageUrl: null
            };
          }
          // If option is already an object, ensure it has the required fields
          return {
            text: option.text || option,
            image: option.image_url || option.image || null,
            imageUrl: option.image_url || option.imageUrl || option.image || null
          };
        });
      }
    });
  }
  next();
});

// Post-find middleware to transform data when retrieved
MCQDeploymentSchema.post(['find', 'findOne', 'findOneAndUpdate'], function(docs) {
  if (!docs) return;
  
  const transformDoc = (doc) => {
    if (doc.questions && doc.questions.length > 0) {
      doc.questions.forEach(question => {
        if (question.options && question.options.length > 0) {
          question.options = question.options.map(option => {
            // If option is a string, convert to object format
            if (typeof option === 'string') {
              return {
                text: option,
                image: null,
                imageUrl: null
              };
            }
            // If option is already an object, ensure it has the required fields
            return {
              text: option.text || option,
              image: option.image_url || option.image || null,
              imageUrl: option.image_url || option.imageUrl || option.image || null
            };
          });
        }
      });
    }
  };
  
  if (Array.isArray(docs)) {
    docs.forEach(transformDoc);
  } else {
    transformDoc(docs);
  }
});

// Method to update deployment status based on current time
MCQDeploymentSchema.methods.updateStatus = function() {
  const now = new Date();
  const startTime = this.scheduledDateTime;
  
  // Only change from scheduled to active when scheduled time is reached
  // Once active, it stays active (no automatic expiration)
  if (this.status === 'scheduled' && now >= startTime) {
    this.status = 'active';
  }
  
  return this.save();
};

// Method to add trainee result
MCQDeploymentSchema.methods.addTraineeResult = function(traineeId, traineeName, answers, timeSpent) {
  const maxScore = this.questions.length;
  let totalScore = 0;
  
  // Calculate score
  answers.forEach(answer => {
    if (answer.isCorrect) {
      totalScore += this.questions[answer.questionIndex].points || 1;
    }
  });
  
  const percentage = maxScore > 0 ? (totalScore / maxScore) * 100 : 0;
  
  const result = {
    traineeId,
    traineeName,
    answers,
    totalScore,
    maxScore,
    percentage,
    timeSpent,
    startedAt: new Date(),
    completedAt: new Date(),
    status: 'completed'
  };
  
  // Remove existing result if any
  this.results = this.results.filter(r => r.traineeId !== traineeId);
  
  // Add new result
  this.results.push(result);
  
  // Update statistics
  this.statistics.totalAttempts += 1;
  this.statistics.completedAttempts += 1;
  
  const allScores = this.results.map(r => r.totalScore);
  this.statistics.averageScore = allScores.length > 0 
    ? allScores.reduce((a, b) => a + b, 0) / allScores.length 
    : 0;
    
  const allTimes = this.results.map(r => r.timeSpent);
  this.statistics.averageTime = allTimes.length > 0 
    ? allTimes.reduce((a, b) => a + b, 0) / allTimes.length 
    : 0;
  
  return this.save();
};

module.exports = mongoose.model('MCQDeployment', MCQDeploymentSchema);
