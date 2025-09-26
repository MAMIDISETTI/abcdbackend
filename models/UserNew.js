const mongoose = require("mongoose");
const crypto = require("crypto");

const UserSchema = new mongoose.Schema(
  {
    author_id: { 
      type: String, 
      required: true, 
      unique: true, 
      default: () => crypto.randomUUID() 
    },
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    profileImageUrl: { type: String, default: null },
    role: { 
      type: String, 
      enum: ["master_trainer", "trainer", "trainee", "boa"], 
      required: true 
    },
    
    // Reference to Joiner record for role-specific data
    joinerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Joiner",
      default: null
    },
    
    // For trainers and trainees - assignment relationships
    assignedTrainer: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User", 
      default: null 
    },
    assignedTrainees: [{ 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User" 
    }],
    
    // User status and activity
    isActive: { type: Boolean, default: true },
    lastClockIn: { type: Date, default: null },
    lastClockOut: { type: Date, default: null },
    
    // Account creation info
    accountCreatedAt: { type: Date, default: Date.now },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

// Virtual to get joiner data
UserSchema.virtual('joinerData', {
  ref: 'Joiner',
  localField: 'joinerId',
  foreignField: '_id',
  justOne: true
});

// Method to get full user data with joiner information
UserSchema.methods.getFullData = async function() {
  await this.populate('joinerData');
  return this;
};

// Method to update role and handle joiner reference
UserSchema.methods.updateRole = async function(newRole, joinerId = null) {
  this.role = newRole;
  if (joinerId) {
    this.joinerId = joinerId;
  }
  return this.save();
};

// Static method to create user with joiner reference
UserSchema.statics.createWithJoiner = async function(userData, joinerId) {
  const user = new this(userData);
  user.joinerId = joinerId;
  return user.save();
};

module.exports = mongoose.model("User", UserSchema);
