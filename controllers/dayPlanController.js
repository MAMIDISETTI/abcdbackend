const DayPlan = require("../models/DayPlan");
const User = require("../models/User");
const Notification = require("../models/Notification");

// @desc    Create a new day plan
// @route   POST /api/dayplans
// @access  Private (Trainer)
const createDayPlan = async (req, res) => {
  try {
    const trainerId = req.user.id;
    const {
      title,
      description,
      date,
      startTime,
      endTime,
      tasks,
      assignedTrainees,
      notes
    } = req.body;

    // Calculate duration
    const start = new Date(`2000-01-01T${startTime}`);
    const end = new Date(`2000-01-01T${endTime}`);
    const duration = (end - start) / (1000 * 60 * 60);

    // Validate 8-hour requirement
    if (duration !== 8) {
      return res.status(400).json({ 
        message: "Day plan must be exactly 8 hours long" 
      });
    }

    // Get trainer's assigned trainees
    const trainer = await User.findById(trainerId).populate('assignedTrainees');
    if (!trainer) {
      return res.status(404).json({ message: "Trainer not found" });
    }

    // Validate assigned trainees
    const validTrainees = assignedTrainees.filter(traineeId => 
      trainer.assignedTrainees.some(t => t._id.toString() === traineeId)
    );

    const dayPlan = await DayPlan.create({
      title,
      description,
      date: new Date(date),
      startTime,
      endTime,
      duration,
      tasks: tasks || [],
      trainer: trainerId,
      assignedTrainees: validTrainees,
      notes: notes || ""
    });

    // Send notifications to assigned trainees
    for (const traineeId of validTrainees) {
      await Notification.create({
        recipient: traineeId,
        sender: trainerId,
        title: "New Day Plan Available",
        message: `You have a new day plan from ${trainer.name}: ${title}`,
        type: "day_plan",
        relatedEntity: {
          type: "day_plan",
          id: dayPlan._id
        },
        priority: "medium"
      });
    }

    res.status(201).json({
      message: "Day plan created successfully",
      dayPlan
    });

  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Get all day plans for a trainer or master trainer
// @route   GET /api/dayplans
// @access  Private (Trainer, Master Trainer)
const getDayPlans = async (req, res) => {
  try {
    const { role, stats, date, details } = req.query;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Handle master trainer requests
    if (role === 'master_trainer' || userRole === 'master_trainer') {
      if (stats === 'true') {
        // Return statistics for master trainer
        const totalPlans = await DayPlan.countDocuments({});
        const publishedPlans = await DayPlan.countDocuments({ status: 'published' });
        const completedPlans = await DayPlan.countDocuments({ status: 'completed' });
        const draftPlans = await DayPlan.countDocuments({ status: 'draft' });

        return res.json({
          success: true,
          totalPlans,
          published: publishedPlans,
          completed: completedPlans,
          draft: draftPlans
        });
      }

      if (details === 'true' && date) {
        // Return day plan details for specific date
        const dayPlans = await DayPlan.find({ 
          date: {
            $gte: new Date(date),
            $lt: new Date(new Date(date).getTime() + 24 * 60 * 60 * 1000)
          }
        })
        .populate('assignedTrainees', 'name email employeeId')
        .populate('trainer', 'name email');

        const formattedPlans = dayPlans.map(plan => ({
          id: plan._id,
          traineeName: plan.assignedTrainees.map(t => t.name).join(', '),
          traineeId: 'N/A',
          department: 'N/A',
          date: plan.date.toISOString().split('T')[0],
          status: plan.status,
          tasks: plan.tasks || [],
          submittedAt: plan.createdAt,
          approvedAt: plan.updatedAt,
          completedAt: plan.status === 'completed' ? plan.updatedAt : null
        }));

        return res.json({
          success: true,
          dayPlans: formattedPlans
        });
      }

      // Return all day plans for master trainer
      const dayPlans = await DayPlan.find({})
        .populate('assignedTrainees', 'name email employeeId')
        .populate('trainer', 'name email')
        .sort({ date: -1, createdAt: -1 });

      return res.json({
        success: true,
        dayPlans
      });
    }

    // Handle trainer requests (existing logic)
    const trainerId = userId;
    const { status, startDate, endDate, page = 1, limit = 20 } = req.query;

    let query = { trainer: trainerId };

    if (status) {
      query.status = status;
    }

    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const dayPlans = await DayPlan.find(query)
      .populate('assignedTrainees', 'name email employeeId')
      .sort({ date: -1, createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await DayPlan.countDocuments(query);

    res.json({
      dayPlans,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });

  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Get day plans for a trainee or trainer's assigned trainees
// @route   GET /api/dayplans/trainee/list (Trainee) or /api/dayplans/trainee/assigned (Trainer)
// @access  Private (Trainee, Trainer)
const getTraineeDayPlans = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    const { status, startDate, endDate, page = 1, limit = 20 } = req.query;

    let query = {};

    if (userRole === 'trainee') {
      // For trainees, get their assigned day plans
      query = { assignedTrainees: userId };
    } else if (userRole === 'trainer') {
      // For trainers, get day plans of their assigned trainees
      const trainer = await User.findById(userId).populate('assignedTrainees');
      if (!trainer) {
        return res.status(404).json({ message: "Trainer not found" });
      }
      
      const traineeIds = trainer.assignedTrainees.map(t => t._id);
      query = { assignedTrainees: { $in: traineeIds } };
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

    const dayPlans = await DayPlan.find(query)
      .populate('trainer', 'name email')
      .populate('assignedTrainees', 'name email employeeId')
      .sort({ date: -1, createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await DayPlan.countDocuments(query);

    res.json({
      dayPlans,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });

  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Get a specific day plan
// @route   GET /api/dayplans/:id
// @access  Private (Trainer, Trainee)
const getDayPlan = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    const dayPlan = await DayPlan.findById(id)
      .populate('trainer', 'name email')
      .populate('assignedTrainees', 'name email employeeId');

    if (!dayPlan) {
      return res.status(404).json({ message: "Day plan not found" });
    }

    // Check access permissions
    if (userRole === "trainee") {
      const hasAccess = dayPlan.assignedTrainees.some(t => t._id.toString() === userId);
      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }
    } else if (userRole === "trainer") {
      if (dayPlan.trainer._id.toString() !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }
    }

    res.json(dayPlan);

  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Update day plan
// @route   PUT /api/dayplans/:id
// @access  Private (Trainer)
const updateDayPlan = async (req, res) => {
  try {
    const { id } = req.params;
    const trainerId = req.user.id;
    const updateData = req.body;

    const dayPlan = await DayPlan.findById(id);
    if (!dayPlan) {
      return res.status(404).json({ message: "Day plan not found" });
    }

    if (dayPlan.trainer.toString() !== trainerId) {
      return res.status(403).json({ message: "Access denied" });
    }

    // If updating assigned trainees, send notifications
    if (updateData.assignedTrainees) {
      const trainer = await User.findById(trainerId);
      const newTrainees = updateData.assignedTrainees.filter(traineeId => 
        !dayPlan.assignedTrainees.includes(traineeId)
      );

      for (const traineeId of newTrainees) {
        await Notification.create({
          recipient: traineeId,
          sender: trainerId,
          title: "Day Plan Updated",
          message: `You have been assigned to day plan: ${dayPlan.title}`,
          type: "day_plan",
          relatedEntity: {
            type: "day_plan",
            id: dayPlan._id
          },
          priority: "medium"
        });
      }
    }

    const updatedDayPlan = await DayPlan.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate('assignedTrainees', 'name email employeeId');

    res.json({
      message: "Day plan updated successfully",
      dayPlan: updatedDayPlan
    });

  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Publish day plan
// @route   PUT /api/dayplans/:id/publish
// @access  Private (Trainer)
const publishDayPlan = async (req, res) => {
  try {
    const { id } = req.params;
    const trainerId = req.user.id;

    const dayPlan = await DayPlan.findById(id);
    if (!dayPlan) {
      return res.status(404).json({ message: "Day plan not found" });
    }

    if (dayPlan.trainer.toString() !== trainerId) {
      return res.status(403).json({ message: "Access denied" });
    }

    dayPlan.status = "published";
    dayPlan.publishedAt = new Date();
    await dayPlan.save();

    // Send notifications to trainees
    for (const traineeId of dayPlan.assignedTrainees) {
      await Notification.create({
        recipient: traineeId,
        sender: trainerId,
        title: "Day Plan Published",
        message: `Day plan "${dayPlan.title}" has been published and is now available`,
        type: "day_plan",
        relatedEntity: {
          type: "day_plan",
          id: dayPlan._id
        },
        priority: "high"
      });
    }

    res.json({
      message: "Day plan published successfully",
      dayPlan
    });

  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Update task status (for trainees)
// @route   PUT /api/dayplans/:id/tasks/:taskIndex
// @access  Private (Trainee)
const updateTaskStatus = async (req, res) => {
  try {
    const { id, taskIndex } = req.params;
    const traineeId = req.user.id;
    const { status } = req.body;

    const dayPlan = await DayPlan.findById(id);
    if (!dayPlan) {
      return res.status(404).json({ message: "Day plan not found" });
    }

    // Check if trainee has access
    const hasAccess = dayPlan.assignedTrainees.includes(traineeId);
    if (!hasAccess) {
      return res.status(403).json({ message: "Access denied" });
    }

    if (taskIndex >= dayPlan.tasks.length) {
      return res.status(400).json({ message: "Invalid task index" });
    }

    dayPlan.tasks[taskIndex].status = status;
    if (status === "completed") {
      dayPlan.tasks[taskIndex].completedAt = new Date();
    }

    await dayPlan.save();

    res.json({
      message: "Task status updated successfully",
      task: dayPlan.tasks[taskIndex]
    });

  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Delete day plan
// @route   DELETE /api/dayplans/:id
// @access  Private (Trainer)
const deleteDayPlan = async (req, res) => {
  try {
    const { id } = req.params;
    const trainerId = req.user.id;

    const dayPlan = await DayPlan.findById(id);
    if (!dayPlan) {
      return res.status(404).json({ message: "Day plan not found" });
    }

    if (dayPlan.trainer.toString() !== trainerId) {
      return res.status(403).json({ message: "Access denied" });
    }

    await DayPlan.findByIdAndDelete(id);

    res.json({ message: "Day plan deleted successfully" });

  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

module.exports = {
  createDayPlan,
  getDayPlans,
  getTraineeDayPlans,
  getDayPlan,
  updateDayPlan,
  publishDayPlan,
  updateTaskStatus,
  deleteDayPlan
};
