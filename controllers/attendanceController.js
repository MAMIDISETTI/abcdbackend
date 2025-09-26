const Attendance = require("../models/Attendance");
const User = require("../models/User");
const Notification = require("../models/Notification");

// @desc    Clock in user
// @route   POST /api/attendance/clock-in
// @access  Private (Trainer, Trainee)
const clockIn = async (req, res) => {
  try {
    const userId = req.user.id;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check if already clocked in today
    const existingAttendance = await Attendance.findOne({
      user: userId,
      date: today
    });

    if (existingAttendance && existingAttendance.clockIn.time) {
      return res.status(400).json({ 
        message: "Already clocked in today",
        clockInTime: existingAttendance.clockIn.time
      });
    }

    const clockInTime = new Date();
    const clockInData = {
      time: clockInTime,
      location: req.body.location || null,
      ipAddress: req.ip || req.connection.remoteAddress
    };

    if (existingAttendance) {
      // Update existing record
      existingAttendance.clockIn = clockInData;
      await existingAttendance.save();
    } else {
      // Create new attendance record
      await Attendance.create({
        user: userId,
        date: today,
        clockIn: clockInData
      });
    }

    // Update user's last clock in time
    await User.findByIdAndUpdate(userId, { lastClockIn: clockInTime });

    res.json({
      message: `Clocked in at ${clockInTime.toLocaleTimeString()}`,
      clockInTime: clockInTime,
      success: true
    });

  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Clock out user
// @route   POST /api/attendance/clock-out
// @access  Private (Trainer, Trainee)
const clockOut = async (req, res) => {
  try {
    const userId = req.user.id;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const attendance = await Attendance.findOne({
      user: userId,
      date: today
    });

    if (!attendance || !attendance.clockIn.time) {
      return res.status(400).json({ message: "Must clock in first" });
    }

    if (attendance.clockOut.time) {
      return res.status(400).json({ 
        message: "Already clocked out today",
        clockOutTime: attendance.clockOut.time
      });
    }

    const clockOutTime = new Date();
    const clockInTime = attendance.clockIn.time;
    
    // Calculate total hours
    const totalHours = (clockOutTime - clockInTime) / (1000 * 60 * 60);
    const isFullDay = totalHours >= 8;

    // Determine status
    let status = "present";
    if (totalHours < 4) {
      status = "half_day";
    } else if (totalHours > 10) {
      status = "overtime";
    }

    attendance.clockOut = {
      time: clockOutTime,
      location: req.body.location || null,
      ipAddress: req.ip || req.connection.remoteAddress
    };
    attendance.totalHours = totalHours;
    attendance.isFullDay = isFullDay;
    attendance.status = status;
    attendance.notes = req.body.notes || "";

    await attendance.save();

    // Update user's last clock out time
    await User.findByIdAndUpdate(userId, { lastClockOut: clockOutTime });

    res.json({
      message: `Clocked out at ${clockOutTime.toLocaleTimeString()}`,
      clockOutTime: clockOutTime,
      totalHours: totalHours.toFixed(2),
      isFullDay: isFullDay,
      status: status,
      success: true
    });

  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Get today's attendance status
// @route   GET /api/attendance/today
// @access  Private (Trainer, Trainee)
const getTodayAttendance = async (req, res) => {
  try {
    const userId = req.user.id;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const attendance = await Attendance.findOne({
      user: userId,
      date: today
    });

    if (!attendance) {
      return res.json({
        clockedIn: false,
        clockedOut: false,
        clockInTime: null,
        clockOutTime: null,
        totalHours: 0,
        status: "absent"
      });
    }

    res.json({
      clockedIn: !!attendance.clockIn.time,
      clockedOut: !!attendance.clockOut.time,
      clockInTime: attendance.clockIn.time,
      clockOutTime: attendance.clockOut.time,
      totalHours: attendance.totalHours || 0,
      status: attendance.status,
      isFullDay: attendance.isFullDay
    });

  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Get attendance history
// @route   GET /api/attendance/history
// @access  Private (Trainer, Trainee)
const getAttendanceHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const { startDate, endDate, page = 1, limit = 30 } = req.query;

    let query = { user: userId };
    
    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const attendances = await Attendance.find(query)
      .sort({ date: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('user', 'name email role');

    const total = await Attendance.countDocuments(query);

    res.json({
      attendances,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });

  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Get trainee attendance (for trainers)
// @route   GET /api/attendance/trainees
// @access  Private (Trainer)
const getTraineeAttendance = async (req, res) => {
  try {
    const trainerId = req.user.id;
    const { date, traineeId } = req.query;

    // Get trainer's assigned trainees
    const trainer = await User.findById(trainerId).populate('assignedTrainees');
    if (!trainer) {
      return res.status(404).json({ message: "Trainer not found" });
    }

    let query = { 
      user: { $in: trainer.assignedTrainees.map(t => t._id) }
    };

    if (traineeId) {
      query.user = traineeId;
    }

    if (date) {
      const targetDate = new Date(date);
      targetDate.setHours(0, 0, 0, 0);
      query.date = targetDate;
    }

    const attendances = await Attendance.find(query)
      .populate('user', 'name email employeeId department')
      .sort({ date: -1 });

    res.json(attendances);

  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Validate attendance (for trainers)
// @route   PUT /api/attendance/validate/:id
// @access  Private (Trainer)
const validateAttendance = async (req, res) => {
  try {
    const { id } = req.params;
    const trainerId = req.user.id;
    const { isValid, notes } = req.body;

    const attendance = await Attendance.findById(id);
    if (!attendance) {
      return res.status(404).json({ message: "Attendance record not found" });
    }

    // Check if trainer has access to this trainee
    const trainer = await User.findById(trainerId);
    const hasAccess = trainer.assignedTrainees.includes(attendance.user);
    
    if (!hasAccess) {
      return res.status(403).json({ message: "Access denied" });
    }

    attendance.isValidated = isValid;
    attendance.validatedBy = trainerId;
    attendance.validatedAt = new Date();
    if (notes) {
      attendance.notes = notes;
    }

    await attendance.save();

    res.json({
      message: `Attendance ${isValid ? 'validated' : 'rejected'} successfully`,
      attendance
    });

  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

module.exports = {
  clockIn,
  clockOut,
  getTodayAttendance,
  getAttendanceHistory,
  getTraineeAttendance,
  validateAttendance
};
