const mongoose = require("mongoose");
const User = require("../models/User");
const Attendance = require("../models/Attendance");
const DayPlan = require("../models/DayPlan");
const TraineeDayPlan = require("../models/TraineeDayPlan");
const Assignment = require("../models/Assignment");
const Observation = require("../models/Observation");
const Notification = require("../models/Notification");

// @desc    Get Master Trainer Dashboard
// @route   GET /api/dashboard/master-trainer
// @access  Private (Master Trainer)
const getMasterTrainerDashboard = async (req, res) => {
  try {
    const masterTrainerId = req.user.id;
    const { startDate, endDate } = req.query;

    // Set default date range (last 30 days)
    const defaultEndDate = new Date();
    const defaultStartDate = new Date();
    defaultStartDate.setDate(defaultStartDate.getDate() - 30);

    const dateFilter = {
      $gte: startDate ? new Date(startDate) : defaultStartDate,
      $lte: endDate ? new Date(endDate) : defaultEndDate
    };

    // Get all trainers and their assignments
    const trainers = await User.find({ role: "trainer" })
      .populate('assignedTrainees', 'name email employeeId department lastClockIn lastClockOut')
      .select('name email department assignedTrainees createdAt');

    // Get all trainees
    const trainees = await User.find({ role: "trainee" })
      .populate('assignedTrainer', 'name email')
      .select('name email employeeId department assignedTrainer lastClockIn lastClockOut joiningDate');

    // Get attendance statistics
    const attendanceStats = await Attendance.aggregate([
      {
        $match: {
          date: dateFilter
        }
      },
      {
        $group: {
          _id: null,
          totalRecords: { $sum: 1 },
          presentCount: {
            $sum: { $cond: [{ $eq: ["$status", "present"] }, 1, 0] }
          },
          absentCount: {
            $sum: { $cond: [{ $eq: ["$status", "absent"] }, 1, 0] }
          },
          lateCount: {
            $sum: { $cond: [{ $eq: ["$status", "late"] }, 1, 0] }
          },
          halfDayCount: {
            $sum: { $cond: [{ $eq: ["$status", "half_day"] }, 1, 0] }
          },
          averageHours: { $avg: "$totalHours" }
        }
      }
    ]);

    // Get day plan statistics
    const dayPlanStats = await DayPlan.aggregate([
      {
        $match: {
          date: dateFilter
        }
      },
      {
        $group: {
          _id: null,
          totalPlans: { $sum: 1 },
          publishedPlans: {
            $sum: { $cond: [{ $eq: ["$status", "published"] }, 1, 0] }
          },
          completedPlans: {
            $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] }
          },
          draftPlans: {
            $sum: { $cond: [{ $eq: ["$status", "draft"] }, 1, 0] }
          }
        }
      }
    ]);

    // Get observation statistics
    const observationStats = await Observation.aggregate([
      {
        $match: {
          date: dateFilter
        }
      },
      {
        $group: {
          _id: null,
          totalObservations: { $sum: 1 },
          submittedObservations: {
            $sum: { $cond: [{ $eq: ["$status", "submitted"] }, 1, 0] }
          },
          reviewedObservations: {
            $sum: { $cond: [{ $eq: ["$status", "reviewed"] }, 1, 0] }
          },
          averageRating: {
            $avg: {
              $switch: {
                branches: [
                  { case: { $eq: ["$overallRating", "excellent"] }, then: 4 },
                  { case: { $eq: ["$overallRating", "good"] }, then: 3 },
                  { case: { $eq: ["$overallRating", "average"] }, then: 2 },
                  { case: { $eq: ["$overallRating", "needs_improvement"] }, then: 1 }
                ],
                default: 0
              }
            }
          }
        }
      }
    ]);

    // Get recent activities
    const recentActivities = await Notification.find({
      recipient: masterTrainerId
    })
    .populate('sender', 'name email role')
    .sort({ createdAt: -1 })
    .limit(10);

    // Get assignment statistics
    const assignmentStats = await Assignment.aggregate([
      {
        $group: {
          _id: null,
          totalAssignments: { $sum: 1 },
          activeAssignments: {
            $sum: { $cond: [{ $eq: ["$status", "active"] }, 1, 0] }
          },
          completedAssignments: {
            $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] }
          },
          totalTraineesAssigned: { $sum: "$totalTrainees" }
        }
      }
    ]);

    res.json({
      overview: {
        totalTrainers: trainers.length,
        totalTrainees: trainees.length,
        assignedTrainees: trainees.filter(t => t.assignedTrainer).length,
        unassignedTrainees: trainees.filter(t => !t.assignedTrainer).length,
        activeAssignments: assignmentStats[0]?.activeAssignments || 0
      },
      attendance: attendanceStats[0] || {
        totalRecords: 0,
        presentCount: 0,
        absentCount: 0,
        lateCount: 0,
        halfDayCount: 0,
        averageHours: 0
      },
      dayPlans: dayPlanStats[0] || {
        totalPlans: 0,
        publishedPlans: 0,
        completedPlans: 0,
        draftPlans: 0
      },
      observations: observationStats[0] || {
        totalObservations: 0,
        submittedObservations: 0,
        reviewedObservations: 0,
        averageRating: 0
      },
      assignments: assignmentStats[0] || {
        totalAssignments: 0,
        activeAssignments: 0,
        completedAssignments: 0,
        totalTraineesAssigned: 0
      },
      trainers,
      trainees,
      recentActivities
    });

  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Get Trainer Dashboard
// @route   GET /api/dashboard/trainer
// @access  Private (Trainer)
const getTrainerDashboard = async (req, res) => {
  try {
    console.log('=== TRAINER DASHBOARD START ===');
    console.log('Request user:', req.user);
    const trainerId = req.user.id;
    const { startDate, endDate } = req.query;

    console.log('Trainer ID:', trainerId);
    console.log('Trainer ID type:', typeof trainerId);
    console.log('Date range:', { startDate, endDate });
    
    // First, let's just try to find the trainer
    console.log('Looking up trainer...');
    const trainer = await User.findById(trainerId)
      .populate('assignedTrainees', 'name email employeeId department lastClockIn lastClockOut')
      .select('name email assignedTrainees');

    if (!trainer) {
      console.log('Trainer not found');
      return res.status(404).json({ message: "Trainer not found" });
    }

    console.log(`Trainer found: ${trainer.name}`);
    console.log('Trainer object keys:', Object.keys(trainer.toObject()));
    console.log('assignedTrainees field:', trainer.assignedTrainees);
    console.log(`Assigned trainees: ${trainer.assignedTrainees ? trainer.assignedTrainees.length : 0}`);
    
    // Debug: Check all trainees in database and their assigned trainers
    console.log('Checking all trainees in database...');
    const allTrainees = await User.find({ role: 'trainee' }).select('name email assignedTrainer');
    console.log('All trainees:', allTrainees.length);
    allTrainees.forEach(trainee => {
      console.log(`Trainee: ${trainee.name}, Assigned Trainer: ${trainee.assignedTrainer}`);
    });
    
    // Find trainees assigned to this trainer
    const traineesAssignedToThisTrainer = allTrainees.filter(trainee => 
      trainee.assignedTrainer && trainee.assignedTrainer.toString() === trainerId
    );
    console.log(`Trainees assigned to this trainer: ${traineesAssignedToThisTrainer.length}`);
    
    // Ensure assignedTrainees is an array and initialize if needed
    let assignedTrainees = [];
    
    // Check if assignedTrainees exists and is an array
    if (trainer.assignedTrainees && Array.isArray(trainer.assignedTrainees)) {
      assignedTrainees = trainer.assignedTrainees;
    } else {
      console.log('assignedTrainees field is missing or invalid, initializing...');
      // Initialize the field in the database
      await User.findByIdAndUpdate(trainerId, { 
        $set: { assignedTrainees: [] } 
      });
      assignedTrainees = [];
      console.log('assignedTrainees field initialized');
    }
    
    // If no assigned trainees found in the trainer's assignedTrainees field, 
    // but we found trainees assigned to this trainer, update the trainer's assignedTrainees
    if (assignedTrainees.length === 0 && traineesAssignedToThisTrainer.length > 0) {
      console.log('Updating trainer assignedTrainees with found trainees...');
      const traineeIds = traineesAssignedToThisTrainer.map(t => t._id);
      await User.findByIdAndUpdate(trainerId, { 
        $set: { assignedTrainees: traineeIds } 
      });
      assignedTrainees = traineesAssignedToThisTrainer;
      console.log('Updated assignedTrainees with', assignedTrainees.length, 'trainees');
    }
    
    // Set default date range (last 30 days) - but let's be more lenient for testing
    const defaultEndDate = new Date();
    const defaultStartDate = new Date();
    defaultStartDate.setDate(defaultStartDate.getDate() - 30);

    // For now, let's not filter by date to see all day plans
    const dateFilter = startDate && endDate ? {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    } : {}; // No date filter if not specified

    console.log('Date filter:', dateFilter);

    // First, let's check all day plans to see what we have
    console.log('Checking all day plans in database...');
    let allDayPlans = [];
    let allTraineeDayPlans = [];
    
    try {
      allDayPlans = await DayPlan.find({}).select('trainer date status title').limit(10);
      console.log('All DayPlan records (first 10):', allDayPlans);
    } catch (error) {
      console.error('Error fetching DayPlan records:', error);
    }
    
    try {
      allTraineeDayPlans = await TraineeDayPlan.find({}).select('createdBy date status').limit(10);
      console.log('All TraineeDayPlan records (first 10):', allTraineeDayPlans);
    } catch (error) {
      console.error('Error fetching TraineeDayPlan records:', error);
    }
    
    // Check day plans for this specific trainer in both models
    console.log('Checking day plans for trainer:', trainerId);
    let trainerDayPlans = [];
    let trainerTraineeDayPlans = [];
    
    try {
      trainerDayPlans = await DayPlan.find({ trainer: trainerId }).select('trainer date status title');
      console.log('DayPlan records for this trainer:', trainerDayPlans);
    } catch (error) {
      console.error('Error fetching trainer DayPlan records:', error);
    }
    
    try {
      trainerTraineeDayPlans = await TraineeDayPlan.find({ 
        createdBy: 'trainer'
      }).select('createdBy date status trainee assignedTrainees');
      console.log('TraineeDayPlan records for this trainer:', trainerTraineeDayPlans);
    } catch (error) {
      console.error('Error fetching trainer TraineeDayPlan records:', error);
    }
    
    // Get day plans created by this trainer from both models
    console.log('Counting day plans from both models...');
    
    let dayPlanStats = [];
    let traineeDayPlanStats = [];
    
    // Count from DayPlan model
    try {
      dayPlanStats = await DayPlan.aggregate([
      {
        $match: {
            trainer: new mongoose.Types.ObjectId(trainerId),
            ...(Object.keys(dateFilter).length > 0 ? { date: dateFilter } : {})
        }
      },
      {
        $group: {
          _id: null,
            totalDayPlans: { $sum: 1 },
            publishedPlans: {
              $sum: { $cond: [{ $eq: ["$status", "published"] }, 1, 0] }
            },
            completedPlans: {
              $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] }
            },
            draftPlans: {
              $sum: { $cond: [{ $eq: ["$status", "draft"] }, 1, 0] }
            }
          }
        }
      ]);
      console.log('DayPlan stats:', dayPlanStats);
    } catch (error) {
      console.error('Error in DayPlan aggregation:', error);
    }

    // Count from TraineeDayPlan model where trainer created them
    try {
      traineeDayPlanStats = await TraineeDayPlan.aggregate([
      {
        $match: {
            createdBy: 'trainer',
            ...(Object.keys(dateFilter).length > 0 ? { date: dateFilter } : {})
        }
      },
      {
        $group: {
          _id: null,
            totalDayPlans: { $sum: 1 },
          publishedPlans: {
            $sum: { $cond: [{ $eq: ["$status", "published"] }, 1, 0] }
          },
          completedPlans: {
            $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] }
            },
            draftPlans: {
              $sum: { $cond: [{ $eq: ["$status", "draft"] }, 1, 0] }
            }
          }
        }
      ]);
      console.log('TraineeDayPlan stats (trainer created):', traineeDayPlanStats);
    } catch (error) {
      console.error('Error in TraineeDayPlan aggregation:', error);
    }

    // Count from TraineeDayPlan model where trainees created them (for this trainer's assigned trainees)
    let traineeCreatedDayPlanStats = [];
    try {
      if (assignedTrainees.length > 0) {
        traineeCreatedDayPlanStats = await TraineeDayPlan.aggregate([
          {
            $match: {
              createdBy: 'trainee',
              trainee: { $in: assignedTrainees.map(t => t._id) },
              ...(Object.keys(dateFilter).length > 0 ? { date: dateFilter } : {})
            }
          },
          {
            $group: {
              _id: null,
              totalDayPlans: { $sum: 1 },
              publishedPlans: {
                $sum: { $cond: [{ $eq: ["$status", "published"] }, 1, 0] }
              },
              completedPlans: {
                $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] }
              },
              draftPlans: {
                $sum: { $cond: [{ $eq: ["$status", "draft"] }, 1, 0] }
              }
            }
          }
        ]);
      }
      console.log('TraineeDayPlan stats (trainee created):', traineeCreatedDayPlanStats);
    } catch (error) {
      console.error('Error in TraineeDayPlan (trainee created) aggregation:', error);
    }
    
    // Combine the stats from all three sources
    const combinedStats = {
      totalDayPlans: (dayPlanStats[0]?.totalDayPlans || 0) + 
                    (traineeDayPlanStats[0]?.totalDayPlans || 0) + 
                    (traineeCreatedDayPlanStats[0]?.totalDayPlans || 0),
      publishedPlans: (dayPlanStats[0]?.publishedPlans || 0) + 
                     (traineeDayPlanStats[0]?.publishedPlans || 0) + 
                     (traineeCreatedDayPlanStats[0]?.publishedPlans || 0),
      completedPlans: (dayPlanStats[0]?.completedPlans || 0) + 
                     (traineeDayPlanStats[0]?.completedPlans || 0) + 
                     (traineeCreatedDayPlanStats[0]?.completedPlans || 0),
      draftPlans: (dayPlanStats[0]?.draftPlans || 0) + 
                 (traineeDayPlanStats[0]?.draftPlans || 0) + 
                 (traineeCreatedDayPlanStats[0]?.draftPlans || 0)
    };
    
    console.log('Combined stats:', combinedStats);

    // Get observations created by this trainer
    console.log('Counting observations...');
    
    // Debug: Check all observations in database
    const allObservations = await Observation.find({}).limit(5).select('trainer trainee date status');
    console.log('All observations in database (first 5):', allObservations);
    
    // Debug: Check observations for this specific trainer
    const trainerObservations = await Observation.find({ trainer: trainerId }).limit(5).select('trainer trainee date status');
    console.log('Observations for trainer', trainerId, ':', trainerObservations);
    
    const observationStats = await Observation.aggregate([
      {
        $match: {
          trainer: new mongoose.Types.ObjectId(trainerId),
          ...(Object.keys(dateFilter).length > 0 ? { date: dateFilter } : {})
        }
      },
      {
        $group: {
          _id: null,
          totalObservations: { $sum: 1 },
          submittedObservations: {
            $sum: { $cond: [{ $eq: ["$status", "submitted"] }, 1, 0] }
          },
          reviewedObservations: {
            $sum: { $cond: [{ $eq: ["$status", "reviewed"] }, 1, 0] }
          }
        }
      }
    ]);

    console.log('Observation stats:', observationStats);

    // Get recent day plans
    console.log('Fetching recent day plans...');
    const recentDayPlans = await DayPlan.find({
      trainer: new mongoose.Types.ObjectId(trainerId),
      ...(Object.keys(dateFilter).length > 0 ? { date: dateFilter } : {})
    })
      .populate('assignedTrainees', 'name email')
      .sort({ createdAt: -1 })
      .limit(5)
      .select('title date status assignedTrainees createdAt');

    console.log('Recent day plans:', recentDayPlans.length);

    // Get recent observations
    console.log('Fetching recent observations...');
    const recentObservations = await Observation.find({
      trainer: new mongoose.Types.ObjectId(trainerId),
      ...(Object.keys(dateFilter).length > 0 ? { date: dateFilter } : {})
    })
      .populate('trainee', 'name email')
      .sort({ createdAt: -1 })
      .limit(5)
      .select('trainee date status rating comments createdAt');

    console.log('Recent observations:', recentObservations.length);

    // Get unread notifications
    console.log('Fetching notifications...');
    const unreadNotifications = await Notification.countDocuments({
      recipient: new mongoose.Types.ObjectId(trainerId),
      read: false
    });

    console.log('Unread notifications:', unreadNotifications);

    console.log('=== TRAINER DASHBOARD SUCCESS ===');

    res.json({
      overview: {
        assignedTrainees: assignedTrainees.length,
        totalDayPlans: combinedStats.totalDayPlans,
        totalObservations: observationStats[0]?.totalObservations || 0,
        unreadNotifications: unreadNotifications,
        todayClockIn: null, // Add this for compatibility
        todayClockOut: null
      },
      stats: {
        totalTrainees: assignedTrainees.length,
        totalDayPlans: combinedStats.totalDayPlans,
        totalObservations: observationStats[0]?.totalObservations || 0,
        todayClockIn: null
      },
      assignedTrainees: assignedTrainees,
      recentDayPlans: recentDayPlans,
      recentObservations: recentObservations,
      notifications: []
    });

  } catch (error) {
    console.error('=== TRAINER DASHBOARD ERROR ===');
    console.error('Error details:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Get Trainee Dashboard
// @route   GET /api/dashboard/trainee
// @access  Private (Trainee)
const getTraineeDashboard = async (req, res) => {
  try {
    const traineeId = req.user.id;
    const { startDate, endDate } = req.query;

    // Set default date range (last 30 days)
    const defaultEndDate = new Date();
    const defaultStartDate = new Date();
    defaultStartDate.setDate(defaultStartDate.getDate() - 30);

    const dateFilter = {
      $gte: startDate ? new Date(startDate) : defaultStartDate,
      $lte: endDate ? new Date(endDate) : defaultEndDate
    };

    // Get trainee info
    const trainee = await User.findById(traineeId)
      .populate('assignedTrainer', 'name email')
      .select('name email employeeId department assignedTrainer lastClockIn lastClockOut');

    if (!trainee) {
      return res.status(404).json({ message: "Trainee not found" });
    }

    // Get attendance statistics
    const attendanceStats = await Attendance.aggregate([
      {
        $match: {
          user: traineeId,
          date: dateFilter
        }
      },
      {
        $group: {
          _id: null,
          totalDays: { $sum: 1 },
          presentDays: {
            $sum: { $cond: [{ $eq: ["$status", "present"] }, 1, 0] }
          },
          absentDays: {
            $sum: { $cond: [{ $eq: ["$status", "absent"] }, 1, 0] }
          },
          lateDays: {
            $sum: { $cond: [{ $eq: ["$status", "late"] }, 1, 0] }
          },
          averageHours: { $avg: "$totalHours" },
          totalHours: { $sum: "$totalHours" }
        }
      }
    ]);

    // Get day plans assigned to trainee
    const dayPlanStats = await DayPlan.aggregate([
      {
        $match: {
          assignedTrainees: traineeId,
          date: dateFilter
        }
      },
      {
        $group: {
          _id: null,
          totalPlans: { $sum: 1 },
          completedTasks: {
            $sum: {
              $size: {
                $filter: {
                  input: "$tasks",
                  cond: { $eq: ["$$this.status", "completed"] }
                }
              }
            }
          },
          totalTasks: {
            $sum: { $size: "$tasks" }
          }
        }
      }
    ]);

    // Get recent day plans
    const recentDayPlans = await DayPlan.find({ assignedTrainees: traineeId })
      .populate('trainer', 'name email')
      .sort({ date: -1 })
      .limit(5);

    // Get observations about this trainee
    const recentObservations = await Observation.find({ trainee: traineeId })
      .populate('trainer', 'name email')
      .sort({ createdAt: -1 })
      .limit(5);

    // Get notifications
    const notifications = await Notification.find({ recipient: traineeId })
      .populate('sender', 'name email role')
      .sort({ createdAt: -1 })
      .limit(10);

    // Get today's attendance status
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayAttendance = await Attendance.findOne({
      user: traineeId,
      date: today
    });

    res.json({
      overview: {
        assignedTrainer: trainee.assignedTrainer,
        totalDayPlans: dayPlanStats[0]?.totalPlans || 0,
        completedTasks: dayPlanStats[0]?.completedTasks || 0,
        totalTasks: dayPlanStats[0]?.totalTasks || 0,
        unreadNotifications: notifications.filter(n => !n.isRead).length,
        todayClockIn: todayAttendance?.clockIn?.time || null,
        todayClockOut: todayAttendance?.clockOut?.time || null
      },
      attendance: attendanceStats[0] || {
        totalDays: 0,
        presentDays: 0,
        absentDays: 0,
        lateDays: 0,
        averageHours: 0,
        totalHours: 0
      },
      dayPlans: dayPlanStats[0] || {
        totalPlans: 0,
        completedTasks: 0,
        totalTasks: 0
      },
      recentDayPlans,
      recentObservations,
      notifications,
      todayAttendance: todayAttendance ? {
        clockedIn: !!todayAttendance.clockIn?.time,
        clockedOut: !!todayAttendance.clockOut?.time,
        clockInTime: todayAttendance.clockIn?.time,
        clockOutTime: todayAttendance.clockOut?.time,
        totalHours: todayAttendance.totalHours || 0,
        status: todayAttendance.status
      } : null
    });

  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

module.exports = {
  getMasterTrainerDashboard,
  getTrainerDashboard,
  getTraineeDashboard
};
