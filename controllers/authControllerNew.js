const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const UserNew = require("../models/UserNew");
const Joiner = require("../models/Joiner");
const crypto = require("crypto");

// Generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
};

// Register User
const registerUser = async (req, res) => {
  try {
    const {
      name, email, password, profileImageUrl, adminInviteToken
    } = req.body;

    // Validate required fields
    if (!name || !email || !password) {
      return res.status(400).json({ 
        message: "Missing required fields: name, email, and password are required" 
      });
    }

    // Check if user already exists
    const userExists = await UserNew.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: "User already exists" });
    }

    // Determine user role based on invite token
    let role = "trainee"; // Default role
    const cleanedToken = (adminInviteToken || "").toString().trim();
    
    if (cleanedToken) {
      // Check if admin token matches
      if (process.env.ADMIN_INVITE_TOKEN && cleanedToken === process.env.ADMIN_INVITE_TOKEN.trim()) {
        role = "admin";
        } else if (process.env.MASTER_TRAINER_INVITE_TOKEN && cleanedToken === process.env.MASTER_TRAINER_INVITE_TOKEN.trim()) {
        role = "master_trainer";
        } else if (process.env.TRAINER_INVITE_TOKEN && cleanedToken === process.env.TRAINER_INVITE_TOKEN.trim()) {
        role = "trainer";
        } else if (process.env.TRAINEE_INVITE_TOKEN && cleanedToken === process.env.TRAINEE_INVITE_TOKEN.trim()) {
        role = "trainee";
        } else if (process.env.BOA_INVITE_TOKEN && cleanedToken === process.env.BOA_INVITE_TOKEN.trim()) {
        role = "boa";
        } else {
        return res.status(400).json({ 
          message: "Invalid invite code. Please check your invite code and try again." 
        });
      }
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create new user with minimal data
    const user = await UserNew.create({
      name,
      email,
      password: hashedPassword,
      profileImageUrl,
      role,
      accountCreatedAt: new Date(),
      createdBy: req.user ? req.user._id : null
    });

    // For trainees, create a joiner record
    if (role === "trainee") {
      const joiner = await Joiner.create({
        name: name,
        candidate_name: name,
        email: email,
        candidate_personal_mail_id: email,
        phone: null, // Will be updated later
        phone_number: null,
        department: 'OTHERS', // Default department
        top_department_name_as_per_darwinbox: null,
        department_name_as_per_darwinbox: null,
        role: role,
        role_assign: 'OTHER',
        qualification: null,
        employeeId: null,
        genre: null,
        joiningDate: new Date(),
        date_of_joining: new Date(),
        joining_status: 'active',
        author_id: crypto.randomUUID(),
        status: 'active',
        accountCreated: true,
        accountCreatedAt: new Date(),
        createdBy: req.user ? req.user._id : null,
        userId: user._id,
        onboardingChecklist: {
          welcomeEmailSent: false,
          credentialsGenerated: false,
          accountActivated: true,
          trainingAssigned: false,
          documentsSubmitted: false
        }
      });

      // Update user with joiner reference
      user.joinerId = joiner._id;
      await user.save();
    }

    // Return user data with JWT
    const responseData = {
      _id: user._id,
      author_id: user.author_id,
      name: user.name,
      email: user.email,
      role: user.role,
      profileImageUrl: user.profileImageUrl,
      token: generateToken(user._id),
    };

    res.status(201).json(responseData);
  } catch (error) {
    console.error("=== REGISTRATION ERROR ===");
    console.error("Error details:", error);
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);
    res.status(500).json({ 
      message: "Server error during registration",
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Login User
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check if user exists in UserNew model first
    let user = await UserNew.findOne({ email });
    let userModel = 'UserNew';
    
    // If not found in UserNew, check old User model
    if (!user) {
      const User = require('../models/User');
      user = await User.findOne({ email });
      userModel = 'User';
    }
    
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // Check if user account is active
    if (user.isActive === false) {
      return res.status(403).json({ 
        message: "Account is deactivated. Please contact administrator for assistance." 
      });
    }

    // Get full user data with joiner information (only for UserNew)
    let fullUserData = null;
    if (userModel === 'UserNew' && user.getFullData) {
      fullUserData = await user.getFullData();
    }

    // Return user data with JWT
    const responseData = {
      _id: user._id,
      author_id: user.author_id || user._id.toString(), // Fallback for old User model
      name: user.name,
      email: user.email,
      role: user.role,
      profileImageUrl: user.profileImageUrl,
      joinerData: fullUserData?.joinerData || null,
      passwordChanged: user.passwordChanged !== undefined ? user.passwordChanged : false,
      tempPassword: user.tempPassword || null,
      token: generateToken(user._id),
    };

    res.status(200).json(responseData);
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Server error during login" });
  }
};

// Get User Profile
const getUserProfile = async (req, res) => {
  try {
    // Try UserNew model first
    let user = await UserNew.findById(req.user._id);
    
    // If not found, try old User model
    if (!user) {
      const User = require('../models/User');
      user = await User.findById(req.user._id);
    }
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Safe field access with fallbacks
    const responseData = {
      _id: user._id,
      author_id: user.author_id || user._id.toString(),
      name: user.name || 'Unknown',
      email: user.email || '',
      role: user.role || 'trainee',
      profileImageUrl: user.profileImageUrl || null,
      joinerData: user.joinerData || null,
      isActive: user.isActive !== undefined ? user.isActive : true,
      lastClockIn: user.lastClockIn || null,
      lastClockOut: user.lastClockOut || null,
      accountCreatedAt: user.accountCreatedAt || user.createdAt || new Date(),
      createdAt: user.createdAt || new Date(),
      passwordChanged: user.passwordChanged !== undefined ? user.passwordChanged : false,
      tempPassword: user.tempPassword || null
    };

    res.status(200).json(responseData);
  } catch (error) {
    console.error("Get profile error:", error);
    console.error("Error details:", error.message);
    console.error("Error stack:", error.stack);
    res.status(500).json({ 
      message: "Server error getting profile",
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Update User Role (for promotions/demotions)
const updateUserRole = async (req, res) => {
  try {
    const { userId, newRole } = req.body;
    
    const user = await UserNew.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Update role
    user.role = newRole;
    await user.save();

    // If user has joiner data, update it too
    if (user.joinerId) {
      await Joiner.findByIdAndUpdate(user.joinerId, { role: newRole });
    }

    res.status(200).json({ 
      message: "User role updated successfully",
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error("Update role error:", error);
    res.status(500).json({ message: "Server error updating role" });
  }
};

// Update User Profile
const updateUserProfile = async (req, res) => {
  try {
    const user = await UserNew.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.name = req.body.name || user.name;
    user.email = req.body.email || user.email;

    if (req.body.password) {
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(req.body.password, salt);
      user.passwordChanged = true; // Mark that user has changed their password
    }

    const updatedUser = await user.save();

    res.json({
      _id: updatedUser._id,
      name: updatedUser.name,
      email: updatedUser.email,
      role: updatedUser.role,
      token: generateToken(updatedUser._id),
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Change Password
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user._id; // Use _id instead of id

    // Get user from database - try UserNew first, then User
    let user = await UserNew.findById(userId);
    if (!user) {
      const User = require('../models/User');
      user = await User.findById(userId);
      }
    
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found in any model" });
    }

    // Verify current password
    let isCurrentPasswordValid = false;
    
    // For first-time login, check tempPassword
    if (user.tempPassword && !user.passwordChanged) {
      isCurrentPasswordValid = (currentPassword === user.tempPassword);
      } else {
      // For regular password changes, check hashed password
      isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
      }
    
    if (!isCurrentPasswordValid) {
      return res.status(400).json({ success: false, message: "Current password is incorrect" });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedNewPassword = await bcrypt.hash(newPassword, salt);
    // Update password and mark as changed
    let updateResult;
    
    // Try to update in the same model where user was found
    if (user.constructor.modelName === 'UserNew') {
      updateResult = await UserNew.findByIdAndUpdate(userId, {
        password: hashedNewPassword,
        passwordChanged: true,
        tempPassword: null // Clear temporary password
      });
    } else {
      // For old User model, we need to check if it has these fields
      const User = require('../models/User');
      updateResult = await User.findByIdAndUpdate(userId, {
        password: hashedNewPassword,
        passwordChanged: true,
        tempPassword: null // Clear temporary password
      });
    }
    
    res.json({
      success: true,
      message: "Password changed successfully"
    });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

module.exports = {
  registerUser,
  loginUser,
  getUserProfile,
  updateUserProfile,
  changePassword,
  updateUserRole
};
