const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const axios = require("axios");

// Generate JWT Token
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: "7d" });
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res) => {
  try {
    const { 
      name, email, password, profileImageUrl, adminInviteToken, employeeId, department, phone, genre, joiningDate,
      // Additional fields for trainees
      qualification, date_of_joining, candidate_name, phone_number, candidate_personal_mail_id,
      top_department_name_as_per_darwinbox, department_name_as_per_darwinbox,
      joining_status, role_type, role_assign, status, accountCreated, accountCreatedAt,
      createdBy, onboardingChecklist, company_allocated_details, dayPlanTasks,
      fortnightExams, dailyQuizzes, courseLevelExams
    } = req.body;

    // Check if user already exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: "User already exists" });
    }

    // Determine user role based on invite token
    let role = "trainee"; // Default role
    const cleanedToken = (adminInviteToken || "").toString().trim();
    if (cleanedToken) {
      if (cleanedToken === (process.env.MASTER_TRAINER_INVITE_TOKEN || "").trim()) {
        role = "master_trainer";
      } else if (cleanedToken === (process.env.TRAINER_INVITE_TOKEN || "").trim()) {
        role = "trainer";
      } else if (cleanedToken === (process.env.TRAINEE_INVITE_TOKEN || "").trim()) {
        role = "trainee";
      } else if (cleanedToken === (process.env.BOA_INVITE_TOKEN || "").trim()) {
        role = "boa";
      } else {
        return res.status(400).json({ message: "Invalid invite code" });
      }
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create new user with all fields
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      profileImageUrl,
      role,
      employeeId: role === "trainee" ? employeeId : undefined,
      department: role === "trainee" ? department : undefined,
      phone: role === "trainee" ? phone : undefined,
      genre: role === "trainee" ? genre : undefined,
      joiningDate: role === "trainee" ? (joiningDate ? new Date(joiningDate) : new Date()) : undefined,
      
      // Additional fields for trainees - only add if role is trainee
      ...(role === "trainee" && {
        qualification: qualification || null,
        date_of_joining: date_of_joining ? new Date(date_of_joining) : (joiningDate ? new Date(joiningDate) : new Date()),
        candidate_name: candidate_name || name,
        phone_number: phone_number || phone,
        candidate_personal_mail_id: candidate_personal_mail_id || email,
        top_department_name_as_per_darwinbox: top_department_name_as_per_darwinbox || department,
        department_name_as_per_darwinbox: department_name_as_per_darwinbox || department,
        joining_status: joining_status || 'active',
        role_type: role_type || null,
        role_assign: role_assign || null,
        status: status || 'active',
        accountCreated: accountCreated || true,
        accountCreatedAt: accountCreatedAt ? new Date(accountCreatedAt) : new Date(),
        createdBy: createdBy || null,
        
        // Array fields - initialize with default values for trainees
        onboardingChecklist: onboardingChecklist || [{
          welcomeEmailSent: false,
          credentialsGenerated: false,
          accountActivated: true, // Set to true since they're registering
          trainingAssigned: false,
          documentsSubmitted: false
        }],
        company_allocated_details: company_allocated_details || [],
        dayPlanTasks: dayPlanTasks || [],
        fortnightExams: fortnightExams || [],
        dailyQuizzes: dailyQuizzes || [],
        courseLevelExams: courseLevelExams || []
      })
    });

    // Return user data with JWT
    const responseData = {
      _id: user._id,
      author_id: user.author_id,
      name: user.name,
      email: user.email,
      role: user.role,
      profileImageUrl: user.profileImageUrl,
      employeeId: user.employeeId,
      department: user.department,
      phone: user.phone,
      genre: user.genre,
      joiningDate: user.joiningDate,
      token: generateToken(user._id),
    };

    // Add additional fields for trainees
    if (user.role === "trainee") {
      responseData.qualification = user.qualification;
      responseData.date_of_joining = user.date_of_joining;
      responseData.candidate_name = user.candidate_name;
      responseData.phone_number = user.phone_number;
      responseData.candidate_personal_mail_id = user.candidate_personal_mail_id;
      responseData.top_department_name_as_per_darwinbox = user.top_department_name_as_per_darwinbox;
      responseData.department_name_as_per_darwinbox = user.department_name_as_per_darwinbox;
      responseData.joining_status = user.joining_status;
      responseData.role_type = user.role_type;
      responseData.role_assign = user.role_assign;
      responseData.status = user.status;
      responseData.accountCreated = user.accountCreated;
      responseData.accountCreatedAt = user.accountCreatedAt;
      responseData.createdBy = user.createdBy;
      responseData.onboardingChecklist = user.onboardingChecklist;
      responseData.company_allocated_details = user.company_allocated_details;
      responseData.dayPlanTasks = user.dayPlanTasks;
      responseData.fortnightExams = user.fortnightExams;
      responseData.dailyQuizzes = user.dailyQuizzes;
      responseData.courseLevelExams = user.courseLevelExams;
    }

    res.status(201).json(responseData);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Debug logging
    // console.log('Login attempt:', { email, passwordLength: password ? password.length : 0 });

    const user = await User.findOne({ email });
    // console.log('User found:', user ? { email: user.email, role: user.role, hasPassword: !!user.password } : 'No user found');
    
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // Compare password
    const isMatch = await bcrypt.compare(password, user.password);
    // console.log('Password match:', isMatch);
    
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // Send sign-in notification to Master Trainers if user is trainer or trainee
    if (user.role === 'trainer' || user.role === 'trainee') {
      try {
        await axios.post(`${process.env.BASE_URL || 'http://localhost:8000'}/api/notifications/sign-in`, {
          userId: user._id,
          userRole: user.role,
          userName: user.name
        });
      } catch (notificationError) {
        console.error("Error sending sign-in notification:", notificationError);
        // Don't fail login if notification fails
      }
    }

    // Return user data with JWT
    res.json({
      _id: user._id,
      author_id: user.author_id,
      name: user.name,
      email: user.email,
      role: user.role,
      profileImageUrl: user.profileImageUrl,
      passwordChanged: user.passwordChanged,
      token: generateToken(user._id),
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Get user profile
// @route   GET /api/auth/profile
// @access  Private (Requires JWT)
const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private (Requires JWT)
const updateUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

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

// @desc    Change password for first-time login
// @route   PUT /api/auth/change-password
// @access  Private
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    // Get user from database
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({ success: false, message: "Current password is incorrect" });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedNewPassword = await bcrypt.hash(newPassword, salt);

    // Update password and mark as changed
    await User.findByIdAndUpdate(userId, {
      password: hashedNewPassword,
      passwordChanged: true,
      tempPassword: null // Clear temporary password
    });

    res.json({
      success: true,
      message: "Password changed successfully"
    });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

module.exports = { registerUser, loginUser, getUserProfile, updateUserProfile, changePassword };
