const User = require("../models/User");
const Attendance = require("../models/Attendance");
const DayPlan = require("../models/DayPlan");
const Assignment = require("../models/Assignment");
const Observation = require("../models/Observation");
const Notification = require("../models/Notification");

// @desc    Generate attendance report
// @route   GET /api/reports/attendance
// @access  Private (Master Trainer, Trainer)
const generateAttendanceReport = async (req, res) => {
  try {
    const { startDate, endDate, userId, format = 'json' } = req.query;
    const requesterId = req.user.id;
    const requesterRole = req.user.role;

    if (!startDate || !endDate) {
      return res.status(400).json({ message: "Start date and end date are required" });
    }

    const dateFilter = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };

    let matchQuery = { date: dateFilter };

    // If specific user requested, filter by user
    if (userId) {
      matchQuery.user = userId;
    } else if (requesterRole === "trainer") {
      // Trainers can only see their assigned trainees
      const trainer = await User.findById(requesterId).populate('assignedTrainees');
      matchQuery.user = { $in: trainer.assignedTrainees.map(t => t._id) };
    }

    const attendanceData = await Attendance.find(matchQuery)
      .populate('user', 'name email employeeId department role')
      .sort({ date: -1, user: 1 });

    // Calculate summary statistics
    const summary = await Attendance.aggregate([
      { $match: matchQuery },
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
          overtimeCount: {
            $sum: { $cond: [{ $eq: ["$status", "overtime"] }, 1, 0] }
          },
          averageHours: { $avg: "$totalHours" },
          totalHours: { $sum: "$totalHours" }
        }
      }
    ]);

    const report = {
      period: {
        startDate: new Date(startDate),
        endDate: new Date(endDate)
      },
      summary: summary[0] || {
        totalRecords: 0,
        presentCount: 0,
        absentCount: 0,
        lateCount: 0,
        halfDayCount: 0,
        overtimeCount: 0,
        averageHours: 0,
        totalHours: 0
      },
      data: attendanceData
    };

    if (format === 'csv') {
      // Convert to CSV format
      const csvData = convertAttendanceToCSV(attendanceData);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="attendance-report-${startDate}-to-${endDate}.csv"`);
      return res.send(csvData);
    }

    res.json(report);

  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Generate day plan compliance report
// @route   GET /api/reports/day-plan-compliance
// @access  Private (Master Trainer, Trainer)
const generateDayPlanComplianceReport = async (req, res) => {
  try {
    const { startDate, endDate, trainerId, format = 'json' } = req.query;
    const requesterId = req.user.id;
    const requesterRole = req.user.role;

    if (!startDate || !endDate) {
      return res.status(400).json({ message: "Start date and end date are required" });
    }

    const dateFilter = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };

    let matchQuery = { date: dateFilter };

    if (trainerId) {
      matchQuery.trainer = trainerId;
    } else if (requesterRole === "trainer") {
      matchQuery.trainer = requesterId;
    }

    const dayPlans = await DayPlan.find(matchQuery)
      .populate('trainer', 'name email')
      .populate('assignedTrainees', 'name email employeeId')
      .sort({ date: -1 });

    // Calculate compliance statistics
    const complianceStats = await DayPlan.aggregate([
      { $match: matchQuery },
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
          averageTasksPerPlan: { $avg: { $size: "$tasks" } },
          totalTasks: { $sum: { $size: "$tasks" } },
          completedTasks: {
            $sum: {
              $size: {
                $filter: {
                  input: "$tasks",
                  cond: { $eq: ["$$this.status", "completed"] }
                }
              }
            }
          }
        }
      }
    ]);

    const report = {
      period: {
        startDate: new Date(startDate),
        endDate: new Date(endDate)
      },
      summary: complianceStats[0] || {
        totalPlans: 0,
        publishedPlans: 0,
        completedPlans: 0,
        averageTasksPerPlan: 0,
        totalTasks: 0,
        completedTasks: 0
      },
      data: dayPlans
    };

    if (format === 'csv') {
      const csvData = convertDayPlansToCSV(dayPlans);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="day-plan-compliance-${startDate}-to-${endDate}.csv"`);
      return res.send(csvData);
    }

    res.json(report);

  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Generate observation report
// @route   GET /api/reports/observations
// @access  Private (Master Trainer, Trainer)
const generateObservationReport = async (req, res) => {
  try {
    const { startDate, endDate, trainerId, traineeId, format = 'json' } = req.query;
    const requesterId = req.user.id;
    const requesterRole = req.user.role;

    if (!startDate || !endDate) {
      return res.status(400).json({ message: "Start date and end date are required" });
    }

    const dateFilter = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };

    let matchQuery = { date: dateFilter };

    if (trainerId) {
      matchQuery.trainer = trainerId;
    } else if (requesterRole === "trainer") {
      matchQuery.trainer = requesterId;
    }

    if (traineeId) {
      matchQuery.trainee = traineeId;
    }

    const observations = await Observation.find(matchQuery)
      .populate('trainer', 'name email')
      .populate('trainee', 'name email employeeId department')
      .sort({ date: -1 });

    // Calculate observation statistics
    const observationStats = await Observation.aggregate([
      { $match: matchQuery },
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
          excellentCount: {
            $sum: { $cond: [{ $eq: ["$overallRating", "excellent"] }, 1, 0] }
          },
          goodCount: {
            $sum: { $cond: [{ $eq: ["$overallRating", "good"] }, 1, 0] }
          },
          averageCount: {
            $sum: { $cond: [{ $eq: ["$overallRating", "average"] }, 1, 0] }
          },
          needsImprovementCount: {
            $sum: { $cond: [{ $eq: ["$overallRating", "needs_improvement"] }, 1, 0] }
          }
        }
      }
    ]);

    const report = {
      period: {
        startDate: new Date(startDate),
        endDate: new Date(endDate)
      },
      summary: observationStats[0] || {
        totalObservations: 0,
        submittedObservations: 0,
        reviewedObservations: 0,
        excellentCount: 0,
        goodCount: 0,
        averageCount: 0,
        needsImprovementCount: 0
      },
      data: observations
    };

    if (format === 'csv') {
      const csvData = convertObservationsToCSV(observations);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="observation-report-${startDate}-to-${endDate}.csv"`);
      return res.send(csvData);
    }

    res.json(report);

  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Generate assignment report
// @route   GET /api/reports/assignments
// @access  Private (Master Trainer)
const generateAssignmentReport = async (req, res) => {
  try {
    const { startDate, endDate, status, format = 'json' } = req.query;
    const requesterId = req.user.id;

    let matchQuery = { masterTrainer: requesterId };

    if (startDate && endDate) {
      matchQuery.assignmentDate = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    if (status) {
      matchQuery.status = status;
    }

    const assignments = await Assignment.find(matchQuery)
      .populate('trainer', 'name email')
      .populate('trainees', 'name email employeeId department')
      .populate('masterTrainer', 'name email')
      .sort({ assignmentDate: -1 });

    // Calculate assignment statistics
    const assignmentStats = await Assignment.aggregate([
      { $match: matchQuery },
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
          totalTraineesAssigned: { $sum: "$totalTrainees" },
          averageTraineesPerAssignment: { $avg: "$totalTrainees" }
        }
      }
    ]);

    const report = {
      period: startDate && endDate ? {
        startDate: new Date(startDate),
        endDate: new Date(endDate)
      } : null,
      summary: assignmentStats[0] || {
        totalAssignments: 0,
        activeAssignments: 0,
        completedAssignments: 0,
        totalTraineesAssigned: 0,
        averageTraineesPerAssignment: 0
      },
      data: assignments
    };

    if (format === 'csv') {
      const csvData = convertAssignmentsToCSV(assignments);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="assignment-report-${startDate || 'all'}-to-${endDate || 'all'}.csv"`);
      return res.send(csvData);
    }

    res.json(report);

  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Generate audit log
// @route   GET /api/reports/audit
// @access  Private (Master Trainer)
const generateAuditLog = async (req, res) => {
  try {
    const { startDate, endDate, action, userId, format = 'json' } = req.query;
    const requesterId = req.user.id;

    let matchQuery = {};

    if (startDate && endDate) {
      matchQuery.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    if (action) {
      matchQuery.type = action;
    }

    if (userId) {
      matchQuery.sender = userId;
    }

    // Get notifications as audit trail
    const auditLog = await Notification.find(matchQuery)
      .populate('sender', 'name email role')
      .populate('recipient', 'name email role')
      .sort({ createdAt: -1 })
      .limit(1000); // Limit to prevent large responses

    const report = {
      period: startDate && endDate ? {
        startDate: new Date(startDate),
        endDate: new Date(endDate)
      } : null,
      totalRecords: auditLog.length,
      data: auditLog
    };

    if (format === 'csv') {
      const csvData = convertAuditLogToCSV(auditLog);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="audit-log-${startDate || 'all'}-to-${endDate || 'all'}.csv"`);
      return res.send(csvData);
    }

    res.json(report);

  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Helper functions to convert data to CSV
const convertAttendanceToCSV = (attendanceData) => {
  const headers = ['Date', 'User', 'Email', 'Employee ID', 'Department', 'Clock In', 'Clock Out', 'Total Hours', 'Status', 'Notes'];
  const rows = attendanceData.map(record => [
    record.date.toISOString().split('T')[0],
    record.user.name,
    record.user.email,
    record.user.employeeId || '',
    record.user.department || '',
    record.clockIn?.time ? record.clockIn.time.toISOString() : '',
    record.clockOut?.time ? record.clockOut.time.toISOString() : '',
    record.totalHours || 0,
    record.status,
    record.notes || ''
  ]);

  return [headers, ...rows].map(row => row.join(',')).join('\n');
};

const convertDayPlansToCSV = (dayPlans) => {
  const headers = ['Date', 'Title', 'Trainer', 'Status', 'Start Time', 'End Time', 'Duration', 'Assigned Trainees', 'Tasks Count', 'Completed Tasks'];
  const rows = dayPlans.map(plan => [
    plan.date.toISOString().split('T')[0],
    plan.title,
    plan.trainer.name,
    plan.status,
    plan.startTime,
    plan.endTime,
    plan.duration,
    plan.assignedTrainees.map(t => t.name).join('; '),
    plan.tasks.length,
    plan.tasks.filter(t => t.status === 'completed').length
  ]);

  return [headers, ...rows].map(row => row.join(',')).join('\n');
};

const convertObservationsToCSV = (observations) => {
  const headers = ['Date', 'Trainer', 'Trainee', 'Overall Rating', 'Culture Rating', 'Grooming Rating', 'Status', 'Strengths', 'Areas for Improvement'];
  const rows = observations.map(obs => [
    obs.date.toISOString().split('T')[0],
    obs.trainer.name,
    obs.trainee.name,
    obs.overallRating,
    obs.culture.communication,
    obs.grooming.dressCode,
    obs.status,
    obs.strengths.join('; '),
    obs.areasForImprovement.join('; ')
  ]);

  return [headers, ...rows].map(row => row.join(',')).join('\n');
};

const convertAssignmentsToCSV = (assignments) => {
  const headers = ['Assignment Date', 'Master Trainer', 'Trainer', 'Status', 'Total Trainees', 'Trainees', 'Notes'];
  const rows = assignments.map(assignment => [
    assignment.assignmentDate.toISOString().split('T')[0],
    assignment.masterTrainer.name,
    assignment.trainer.name,
    assignment.status,
    assignment.totalTrainees,
    assignment.trainees.map(t => t.name).join('; '),
    assignment.notes || ''
  ]);

  return [headers, ...rows].map(row => row.join(',')).join('\n');
};

const convertAuditLogToCSV = (auditLog) => {
  const headers = ['Date', 'Time', 'Sender', 'Recipient', 'Action', 'Title', 'Message', 'Priority'];
  const rows = auditLog.map(log => [
    log.createdAt.toISOString().split('T')[0],
    log.createdAt.toISOString().split('T')[1].split('.')[0],
    log.sender.name,
    log.recipient.name,
    log.type,
    log.title,
    log.message,
    log.priority
  ]);

  return [headers, ...rows].map(row => row.join(',')).join('\n');
};

module.exports = {
  generateAttendanceReport,
  generateDayPlanComplianceReport,
  generateObservationReport,
  generateAssignmentReport,
  generateAuditLog
};