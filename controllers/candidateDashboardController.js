const User = require('../models/User');
const UserNew = require('../models/UserNew');
const MCQDeployment = require('../models/MCQDeployment');
const Result = require('../models/Result');
const Assignment = require('../models/Assignment');
const DayPlan = require('../models/DayPlan');
const Observation = require('../models/Observation');

// @desc    Get candidate dashboard data
// @route   POST /api/admin/candidate-dashboard
// @access  Private (Admin)
const getCandidateDashboardData = async (req, res) => {
  try {
    const { uids, dateFrom, dateTo } = req.body;

    if (!uids || !Array.isArray(uids) || uids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide candidate UIDs'
      });
    }

    if (!dateFrom || !dateTo) {
      return res.status(400).json({
        success: false,
        message: 'Please provide date range'
      });
    }

    const startDate = new Date(dateFrom);
    const endDate = new Date(dateTo);
    endDate.setHours(23, 59, 59, 999); // Include the entire end date


    const candidates = [];

    for (const uid of uids) {
      try {
        // Search for user by multiple fields (employeeId, _id, author_id) in both User and UserNew models
        let user = await UserNew.findOne({ 
          $or: [
            { employeeId: uid.trim() },
            { _id: uid.trim() },
            { author_id: uid.trim() }
          ]
        });
        let userModel = 'UserNew';

        if (!user) {
          user = await User.findOne({ 
            $or: [
              { employeeId: uid.trim() },
              { _id: uid.trim() },
              { author_id: uid.trim() }
            ]
          });
          userModel = 'User';
        }

        if (!user) {
          continue;
        }

        // Get learning activity data
        const learningData = await getLearningActivityData(user, startDate, endDate);
        
        // Get assignment data
        const assignmentData = await getAssignmentData(user, startDate, endDate);
        
        // Get observation data
        const observationData = await getObservationData(user, startDate, endDate);

        // Calculate learning metrics
        const totalLearningHours = calculateTotalLearningHours(learningData);
        const dailyAverage = calculateDailyAverage(totalLearningHours, startDate, endDate);
        const learningStatus = calculateLearningStatus(assignmentData);
        const fortnightExams = calculateFortnightExams(learningData);

        const candidateData = {
          uid: user.employeeId,
          name: user.name,
          email: user.email,
          dateOfJoining: user.createdAt ? new Date(user.createdAt).toLocaleDateString('en-GB') : 'N/A',
          dateRange: `${dateFrom} to ${dateTo}`,
          learningStatus: learningStatus,
          currentCourse: getCurrentCourse(assignmentData),
          fortnightExams: fortnightExams,
          observations: observationData.observations || 'No observations available',
          totalHours: totalLearningHours.toFixed(1),
          dailyAverage: dailyAverage.toFixed(1),
          deploymentStatus: user.isDeployed || false,
          nativeState: user.state || 'Not specified',
          learningData: learningData,
          assignmentData: assignmentData
        };

        candidates.push(candidateData);

      } catch (error) {
        // Continue with other UIDs even if one fails
      }
    }

    res.json({
      success: true,
      candidates: candidates,
      totalCandidates: candidates.length,
      dateRange: {
        from: dateFrom,
        to: dateTo
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// Helper function to get learning activity data
const getLearningActivityData = async (user, startDate, endDate) => {
  try {
    // Get MCQ results within date range
    const mcqResults = await MCQDeployment.find({
      'results.traineeId': user.author_id,
      'results.completedAt': {
        $gte: startDate,
        $lte: endDate
      }
    }).select('name results questions scheduledDateTime');

    // Get assignment results within date range
    const assignmentResults = await Result.find({
      userId: user._id,
      completedAt: {
        $gte: startDate,
        $lte: endDate
      }
    }).populate('assignmentId', 'title description');

    // Get day plan activities within date range
    const dayPlanActivities = await DayPlan.find({
      userId: user._id,
      date: {
        $gte: startDate,
        $lte: endDate
      }
    }).select('date activities timeSpent');

    return {
      mcqResults: mcqResults,
      assignmentResults: assignmentResults,
      dayPlanActivities: dayPlanActivities
    };
  } catch (error) {
    return { mcqResults: [], assignmentResults: [], dayPlanActivities: [] };
  }
};

// Helper function to get assignment data
const getAssignmentData = async (user, startDate, endDate) => {
  try {
    const assignments = await Assignment.find({
      assignedTo: user._id,
      createdAt: {
        $gte: startDate,
        $lte: endDate
      }
    }).select('title description status createdAt dueDate');

    return assignments;
  } catch (error) {
    return [];
  }
};

// Helper function to get observation data
const getObservationData = async (user, startDate, endDate) => {
  try {
    const observations = await Observation.find({
      traineeId: user._id,
      createdAt: {
        $gte: startDate,
        $lte: endDate
      }
    }).select('observation notes createdAt').populate('trainerId', 'name');

    return {
      observations: observations.map(obs => 
        `${obs.observation} - ${obs.notes} (${new Date(obs.createdAt).toLocaleDateString()})`
      ).join('; ')
    };
  } catch (error) {
    return { observations: 'No observations available' };
  }
};

// Helper function to calculate total learning hours
const calculateTotalLearningHours = (learningData) => {
  let totalHours = 0;

  // Calculate from day plan activities
  learningData.dayPlanActivities.forEach(activity => {
    if (activity.timeSpent) {
      totalHours += activity.timeSpent / 60; // Convert minutes to hours
    }
  });

  // Calculate from MCQ results (estimate based on time spent)
  learningData.mcqResults.forEach(deployment => {
    deployment.results.forEach(result => {
      if (result.timeSpent) {
        totalHours += result.timeSpent / 3600; // Convert seconds to hours
      }
    });
  });

  return totalHours;
};

// Helper function to calculate daily average
const calculateDailyAverage = (totalHours, startDate, endDate) => {
  const daysDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
  return daysDiff > 0 ? totalHours / daysDiff : 0;
};

// Helper function to calculate learning status
const calculateLearningStatus = (assignmentData) => {
  if (assignmentData.length === 0) {
    return 'No assignments';
  }

  const completed = assignmentData.filter(assignment => assignment.status === 'completed').length;
  const total = assignmentData.length;
  const percentage = Math.round((completed / total) * 100);

  return `${completed}/${total} assignments completed (${percentage}%)`;
};

// Helper function to calculate fortnight exams
const calculateFortnightExams = (learningData) => {
  const mcqCount = learningData.mcqResults.length;
  const totalScore = learningData.mcqResults.reduce((sum, deployment) => {
    return sum + deployment.results.reduce((deploymentSum, result) => {
      return deploymentSum + (result.totalScore || 0);
    }, 0);
  }, 0);

  const averageScore = mcqCount > 0 ? Math.round(totalScore / mcqCount) : 0;

  return `${mcqCount} exams completed (${averageScore}% average)`;
};

// Helper function to get current course
const getCurrentCourse = (assignmentData) => {
  const activeAssignments = assignmentData.filter(assignment => 
    assignment.status === 'in_progress' || assignment.status === 'pending'
  );

  if (activeAssignments.length === 0) {
    return 'No active courses';
  }

  return activeAssignments[0].title || 'Active Course';
};

module.exports = {
  getCandidateDashboardData
};
