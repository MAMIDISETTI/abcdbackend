const Task = require("../models/Task");
const User = require("../models/User");
const bcrypt = require("bcryptjs");

// @desc    Get all users (Admin only)
// @route   GET /api/users/
// @access  Private (Admin)
const getUsers = async (req, res) => {
  try {
    console.log('=== GET USERS START ===');
    const { role, unassigned, email } = req.query;
    
    console.log("getUsers called with params:", { role, unassigned, email });
    
    // Build query object
    let query = {};
    if (role) {
      query.role = role;
    }
    // If no role specified, return all users (for BOA dashboard)
    
    // Add email filter if provided
    if (email) {
      query.email = email;
    }
    
    // Add unassigned filter for trainees
    if (unassigned === 'true' && role === 'trainee') {
      query.$or = [
        { assignedTrainer: { $exists: false } },
        { assignedTrainer: null }
      ];
      console.log("Unassigned trainees query:", query);
    }

    // Only populate assignedTrainer for trainees when not looking for unassigned ones
    let users;
    try {
      if (unassigned === 'true' && role === 'trainee') {
        // For unassigned trainees, don't populate assignedTrainer
        console.log('Executing unassigned trainees query...');
        users = await User.find(query).select("-password");
        console.log(`Query executed successfully, found ${users.length} users`);
        
        // Debug: Check what we found
        if (users.length > 0) {
          console.log('Debug - Unassigned trainees found:');
          users.slice(0, 3).forEach((user, index) => {
            console.log(`  User ${index + 1}: ${user.name}, assignedTrainer = ${user.assignedTrainer}`);
          });
        }
      } else {
        // For other cases, populate assignedTrainer
        console.log('Executing query with populate...');
        users = await User.find(query)
          .populate('assignedTrainer', 'name email author_id')
          .select("-password");
        console.log(`Query with populate executed successfully, found ${users.length} users`);
      }
    } catch (queryError) {
      console.error('Database query error:', queryError);
      throw queryError;
    }

    console.log(`Found ${users.length} users with role: ${role}`);
    
    // Log trainees with assigned trainers (only when not looking for unassigned)
    if (!(unassigned === 'true' && role === 'trainee')) {
      const traineesWithTrainers = users.filter(user => user.role === 'trainee' && user.assignedTrainer);
      console.log(`Found ${traineesWithTrainers.length} trainees with assigned trainers:`);
      traineesWithTrainers.forEach(trainee => {
        console.log(`- ${trainee.name}: assigned to ${trainee.assignedTrainer?.name || 'Unknown'}`);
      });
      
      // Debug: Check what assignedTrainer looks like
      console.log('Debug - Sample assignedTrainer values:');
      users.slice(0, 3).forEach((user, index) => {
        if (user.role === 'trainee') {
          console.log(`  User ${index + 1}: assignedTrainer = ${user.assignedTrainer}, type = ${typeof user.assignedTrainer}`);
        }
      });
    }

    // Convert to plain objects for consistency
    const usersWithPopulatedTrainers = users.map(user => user.toObject());

    // Add task counts to each user (only for members)
    let usersWithTaskCounts;
    if (role === 'member') {
      usersWithTaskCounts = await Promise.all(
        usersWithPopulatedTrainers.map(async (user) => {
          const pendingTasks = await Task.countDocuments({
            assignedTo: user._id,
            status: "Pending",
          });
          const inProgressTasks = await Task.countDocuments({
            assignedTo: user._id,
            status: "In Progress",
          });
          const completedTasks = await Task.countDocuments({
            assignedTo: user._id,
            status: "Completed",
          });

          return {
            ...user._doc, // Include all existing user data
            pendingTasks,
            inProgressTasks,
            completedTasks,
          };
        })
      );
    } else {
      // For trainers, trainees, and BOA dashboard, return users as-is
      usersWithTaskCounts = usersWithPopulatedTrainers;
    }

    console.log(`=== GET USERS SUCCESS ===`);
    console.log(`Returning ${usersWithTaskCounts.length} users`);
    res.json({ users: usersWithTaskCounts });
  } catch (error) {
    console.error('=== GET USERS ERROR ===');
    console.error('Error details:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
// @desc    Get user by ID
// @route   GET /api/users/:id
// @access  Private
const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Create a new user
// @route   POST /api/users
// @access  Private (Admin/BOA)
const createUser = async (req, res) => {
  try {
    const { 
      name, email, password, role, phone, department, employeeId, genre, joiningDate, qualification,
      // Fields from joiners table
      date_of_joining, candidate_name, phone_number, candidate_personal_mail_id,
      top_department_name_as_per_darwinbox, department_name_as_per_darwinbox,
      joining_status, role_type, role_assign, status, accountCreated, accountCreatedAt,
      createdBy, onboardingChecklist, company_allocated_details, dayPlanTasks,
      fortnightExams, dailyQuizzes, courseLevelExams,
      // Password management
      tempPassword, passwordChanged
    } = req.body;

    // console.log('createUser called with data:', { 
    //   name, email, role, phone, department, employeeId, genre, joiningDate, qualification,
    //   date_of_joining, candidate_name, phone_number, candidate_personal_mail_id,
    //   top_department_name_as_per_darwinbox, department_name_as_per_darwinbox,
    //   joining_status, role_type, role_assign, status, accountCreated, accountCreatedAt,
    //   createdBy, onboardingChecklist, company_allocated_details, dayPlanTasks,
    //   fortnightExams, dailyQuizzes, courseLevelExams
    // });

    // Check if user already exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: "User already exists" });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create new user with all fields
    const userData = {
      name,
      email,
      password: hashedPassword,
      role: role || 'trainee',
      phone: phone || null,
      department: department || null,
      genre: genre || null,
      joiningDate: joiningDate ? new Date(joiningDate) : new Date(),
      isActive: true,
      lastClockIn: null,
      lastClockOut: null,
      
      // Fields from joiners table
      date_of_joining: date_of_joining ? new Date(date_of_joining) : null,
      candidate_name: candidate_name || null,
      phone_number: phone_number || null,
      candidate_personal_mail_id: candidate_personal_mail_id || null,
      top_department_name_as_per_darwinbox: top_department_name_as_per_darwinbox || null,
      department_name_as_per_darwinbox: department_name_as_per_darwinbox || null,
      joining_status: joining_status || null,
      role_type: role_type || null,
      role_assign: role_assign || null,
      qualification: qualification || null,
      status: status || 'active',
      accountCreated: accountCreated !== undefined ? accountCreated : false,
      accountCreatedAt: accountCreatedAt ? new Date(accountCreatedAt) : new Date(),
      createdBy: createdBy || null,
      
      // Password management
      tempPassword: tempPassword || null,
      passwordChanged: passwordChanged || false,
      
      // Array fields
      onboardingChecklist: onboardingChecklist || [{
        welcomeEmailSent: false,
        credentialsGenerated: false,
        accountActivated: false,
        trainingAssigned: false,
        documentsSubmitted: false
      }],
      company_allocated_details: company_allocated_details || [],
      dayPlanTasks: dayPlanTasks || [],
      fortnightExams: fortnightExams || [],
      dailyQuizzes: dailyQuizzes || [],
      courseLevelExams: courseLevelExams || []
    };

    // Only add employeeId if it's not null or undefined
    if (employeeId && employeeId !== null && employeeId !== 'null') {
      userData.employeeId = employeeId;
    }

    // console.log('Creating user with accountCreated:', userData.accountCreated, 'tempPassword:', userData.tempPassword);
    const user = await User.create(userData);
    // console.log('Created user accountCreated:', user.accountCreated, 'tempPassword:', user.tempPassword);

    // Return user data without password
    res.status(201).json({
      message: "User created successfully",
      user: {
        _id: user._id,
        author_id: user.author_id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        department: user.department,
        employeeId: user.employeeId,
        genre: user.genre,
        joiningDate: user.joiningDate,
        isActive: user.isActive,
        createdAt: user.createdAt,
        
        // Fields from joiners table
        date_of_joining: user.date_of_joining,
        candidate_name: user.candidate_name,
        phone_number: user.phone_number,
        candidate_personal_mail_id: user.candidate_personal_mail_id,
        top_department_name_as_per_darwinbox: user.top_department_name_as_per_darwinbox,
        department_name_as_per_darwinbox: user.department_name_as_per_darwinbox,
        joining_status: user.joining_status,
        role_type: user.role_type,
        role_assign: user.role_assign,
        qualification: user.qualification,
        status: user.status,
        accountCreated: user.accountCreated,
        accountCreatedAt: user.accountCreatedAt,
        createdBy: user.createdBy,
        
        // Array fields
        onboardingChecklist: user.onboardingChecklist,
        company_allocated_details: user.company_allocated_details,
        dayPlanTasks: user.dayPlanTasks,
        fortnightExams: user.fortnightExams,
        dailyQuizzes: user.dailyQuizzes,
        courseLevelExams: user.courseLevelExams
      }
    });
  } catch (error) {
    console.error('Error creating user:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: error.code
    });
    
    // Log the specific validation errors if it's a Mongoose validation error
    if (error.name === 'ValidationError') {
      console.error('Validation errors:', error.errors);
    }
    
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

module.exports = { getUsers, getUserById, createUser };
