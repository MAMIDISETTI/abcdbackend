const TraineeDayPlan = require("../models/TraineeDayPlan");
const User = require("../models/User");
const Notification = require("../models/Notification");

// @desc    Create a new trainee day plan submission
// @route   POST /api/trainee-dayplans
// @access  Private (Trainee)
const createTraineeDayPlan = async (req, res) => {
  try {
    console.log("=== CREATE TRAINEE DAY PLAN START ===");
    console.log("Request body:", req.body);
    console.log("User role:", req.user.role);
    console.log("User ID:", req.user.id);
    
    // Check if this is a trainer creating day plans for trainees
    const { traineeId, createdBy } = req.body;
    const actualTraineeId = traineeId || req.user.id;
    
    console.log("Trainee ID:", traineeId);
    console.log("Actual Trainee ID:", actualTraineeId);
    console.log("Created By:", createdBy);
    
    // If traineeId is provided, this means a trainer is creating the day plan
    // Otherwise, it's a trainee creating their own day plan
    if (traineeId && req.user.role !== 'trainer') {
      return res.status(403).json({ 
        message: "Only trainers can create day plans for other trainees" 
      });
    }

    const { date, tasks, checkboxes, status = "submitted" } = req.body;
    
    console.log("Extracted data:", { date, tasks, checkboxes, status });
    console.log("Date type:", typeof date, "Date value:", date);

    // Check if trainee already has a day plan for this date
    const existingPlan = await TraineeDayPlan.findOne({
      trainee: actualTraineeId,
      date: new Date(date)
    });

    console.log("Existing plan check:", existingPlan ? "Found existing plan" : "No existing plan");

    if (existingPlan) {
      console.log("=== EXISTING PLAN FOUND - RETURNING 400 ===");
      return res.status(400).json({ 
        message: "Day plan already exists for this date. Please update the existing plan instead." 
      });
    }

    // Create the trainee day plan
    const dayPlanData = {
      trainee: actualTraineeId,
      date: new Date(date),
      tasks: (tasks || []).map(task => ({
        ...task,
        id: task.id || `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` // Ensure task has ID
      })),
      checkboxes: checkboxes || {},
      status: status === "submitted" ? "in_progress" : status,
      submittedAt: status === "submitted" ? new Date() : null,
      createdBy: createdBy || "trainee" // Track who created the plan
    };
    
    console.log("Creating day plan with data:", dayPlanData);
    console.log("Checkboxes being saved:", {
      checkboxes: checkboxes,
      checkboxesType: typeof checkboxes,
      checkboxesKeys: Object.keys(checkboxes || {}),
      checkboxesStringified: JSON.stringify(checkboxes)
    });
    
    let traineeDayPlan;
    try {
      traineeDayPlan = await TraineeDayPlan.create(dayPlanData);
      console.log("Day plan created successfully:", traineeDayPlan._id);
    } catch (createError) {
      console.error("Error creating day plan:", createError);
      console.error("Create error details:", createError.message);
      return res.status(400).json({ 
        message: "Failed to create day plan", 
        error: createError.message 
      });
    }

    // Only send notification if status is submitted (not draft)
    if (status === "submitted") {
      try {
        // Get trainee's assigned trainer
        const trainee = await User.findById(actualTraineeId).select('assignedTrainer name');
        if (trainee && trainee.assignedTrainer) {
          // Send notification to trainer
          await Notification.create({
            recipient: trainee.assignedTrainer,
            sender: createdBy === "trainer" ? req.user.id : actualTraineeId,
            title: createdBy === "trainer" ? "Day Plan Assigned" : "New Day Plan Submission",
            message: createdBy === "trainer" 
              ? `A day plan has been assigned to you for ${trainee.name} on ${new Date(date).toLocaleDateString()}`
              : `${trainee.name} has submitted a day plan for ${new Date(date).toLocaleDateString()}`,
            type: "trainee_day_plan",
            relatedEntity: {
              type: "trainee_day_plan",
              id: traineeDayPlan._id
            },
            priority: "medium"
          });
        } else {
          console.log("No assigned trainer found for trainee");
        }
      } catch (notificationError) {
        console.error("Error creating notification:", notificationError);
        // Don't fail the entire request if notification fails
      }
    }

    res.status(201).json({
      message: status === "draft" ? "Day plan saved as draft" : "Day plan submitted successfully",
      dayPlan: traineeDayPlan
    });

  } catch (error) {
    console.error("Error creating trainee day plan:", error);
    console.error("Error stack:", error.stack);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Get trainee's day plan submissions
// @route   GET /api/trainee-dayplans
// @access  Private (Trainee, Trainer)
const getTraineeDayPlans = async (req, res) => {
  try {
    const { status, startDate, endDate, page = 1, limit = 20, traineeId } = req.query;
    
    let query = {};
    
    // If user is a trainee, only show their own day plans
    if (req.user.role === 'trainee') {
      query.trainee = req.user.id;
    } 
    // If user is a trainer, show day plans of their assigned trainees
    else if (req.user.role === 'trainer') {
      // Get trainer's assigned trainees
      const trainer = await User.findById(req.user.id).populate('assignedTrainees', '_id');
      if (trainer && trainer.assignedTrainees && trainer.assignedTrainees.length > 0) {
        const traineeIds = trainer.assignedTrainees.map(t => t._id);
        query.trainee = { $in: traineeIds };
      } else {
        // If trainer has no assigned trainees, return empty result
        return res.json({ 
          success: true, 
          dayPlans: [], 
          total: 0, 
          page: parseInt(page), 
          totalPages: 0 
        });
      }
    }
    // If specific traineeId is provided (for trainer viewing specific trainee)
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

    const dayPlans = await TraineeDayPlan.find(query)
      .populate('trainee', 'name email employeeId')
      .sort({ date: -1, submittedAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    // Debug: Log checkbox data for each plan
    console.log('=== TRAINEE DAY PLANS DEBUG ===');
    dayPlans.forEach((plan, index) => {
      console.log(`Plan ${index} (${plan._id}):`, {
        trainee: plan.trainee?.name,
        date: plan.date,
        checkboxes: plan.checkboxes,
        checkboxesType: typeof plan.checkboxes,
        checkboxesKeys: Object.keys(plan.checkboxes || {}),
        tasks: plan.tasks?.map(task => ({ title: task.title, id: task._id }))
      });
    });
    console.log('=== END TRAINEE DAY PLANS DEBUG ===');

    const total = await TraineeDayPlan.countDocuments(query);

    res.json({
      success: true,
      dayPlans,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });

  } catch (error) {
    console.error("Error fetching trainee day plans:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Get a specific trainee day plan
// @route   GET /api/trainee-dayplans/:id
// @access  Private (Trainee, Trainer)
const getTraineeDayPlan = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    const dayPlan = await TraineeDayPlan.findById(id)
      .populate('trainee', 'name email employeeId')
      .populate('reviewedBy', 'name email')
      .populate('approvedBy', 'name email');

    if (!dayPlan) {
      return res.status(404).json({ message: "Day plan not found" });
    }

    // Check access permissions
    if (userRole === "trainee") {
      if (dayPlan.trainee._id.toString() !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }
    } else if (userRole === "trainer") {
      // Check if this trainer is assigned to the trainee
      const trainee = await User.findById(dayPlan.trainee._id).select('assignedTrainer');
      if (!trainee || trainee.assignedTrainer.toString() !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }
    }

    res.json(dayPlan);

  } catch (error) {
    console.error("Error fetching trainee day plan:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Update trainee day plan (only if draft)
// @route   PUT /api/trainee-dayplans/:id
// @access  Private (Trainee)
const updateTraineeDayPlan = async (req, res) => {
  try {
    const { id } = req.params;
    const traineeId = req.user.id;
    const { tasks, checkboxes } = req.body;

    const dayPlan = await TraineeDayPlan.findById(id);
    if (!dayPlan) {
      return res.status(404).json({ message: "Day plan not found" });
    }

    if (dayPlan.trainee.toString() !== traineeId) {
      return res.status(403).json({ message: "Access denied" });
    }

    if (dayPlan.status !== "draft" && dayPlan.status !== "in_progress") {
      return res.status(400).json({ 
        message: "Cannot update day plan. Only draft or in_progress day plans can be updated." 
      });
    }

    const updatedDayPlan = await TraineeDayPlan.findByIdAndUpdate(
      id,
      { 
        tasks: tasks || dayPlan.tasks,
        checkboxes: checkboxes || dayPlan.checkboxes
      },
      { new: true, runValidators: true }
    );

    res.json({
      message: "Day plan updated successfully",
      dayPlan: updatedDayPlan
    });

  } catch (error) {
    console.error("Error updating trainee day plan:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Submit trainee day plan (draft to submitted)
// @route   PUT /api/trainee-dayplans/:id/submit
// @access  Private (Trainee)
const submitTraineeDayPlan = async (req, res) => {
  try {
    const { id } = req.params;
    const traineeId = req.user.id;

    const dayPlan = await TraineeDayPlan.findById(id);
    if (!dayPlan) {
      return res.status(404).json({ message: "Day plan not found" });
    }

    if (dayPlan.trainee.toString() !== traineeId) {
      return res.status(403).json({ message: "Access denied" });
    }

    if (dayPlan.status !== "draft") {
      return res.status(400).json({ 
        message: "Day plan is already submitted" 
      });
    }

    // Validate required fields
    const hasEmptyTasks = dayPlan.tasks.some(task => 
      !task.title.trim() || !task.timeAllocation || !task.description.trim()
    );

    if (hasEmptyTasks) {
      return res.status(400).json({ 
        message: "Please fill in all task details before submitting" 
      });
    }

    dayPlan.status = "submitted";
    dayPlan.submittedAt = new Date();
    await dayPlan.save();

    // Get trainee's assigned trainer
    const trainee = await User.findById(traineeId).select('assignedTrainer name');
    if (trainee && trainee.assignedTrainer) {
      // Send notification to trainer
      await Notification.create({
        recipient: trainee.assignedTrainer,
        sender: traineeId,
        title: "Day Plan Submitted",
        message: `${trainee.name} has submitted a day plan for ${dayPlan.date.toLocaleDateString()}`,
        type: "trainee_day_plan",
        relatedEntity: {
          type: "trainee_day_plan",
          id: dayPlan._id
        },
        priority: "medium"
      });
    }

    res.json({
      message: "Day plan submitted successfully",
      dayPlan
    });

  } catch (error) {
    console.error("Error submitting trainee day plan:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Review trainee day plan (for trainers)
// @route   PUT /api/trainee-dayplans/:id/review
// @access  Private (Trainer)
const reviewTraineeDayPlan = async (req, res) => {
  try {
    console.log("=== REVIEW TRAINEE DAY PLAN START ===");
    const { id } = req.params;
    const trainerId = req.user.id;
    const { status, reviewComments } = req.body;

    console.log("Review request:", { id, trainerId, status, reviewComments });

    const dayPlan = await TraineeDayPlan.findById(id).populate('trainee', 'assignedTrainer');
    if (!dayPlan) {
      console.log("Day plan not found");
      return res.status(404).json({ message: "Day plan not found" });
    }

    console.log("Day plan found:", dayPlan._id);
    console.log("Trainee assigned trainer:", dayPlan.trainee.assignedTrainer);
    console.log("Current trainer ID:", trainerId);
    console.log("Are they equal?", dayPlan.trainee.assignedTrainer?.toString() === trainerId);

    // Check if this trainer is assigned to the trainee
    if (dayPlan.trainee.assignedTrainer?.toString() !== trainerId) {
      console.log("Access denied - trainer not assigned to trainee");
      return res.status(403).json({ message: "Access denied" });
    }

    console.log("Status validation:", { status, validStatuses: ["approved", "rejected"] });
    if (!["approved", "rejected"].includes(status)) {
      console.log("Invalid status provided");
      return res.status(400).json({ 
        message: "Invalid status. Must be 'approved' or 'rejected'" 
      });
    }

    console.log("Day plan status:", dayPlan.status);
    if (dayPlan.status !== "in_progress") {
      console.log("Day plan status is not 'in_progress'");
      return res.status(400).json({ 
        message: "Only day plans with 'in_progress' status can be reviewed" 
      });
    }

    dayPlan.status = status === "approved" ? "completed" : "rejected";
    dayPlan.reviewedBy = trainerId;
    dayPlan.reviewedAt = new Date();
    dayPlan.reviewComments = reviewComments || "";

    if (status === "approved") {
      dayPlan.approvedBy = trainerId;
      dayPlan.approvedAt = new Date();
    }

    await dayPlan.save();

    // Send notification to trainee
    await Notification.create({
      recipient: dayPlan.trainee._id,
      sender: trainerId,
      title: `Day Plan ${status.charAt(0).toUpperCase() + status.slice(1)}`,
      message: `Your day plan for ${dayPlan.date.toLocaleDateString()} has been ${status}`,
      type: "trainee_day_plan",
      relatedEntity: {
        type: "trainee_day_plan",
        id: dayPlan._id
      },
      priority: "medium"
    });

    res.json({
      message: `Day plan ${status} successfully`,
      dayPlan
    });

  } catch (error) {
    console.error("=== REVIEW TRAINEE DAY PLAN ERROR ===");
    console.error("Error reviewing trainee day plan:", error);
    console.error("Error details:", error.message);
    console.error("Error stack:", error.stack);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Delete trainee day plan (only if draft)
// @route   DELETE /api/trainee-dayplans/:id
// @access  Private (Trainee)
const deleteTraineeDayPlan = async (req, res) => {
  try {
    const { id } = req.params;
    const traineeId = req.user.id;

    const dayPlan = await TraineeDayPlan.findById(id);
    if (!dayPlan) {
      return res.status(404).json({ message: "Day plan not found" });
    }

    if (dayPlan.trainee.toString() !== traineeId) {
      return res.status(403).json({ message: "Access denied" });
    }

    if (dayPlan.status !== "draft") {
      return res.status(400).json({ 
        message: "Cannot delete submitted day plan" 
      });
    }

    await TraineeDayPlan.findByIdAndDelete(id);

    res.json({ message: "Day plan deleted successfully" });

  } catch (error) {
    console.error("Error deleting trainee day plan:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Test endpoint to check day plans
// @route   GET /api/trainee-dayplans/test
// @access  Private (Trainee)
const testDayPlans = async (req, res) => {
  try {
    const traineeId = req.user.id;
    console.log("Testing day plans for trainee:", traineeId);
    
    const dayPlans = await TraineeDayPlan.find({ trainee: traineeId }).sort({ date: -1 }).limit(5);
    console.log("Found day plans:", dayPlans);
    
    res.json({
      message: "Test successful",
      count: dayPlans.length,
      dayPlans: dayPlans
    });
  } catch (error) {
    console.error("Test error:", error);
    res.status(500).json({ message: "Test failed", error: error.message });
  }
};

// @desc    Submit EOD (End of Day) update for tasks
// @route   POST /api/trainee-dayplans/eod-update
// @access  Private (Trainee)
const submitEodUpdate = async (req, res) => {
  try {
    console.log("=== EOD UPDATE START ===");
    console.log("Request body:", JSON.stringify(req.body, null, 2));
    console.log("User ID:", req.user.id);
    
    const traineeId = req.user.id;
    const { date, tasks, overallRemarks } = req.body;
    
    console.log("Parsed data:");
    console.log("- Date:", date);
    console.log("- Tasks:", tasks);
    console.log("- Overall Remarks:", overallRemarks);

    // Find today's day plan
    const dayPlan = await TraineeDayPlan.findOne({
      trainee: traineeId,
      date: new Date(date)
    });

    if (!dayPlan) {
      return res.status(404).json({ 
        message: "No day plan found for today. Please submit a day plan first." 
      });
    }

    console.log("Found day plan:", dayPlan);
    console.log("Tasks to update:", tasks);

    // Update task statuses and remarks using direct assignment
    tasks.forEach(taskUpdate => {
      const taskIndex = taskUpdate.taskIndex;
      if (dayPlan.tasks[taskIndex]) {
        dayPlan.tasks[taskIndex].status = taskUpdate.status;
        dayPlan.tasks[taskIndex].remarks = taskUpdate.remarks || '';
        dayPlan.tasks[taskIndex].updatedAt = new Date();
        console.log(`Updated task ${taskIndex}:`, dayPlan.tasks[taskIndex]);
      }
    });

    // Set EOD update details and change status to under_review
    dayPlan.eodUpdate = {
      submittedAt: new Date(),
      overallRemarks: overallRemarks || '',
      status: 'submitted'
    };
    
    // Change day plan status to pending
    dayPlan.status = 'pending';
    
    console.log("Saving day plan with EOD update:", dayPlan);
    const savedDayPlan = await dayPlan.save();
    console.log("Day plan saved successfully:", savedDayPlan);

    // Send notification to trainer
    try {
      const trainee = await User.findById(traineeId).select('assignedTrainer name');
      if (trainee && trainee.assignedTrainer) {
        await Notification.create({
          recipient: trainee.assignedTrainer,
          sender: traineeId,
          title: "EOD Update Received",
          message: `${trainee.name} has submitted their end-of-day update for ${new Date(date).toLocaleDateString()}`,
          type: "trainee_day_plan",
          relatedEntity: {
            type: "trainee_day_plan",
            id: dayPlan._id
          },
          priority: "medium"
        });
      }
    } catch (notificationError) {
      console.error("Error creating EOD notification:", notificationError);
      // Don't fail the request if notification fails
    }

    // Fetch the updated day plan to verify data was saved
    const updatedDayPlan = await TraineeDayPlan.findById(dayPlan._id);
    console.log("Retrieved updated day plan:", updatedDayPlan);

    res.json({
      message: "EOD update submitted successfully",
      dayPlan: updatedDayPlan
    });

  } catch (error) {
    console.error("Error submitting EOD update:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Review EOD update (for trainers)
// @route   PUT /api/trainee-dayplans/:id/eod-review
// @access  Private (Trainer)
const reviewEodUpdate = async (req, res) => {
  try {
    console.log("=== EOD REVIEW START ===");
    const { id } = req.params;
    const trainerId = req.user.id;
    const { status, reviewComments } = req.body;

    console.log("EOD Review request:", { id, trainerId, status, reviewComments });

    const dayPlan = await TraineeDayPlan.findById(id).populate('trainee', 'assignedTrainer name');
    if (!dayPlan) {
      console.log("Day plan not found");
      return res.status(404).json({ message: "Day plan not found" });
    }

    console.log("Day plan found:", dayPlan._id);
    console.log("Day plan status:", dayPlan.status);
    console.log("EOD update status:", dayPlan.eodUpdate?.status);

    // Check if this trainer is assigned to the trainee
    if (dayPlan.trainee.assignedTrainer?.toString() !== trainerId) {
      console.log("Access denied - trainer not assigned to trainee");
      return res.status(403).json({ message: "Access denied" });
    }

    // Check if day plan is pending
    if (dayPlan.status !== 'pending') {
      console.log("Day plan is not pending");
      return res.status(400).json({ 
        message: "Only day plans with pending EOD updates can be reviewed" 
      });
    }

    // Validate status
    if (!["approved", "rejected"].includes(status)) {
      console.log("Invalid status provided");
      return res.status(400).json({ 
        message: "Invalid status. Must be 'approved' or 'rejected'" 
      });
    }

    // Update EOD review details
    dayPlan.eodUpdate.reviewedAt = new Date();
    dayPlan.eodUpdate.reviewedBy = trainerId;
    dayPlan.eodUpdate.reviewComments = reviewComments || '';
    dayPlan.eodUpdate.status = status;

    // Update day plan status based on review
    if (status === 'approved') {
      dayPlan.status = 'completed';
    } else {
      dayPlan.status = 'rejected';
    }

    console.log("Saving day plan with EOD review:", dayPlan);
    await dayPlan.save();

    // Send notification to trainee
    await Notification.create({
      recipient: dayPlan.trainee._id,
      sender: trainerId,
      title: `EOD Update ${status.charAt(0).toUpperCase() + status.slice(1)}`,
      message: `Your end-of-day update for ${dayPlan.date.toLocaleDateString()} has been ${status}`,
      type: "trainee_day_plan",
      relatedEntity: {
        type: "trainee_day_plan",
        id: dayPlan._id
      },
      priority: "medium"
    });

    console.log("EOD review completed successfully");
    res.json({
      message: `EOD update ${status} successfully`,
      dayPlan
    });

  } catch (error) {
    console.error("=== EOD REVIEW ERROR ===");
    console.error("Error reviewing EOD update:", error);
    console.error("Error details:", error.message);
    console.error("Error stack:", error.stack);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

module.exports = {
  createTraineeDayPlan,
  getTraineeDayPlans,
  getTraineeDayPlan,
  updateTraineeDayPlan,
  submitTraineeDayPlan,
  reviewTraineeDayPlan,
  deleteTraineeDayPlan,
  submitEodUpdate,
  reviewEodUpdate,
  testDayPlans
};
