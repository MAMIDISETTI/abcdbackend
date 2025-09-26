const Observation = require("../models/Observation");
const User = require("../models/User");
const Notification = require("../models/Notification");

// @desc    Create observation report
// @route   POST /api/observations
// @access  Private (Trainer)
const createObservation = async (req, res) => {
  try {
    const trainerId = req.user.id;
    const {
      traineeId,
      date,
      culture,
      grooming,
      overallRating,
      strengths,
      areasForImprovement,
      recommendations
    } = req.body;

    // Validate trainee exists and is assigned to trainer
    const trainer = await User.findById(trainerId).populate('assignedTrainees');
    if (!trainer) {
      return res.status(404).json({ message: "Trainer not found" });
    }

    const hasAccess = trainer.assignedTrainees.some(t => t._id.toString() === traineeId);
    if (!hasAccess) {
      return res.status(403).json({ message: "Access denied" });
    }

    // Check if observation already exists for this date
    const existingObservation = await Observation.findOne({
      trainer: trainerId,
      trainee: traineeId,
      date: new Date(date)
    });

    if (existingObservation) {
      return res.status(400).json({ 
        message: "Observation already exists for this date",
        observationId: existingObservation._id
      });
    }

    const observation = await Observation.create({
      trainer: trainerId,
      trainee: traineeId,
      date: new Date(date),
      culture,
      grooming,
      overallRating,
      strengths: strengths || [],
      areasForImprovement: areasForImprovement || [],
      recommendations: recommendations || ""
    });

    // Send notification to Master Trainer
    const masterTrainers = await User.find({ role: "master_trainer" });
    for (const masterTrainer of masterTrainers) {
      await Notification.create({
        recipient: masterTrainer._id,
        sender: trainerId,
        title: "New Observation Report",
        message: `New observation report submitted for trainee`,
        type: "observation_reminder",
        relatedEntity: {
          type: "observation",
          id: observation._id
        },
        priority: "medium"
      });
    }

    res.status(201).json({
      message: "Observation created successfully",
      observation
    });

  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Get observations by trainer
// @route   GET /api/observations
// @access  Private (Trainer)
const getObservations = async (req, res) => {
  try {
    const trainerId = req.user.id;
    const { traineeId, startDate, endDate, status, page = 1, limit = 20 } = req.query;

    let query = { trainer: trainerId };

    if (traineeId) {
      query.trainee = traineeId;
    }

    if (status) {
      query.status = status;
    }

    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const observations = await Observation.find(query)
      .populate('trainee', 'name email employeeId department')
      .sort({ date: -1, createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Observation.countDocuments(query);

    res.json({
      observations,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });

  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Get observations for Master Trainer
// @route   GET /api/observations/master-trainer
// @access  Private (Master Trainer)
const getMasterTrainerObservations = async (req, res) => {
  try {
    const { trainerId, traineeId, startDate, endDate, status, page = 1, limit = 20 } = req.query;

    let query = {};

    if (trainerId) {
      query.trainer = trainerId;
    }

    if (traineeId) {
      query.trainee = traineeId;
    }

    if (status) {
      query.status = status;
    }

    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const observations = await Observation.find(query)
      .populate('trainer', 'name email')
      .populate('trainee', 'name email employeeId department')
      .sort({ date: -1, createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Observation.countDocuments(query);

    res.json({
      observations,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });

  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Get observations for trainee
// @route   GET /api/observations/trainee
// @access  Private (Trainee)
const getTraineeObservations = async (req, res) => {
  try {
    const traineeId = req.user.id;
    const { startDate, endDate, page = 1, limit = 20 } = req.query;

    let query = { trainee: traineeId };

    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const observations = await Observation.find(query)
      .populate('trainer', 'name email')
      .sort({ date: -1, createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Observation.countDocuments(query);

    res.json({
      observations,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });

  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Get specific observation
// @route   GET /api/observations/:id
// @access  Private (Trainer, Trainee, Master Trainer)
const getObservation = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    const observation = await Observation.findById(id)
      .populate('trainer', 'name email')
      .populate('trainee', 'name email employeeId department');

    if (!observation) {
      return res.status(404).json({ message: "Observation not found" });
    }

    // Check access permissions
    if (userRole === "trainee") {
      if (observation.trainee._id.toString() !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }
    } else if (userRole === "trainer") {
      if (observation.trainer._id.toString() !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }
    }
    // Master trainers have access to all observations

    res.json(observation);

  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Update observation
// @route   PUT /api/observations/:id
// @access  Private (Trainer)
const updateObservation = async (req, res) => {
  try {
    const { id } = req.params;
    const trainerId = req.user.id;
    const updateData = req.body;

    const observation = await Observation.findById(id);
    if (!observation) {
      return res.status(404).json({ message: "Observation not found" });
    }

    if (observation.trainer.toString() !== trainerId) {
      return res.status(403).json({ message: "Access denied" });
    }

    if (observation.status === "submitted") {
      return res.status(400).json({ message: "Cannot update submitted observation" });
    }

    const updatedObservation = await Observation.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    )
    .populate('trainee', 'name email employeeId department');

    res.json({
      message: "Observation updated successfully",
      observation: updatedObservation
    });

  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Submit observation
// @route   PUT /api/observations/:id/submit
// @access  Private (Trainer)
const submitObservation = async (req, res) => {
  try {
    const { id } = req.params;
    const trainerId = req.user.id;

    const observation = await Observation.findById(id);
    if (!observation) {
      return res.status(404).json({ message: "Observation not found" });
    }

    if (observation.trainer.toString() !== trainerId) {
      return res.status(403).json({ message: "Access denied" });
    }

    observation.status = "submitted";
    observation.submittedAt = new Date();
    await observation.save();

    // Send notification to Master Trainer
    const masterTrainers = await User.find({ role: "master_trainer" });
    for (const masterTrainer of masterTrainers) {
      await Notification.create({
        recipient: masterTrainer._id,
        sender: trainerId,
        title: "Observation Report Submitted",
        message: `Observation report has been submitted for review`,
        type: "observation_reminder",
        relatedEntity: {
          type: "observation",
          id: observation._id
        },
        priority: "medium"
      });
    }

    res.json({
      message: "Observation submitted successfully",
      observation
    });

  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Review observation (Master Trainer)
// @route   PUT /api/observations/:id/review
// @access  Private (Master Trainer)
const reviewObservation = async (req, res) => {
  try {
    const { id } = req.params;
    const masterTrainerId = req.user.id;
    const { masterTrainerNotes } = req.body;

    const observation = await Observation.findById(id);
    if (!observation) {
      return res.status(404).json({ message: "Observation not found" });
    }

    observation.status = "reviewed";
    observation.reviewedBy = masterTrainerId;
    observation.reviewedAt = new Date();
    observation.masterTrainerNotes = masterTrainerNotes || "";

    await observation.save();

    res.json({
      message: "Observation reviewed successfully",
      observation
    });

  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Get observation statistics
// @route   GET /api/observations/stats
// @access  Private (Trainer, Master Trainer)
const getObservationStats = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    const { startDate, endDate } = req.query;

    let matchQuery = {};

    if (userRole === "trainer") {
      matchQuery.trainer = userId;
    }

    if (startDate && endDate) {
      matchQuery.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const stats = await Observation.aggregate([
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
          averageOverallRating: {
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

    res.json(stats[0] || {
      totalObservations: 0,
      submittedObservations: 0,
      reviewedObservations: 0,
      averageOverallRating: 0
    });

  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

module.exports = {
  createObservation,
  getObservations,
  getMasterTrainerObservations,
  getTraineeObservations,
  getObservation,
  updateObservation,
  submitObservation,
  reviewObservation,
  getObservationStats
};
