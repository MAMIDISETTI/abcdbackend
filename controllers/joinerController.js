const Joiner = require('../models/Joiner');
const User = require('../models/User');
const bcrypt = require('bcryptjs');

// Create a new joiner
const createJoiner = async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      department,
      role = 'trainee',
      employeeId,
      genre,
      joiningDate,
      qualification,
      notes = ''
    } = req.body;

    // Check if joiner already exists
    const existingJoiner = await Joiner.findOne({ email });
    if (existingJoiner) {
      return res.status(400).json({
        message: 'Joiner with this email already exists'
      });
    }

    // Create joiner record
    const joiner = await Joiner.create({
      name,
      email,
      phone,
      department,
      role,
      employeeId: employeeId || null,
      genre: genre || null,
      joiningDate: joiningDate ? new Date(joiningDate) : new Date(),
      qualification: qualification || null,
      notes,
      createdBy: req.user.id
    });

    res.status(201).json({
      message: 'Joiner added successfully',
      joiner: {
        _id: joiner._id,
        name: joiner.name,
        email: joiner.email,
        phone: joiner.phone,
        department: joiner.department,
        role: joiner.role,
        employeeId: joiner.employeeId,
        genre: joiner.genre,
        joiningDate: joiner.joiningDate,
        qualification: joiner.qualification,
        status: joiner.status,
        accountCreated: joiner.accountCreated,
        createdAt: joiner.createdAt
      }
    });
  } catch (error) {
    console.error('Error creating joiner:', error);
    res.status(500).json({
      message: 'Server error',
      error: error.message
    });
  }
};

// Get all joiners with filtering and pagination
const getJoiners = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      department,
      status,
      role,
      search,
      startDate,
      endDate,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build query
    const query = {};
    
    if (department) {
      query.department = department;
    }
    
    if (status) {
      query.status = status;
    }
    
    if (role) {
      query.role = role;
    }
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { employeeId: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (startDate && endDate) {
      query.joiningDate = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Execute query with pagination
    const joiners = await Joiner.find(query)
      .populate('createdBy', 'name email')
      .populate('userId', 'name email role')
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    // Get total count for pagination
    const total = await Joiner.countDocuments(query);

    res.json({
      joiners,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Error fetching joiners:', error);
    res.status(500).json({
      message: 'Server error',
      error: error.message
    });
  }
};

// Get joiner by ID
const getJoinerById = async (req, res) => {
  try {
    const joiner = await Joiner.findById(req.params.id)
      .populate('createdBy', 'name email')
      .populate('userId', 'name email role');

    if (!joiner) {
      return res.status(404).json({
        message: 'Joiner not found'
      });
    }

    res.json(joiner);
  } catch (error) {
    console.error('Error fetching joiner:', error);
    res.status(500).json({
      message: 'Server error',
      error: error.message
    });
  }
};

// Update joiner
const updateJoiner = async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      department,
      role,
      employeeId,
      genre,
      joiningDate,
      qualification,
      status,
      notes
    } = req.body;

    const joiner = await Joiner.findById(req.params.id);
    if (!joiner) {
      return res.status(404).json({
        message: 'Joiner not found'
      });
    }

    // Check if email is being changed and if it already exists
    if (email && email !== joiner.email) {
      const existingJoiner = await Joiner.findOne({ email, _id: { $ne: req.params.id } });
      if (existingJoiner) {
        return res.status(400).json({
          message: 'Email already exists'
        });
      }
    }

    // Update joiner
    const updatedJoiner = await Joiner.findByIdAndUpdate(
      req.params.id,
      {
        name: name || joiner.name,
        email: email || joiner.email,
        phone: phone || joiner.phone,
        department: department || joiner.department,
        role: role || joiner.role,
        employeeId: employeeId !== undefined ? employeeId : joiner.employeeId,
        genre: genre !== undefined ? genre : joiner.genre,
        joiningDate: joiningDate ? new Date(joiningDate) : joiner.joiningDate,
        qualification: qualification !== undefined ? qualification : joiner.qualification,
        status: status || joiner.status,
        notes: notes !== undefined ? notes : joiner.notes
      },
      { new: true, runValidators: true }
    ).populate('createdBy', 'name email')
     .populate('userId', 'name email role');

    res.json({
      message: 'Joiner updated successfully',
      joiner: updatedJoiner
    });
  } catch (error) {
    console.error('Error updating joiner:', error);
    res.status(500).json({
      message: 'Server error',
      error: error.message
    });
  }
};

// Delete joiner
const deleteJoiner = async (req, res) => {
  try {
    const joiner = await Joiner.findById(req.params.id);
    if (!joiner) {
      return res.status(404).json({
        message: 'Joiner not found'
      });
    }

    // If account is created, also delete the user account
    if (joiner.accountCreated && joiner.userId) {
      await User.findByIdAndDelete(joiner.userId);
    }

    await Joiner.findByIdAndDelete(req.params.id);

    res.json({
      message: 'Joiner deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting joiner:', error);
    res.status(500).json({
      message: 'Server error',
      error: error.message
    });
  }
};

// Create user account for joiner
const createUserAccount = async (req, res) => {
  try {
    const joiner = await Joiner.findById(req.params.id);
    if (!joiner) {
      return res.status(404).json({
        message: 'Joiner not found'
      });
    }

    if (joiner.accountCreated) {
      return res.status(400).json({
        message: 'User account already created for this joiner'
      });
    }

    // Check if user with this email already exists
    const existingUser = await User.findOne({ email: joiner.email });
    if (existingUser) {
      return res.status(400).json({
        message: 'User with this email already exists'
      });
    }

    // Generate random password
    const password = Math.random().toString(36).slice(-8);
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user account
    const user = await User.create({
      name: joiner.name,
      email: joiner.email,
      password: hashedPassword,
      role: joiner.role,
      phone: joiner.phone,
      department: joiner.department,
      employeeId: joiner.employeeId,
      genre: joiner.genre,
      joiningDate: joiner.joiningDate,
      isActive: true
    });

    // Update joiner record
    joiner.accountCreated = true;
    joiner.accountCreatedAt = new Date();
    joiner.userId = user._id;
    joiner.status = 'active';
    await joiner.save();

    res.json({
      message: 'User account created successfully',
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        password: password // Return plain password for display
      }
    });
  } catch (error) {
    console.error('Error creating user account:', error);
    res.status(500).json({
      message: 'Server error',
      error: error.message
    });
  }
};

// Get joiner statistics
const getJoinerStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    let query = {};
    if (startDate && endDate) {
      query.joiningDate = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const stats = await Joiner.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
          active: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
          inactive: { $sum: { $cond: [{ $eq: ['$status', 'inactive'] }, 1, 0] } },
          completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
          accountCreated: { $sum: { $cond: ['$accountCreated', 1, 0] } }
        }
      }
    ]);

    // Get department breakdown
    const departmentStats = await Joiner.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$department',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Get daily joiners for calendar - use a simpler approach
    const dailyJoiners = await Joiner.aggregate([
      { $match: query },
      {
        $group: {
          _id: {
            year: { $year: '$joiningDate' },
            month: { $month: '$joiningDate' },
            day: { $dayOfMonth: '$joiningDate' }
          },
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          year: '$_id.year',
          month: '$_id.month',
          day: '$_id.day',
          count: 1,
          _id: 0
        }
      }
    ]);

    // Convert to simple YYYY-MM-DD format directly from year/month/day
    const processedDailyJoiners = dailyJoiners.map(item => {
      const year = item.year;
      const month = String(item.month).padStart(2, '0');
      const day = String(item.day).padStart(2, '0');
      const dateString = `${year}-${month}-${day}`;
      
      // console.log('Processing joiner date:', {
      //   year: item.year,
      //   month: item.month,
      //   day: item.day,
      //   dateString: dateString,
      //   count: item.count
      // });
      
      return {
        date: dateString,
        count: item.count
      };
    });

    // Debug: Log some sample joiners to see their actual dates
    const sampleJoiners = await Joiner.find({}).limit(5).select('candidate_name joiningDate date_of_joining joining_date');
    // console.log('Sample joiners with dates:', JSON.stringify(sampleJoiners, null, 2));

    // Debug: Test manual date creation for September 25, 26, 27
    const testDates = [
      { year: 2025, month: 9, day: 25 },
      { year: 2025, month: 9, day: 26 },
      { year: 2025, month: 9, day: 27 }
    ];
    
    testDates.forEach(testDate => {
      const dateString = `${testDate.year}-${String(testDate.month).padStart(2, '0')}-${String(testDate.day).padStart(2, '0')}`;
      // console.log('Test date:', { ...testDate, dateString });
    });

    // Debug: Log the daily joiners data
    // console.log('Raw dailyJoiners from backend:', JSON.stringify(dailyJoiners, null, 2));
    // console.log('Processed dailyJoiners:', JSON.stringify(processedDailyJoiners, null, 2));

    res.json({
      overview: stats[0] || {
        total: 0,
        pending: 0,
        active: 0,
        inactive: 0,
        completed: 0,
        accountCreated: 0
      },
      departmentStats,
      dailyJoiners: processedDailyJoiners
    });
  } catch (error) {
    console.error('Error fetching joiner stats:', error);
    res.status(500).json({
      message: 'Server error',
      error: error.message
    });
  }
};

module.exports = {
  createJoiner,
  getJoiners,
  getJoinerById,
  updateJoiner,
  deleteJoiner,
  createUserAccount,
  getJoinerStats
};
