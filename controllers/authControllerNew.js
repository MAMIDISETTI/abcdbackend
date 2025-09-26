const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/UserNew");
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

    // Create new user with minimal data
    const user = await User.create({
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
    console.error("Registration error:", error);
    res.status(500).json({ message: "Server error during registration" });
  }
};

// Login User
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // Get full user data with joiner information
    const fullUserData = await user.getFullData();

    // Return user data with JWT
    const responseData = {
      _id: user._id,
      author_id: user.author_id,
      name: user.name,
      email: user.email,
      role: user.role,
      profileImageUrl: user.profileImageUrl,
      joinerData: fullUserData.joinerData || null,
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
    const user = await User.findById(req.user._id).populate('joinerData');
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({
      _id: user._id,
      author_id: user.author_id,
      name: user.name,
      email: user.email,
      role: user.role,
      profileImageUrl: user.profileImageUrl,
      joinerData: user.joinerData,
      isActive: user.isActive,
      lastClockIn: user.lastClockIn,
      lastClockOut: user.lastClockOut,
      accountCreatedAt: user.accountCreatedAt,
      createdAt: user.createdAt
    });
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({ message: "Server error getting profile" });
  }
};

// Update User Role (for promotions/demotions)
const updateUserRole = async (req, res) => {
  try {
    const { userId, newRole } = req.body;
    
    const user = await User.findById(userId);
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

module.exports = {
  registerUser,
  loginUser,
  getUserProfile,
  updateUserRole
};
