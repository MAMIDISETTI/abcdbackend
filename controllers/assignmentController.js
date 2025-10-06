const Assignment = require("../models/Assignment");
const User = require("../models/User");
const Notification = require("../models/Notification");

// @desc    Assign trainees to trainer
// @route   POST /api/assignments
// @access  Private (Master Trainer, BOA)
const createAssignment = async (req, res) => {
  try {
    const assignedById = req.user.id;
    const { trainerId, traineeIds, effectiveDate, notes, instructions } = req.body;
    // Validate trainer exists and is a trainer
    const trainer = await User.findOne({ author_id: trainerId });
    if (!trainer || trainer.role !== "trainer") {
      return res.status(400).json({ message: "Invalid trainer" });
    }

    // Validate trainees exist and are trainees
    const trainees = await User.find({
      author_id: { $in: traineeIds },
      role: "trainee",
      isActive: true
    });
    if (trainees.length !== traineeIds.length) {
      return res.status(400).json({ message: "Some trainees are invalid" });
    }

    // Check if trainer already has active assignments
    const existingAssignment = await Assignment.findOne({
      trainer: trainerId,
      status: "active"
    });

    let assignment;
    let allTraineeIds = traineeIds;

    if (existingAssignment) {
      // Update existing assignment with new trainees
      const currentTrainees = existingAssignment.trainees || [];
      allTraineeIds = [...new Set([...currentTrainees, ...traineeIds])]; // Remove duplicates
      
      assignment = await Assignment.findByIdAndUpdate(
        existingAssignment._id,
        {
          trainees: allTraineeIds,
          totalTrainees: allTraineeIds.length,
          activeTrainees: allTraineeIds.length,
          updatedAt: new Date(),
          updatedBy: assignedById
        },
        { new: true }
      );
    } else {
      // Create new assignment
      assignment = await Assignment.create({
        masterTrainer: assignedById,
        trainer: trainerId,
        trainees: traineeIds,
        assignmentDate: new Date(),
        effectiveDate: new Date(effectiveDate),
        totalTrainees: traineeIds.length,
        activeTrainees: traineeIds.length,
        notes: notes || "",
        instructions: instructions || "",
        createdBy: assignedById
      });
    }

    // Get trainee ObjectIds for the trainer's assignedTrainees field
    const traineeObjectsUser = await User.find({ author_id: { $in: allTraineeIds } }).select('_id');
    const traineeObjectIds = traineeObjectsUser.map(t => t._id);
    
    // Update trainer's assigned trainees with ObjectIds (search in both models)
    let trainerUpdateResult = await User.findOneAndUpdate({ author_id: trainerId }, {
      assignedTrainees: traineeObjectIds
    });

    // Get trainer ObjectId for trainees' assignedTrainer field
    let trainerObject = await User.findOne({ author_id: trainerId }).select('_id');
    
    if (!trainerObject) {
      return res.status(400).json({ message: "Trainer not found in database" });
    }
    
    // Update new trainees' assigned trainer (only the newly assigned ones) - update both models
    const update = { assignedTrainer: trainerObject._id, status: 'active' };
    await User.updateMany({ author_id: { $in: traineeIds } }, update);

    // Send notification to trainer
    const isUpdate = existingAssignment ? true : false;
    await Notification.create({
      recipientId: trainerObject._id.toString(),
      recipientRole: 'trainer',
      title: isUpdate ? "Trainee Assignment Updated" : "New Trainee Assignment",
      message: isUpdate 
        ? `Your assignment has been updated. You now have ${allTraineeIds.length} total trainees (${traineeIds.length} newly assigned)`
        : `You have been assigned ${traineeIds.length} trainees`,
      type: "assignment_created",
      relatedEntityType: "assignment",
      relatedEntityId: assignment._id.toString(),
      priority: "high"
    });

    // Send notifications to trainees
    for (const traineeId of traineeIds) {
      // Find the trainee ObjectId
      let traineeObject = await User.findOne({ author_id: traineeId }).select('_id');
      
      if (traineeObject) {
        await Notification.create({
          recipientId: traineeObject._id.toString(),
          recipientRole: 'trainee',
          title: "Trainer Assignment",
          message: `You have been assigned to trainer: ${trainer.name}`,
          type: "assignment_created",
          relatedEntityType: "assignment",
          relatedEntityId: assignment._id.toString(),
          priority: "medium"
        });
      }
    }

    res.status(201).json({
      message: isUpdate ? "Assignment updated successfully" : "Assignment created successfully",
      assignment,
      isUpdate,
      totalTrainees: allTraineeIds.length,
      newlyAssigned: traineeIds.length
    });

  } catch (error) {
    console.error('Error creating assignment:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Get all assignments (Master Trainer)
// @route   GET /api/assignments
// @access  Private (Master Trainer)
const getAssignments = async (req, res) => {
  try {
    const { status, page = 1, limit = 20, trainerId } = req.query;
    const assignedById = req.user.id;

    let query = {};
    
    // If trainerId is provided, filter by trainer
    if (trainerId) {
      query.trainer = trainerId;
    } else {
      // Otherwise, filter by masterTrainer (for master trainer's own assignments)
      query.masterTrainer = assignedById;
    }
    
    if (status) {
      query.status = status;
    }

    const assignments = await Assignment.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    // Manually populate user details using author_id
    const populatedAssignments = await Promise.all(assignments.map(async (assignment) => {
      const trainer = await User.findOne({ author_id: assignment.trainer }).select('name email author_id');
      const trainees = await User.find({ author_id: { $in: assignment.trainees } }).select('name email employeeId department author_id');
      const createdBy = await User.findOne({ author_id: assignment.createdBy }).select('name email author_id');
      
      return {
        ...assignment.toObject(),
        trainer: trainer,
        trainees: trainees,
        createdBy: createdBy
      };
    }));

    const total = await Assignment.countDocuments(query);

    res.json({
      assignments: populatedAssignments,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });

  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Get trainer's assignment
// @route   GET /api/assignments/trainer
// @access  Private (Trainer)
const getTrainerAssignment = async (req, res) => {
  try {
    const trainerId = req.user.id;
    // Get trainer with assigned trainees
    const trainer = await User.findById(trainerId)
      .populate('assignedTrainees', 'name email employeeId department genre lastClockIn lastClockOut')
      .select('name email assignedTrainees');
    
    if (!trainer) {
      return res.status(404).json({ message: "Trainer not found" });
    }

    // Return the trainer data with assigned trainees
    const response = {
      trainer: {
        _id: trainer._id,
        name: trainer.name,
        email: trainer.email
      },
      trainees: trainer.assignedTrainees || [],
      totalTrainees: trainer.assignedTrainees?.length || 0,
      activeTrainees: trainer.assignedTrainees?.length || 0
    };

    res.json(response);

  } catch (error) {
    console.error("=== GET TRAINER ASSIGNMENT ERROR ===");
    console.error("Error fetching trainer assignment:", error);
    console.error("Error stack:", error.stack);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Get trainee's assignment
// @route   GET /api/assignments/trainee
// @access  Private (Trainee)
const getTraineeAssignment = async (req, res) => {
  try {
    const traineeId = req.user.id;
    
    // Get trainee with assigned trainer
    const trainee = await User.findById(traineeId)
      .populate('assignedTrainer', 'name email')
      .select('name email assignedTrainer');
    
    if (!trainee) {
      return res.status(404).json({ message: "Trainee not found" });
    }

    // Return the trainee data with assigned trainer
    res.json({
      trainee: {
        _id: trainee._id,
        name: trainee.name,
        email: trainee.email
      },
      trainer: trainee.assignedTrainer,
      hasTrainer: !!trainee.assignedTrainer
    });

  } catch (error) {
    console.error("Error fetching trainee assignment:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Update assignment
// @route   PUT /api/assignments/:id
// @access  Private (Master Trainer)
const updateAssignment = async (req, res) => {
  try {
    const { id } = req.params;
    const assignedById = req.user.id;
    const updateData = req.body;

    const assignment = await Assignment.findById(id);
    if (!assignment) {
      return res.status(404).json({ message: "Assignment not found" });
    }

    if (assignment.masterTrainer.toString() !== assignedById) {
      return res.status(403).json({ message: "Access denied" });
    }

    // If updating trainees, update user assignments
    if (updateData.trainees) {
      const oldTrainees = assignment.trainees;
      const newTrainees = updateData.trainees;

      // Remove old assignments
      await User.updateMany(
        { _id: { $in: oldTrainees } },
        { assignedTrainer: null }
      );

      // Add new assignments
      await User.updateMany(
        { _id: { $in: newTrainees } },
        { assignedTrainer: assignment.trainer }
      );

      // Update trainer's assigned trainees
      await User.findByIdAndUpdate(assignment.trainer, {
        assignedTrainees: newTrainees
      });

      updateData.totalTrainees = newTrainees.length;
      updateData.activeTrainees = newTrainees.length;
    }

    updateData.modifiedBy = assignedById;
    updateData.modifiedAt = new Date();

    const updatedAssignment = await Assignment.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    )
    .populate('trainer', 'name email')
    .populate('trainees', 'name email employeeId department');

    res.json({
      message: "Assignment updated successfully",
      assignment: updatedAssignment
    });

  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Acknowledge assignment (Trainer)
// @route   PUT /api/assignments/:id/acknowledge
// @access  Private (Trainer)
const acknowledgeAssignment = async (req, res) => {
  try {
    const { id } = req.params;
    const trainerId = req.user.id;

    const assignment = await Assignment.findById(id);
    if (!assignment) {
      return res.status(404).json({ message: "Assignment not found" });
    }

    if (assignment.trainer.toString() !== trainerId) {
      return res.status(403).json({ message: "Access denied" });
    }

    assignment.isAcknowledged = true;
    assignment.acknowledgedAt = new Date();
    await assignment.save();

    res.json({
      message: "Assignment acknowledged successfully",
      assignment
    });

  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Complete assignment
// @route   PUT /api/assignments/:id/complete
// @access  Private (Master Trainer)
const completeAssignment = async (req, res) => {
  try {
    const { id } = req.params;
    const assignedById = req.user.id;
    const { endDate } = req.body;

    const assignment = await Assignment.findById(id);
    if (!assignment) {
      return res.status(404).json({ message: "Assignment not found" });
    }

    if (assignment.masterTrainer.toString() !== assignedById) {
      return res.status(403).json({ message: "Access denied" });
    }

    assignment.status = "completed";
    assignment.endDate = endDate ? new Date(endDate) : new Date();
    assignment.modifiedBy = assignedById;
    assignment.modifiedAt = new Date();

    // Remove assignments from users
    await User.updateMany(
      { _id: { $in: assignment.trainees } },
      { assignedTrainer: null }
    );

    await User.findByIdAndUpdate(assignment.trainer, {
      assignedTrainees: []
    });

    await assignment.save();

    res.json({
      message: "Assignment completed successfully",
      assignment
    });

  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Get available trainers
// @route   GET /api/assignments/trainers/available
// @access  Private (Master Trainer)
const getAvailableTrainers = async (req, res) => {
  try {
    const trainers = await User.find({
      role: "trainer",
      isActive: true,
      assignedTrainees: { $size: 0 } // No active assignments
    }).select('name email department');

    res.json(trainers);

  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Get unassigned trainees
// @route   GET /api/assignments/trainees/unassigned
// @access  Private (Master Trainer)
const getUnassignedTrainees = async (req, res) => {
  try {
    // Fetch from both schemas to avoid missing records
    const userTrainees = await User.find({
      role: "trainee",
      isActive: true,
      assignedTrainer: null
    }).select('name email employeeId department joiningDate author_id');

    // Return trainees from users only
    res.json(userTrainees);

  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// One-time sync: backfill users.assignedTrainer and trainer.assignedTrainees from Assignments
const syncAssignmentsToUsers = async (req, res) => {
  try {
    const active = await Assignment.find({ status: 'active' });
    let updatedTrainees = 0;
    let updatedTrainers = 0;

    for (const a of active) {
      const trainerDoc = await User.findOne({ author_id: a.trainer }).select('_id');
      if (!trainerDoc) continue;
      const traineeDocs = await User.find({ author_id: { $in: a.trainees } }).select('_id');
      const traineeIds = traineeDocs.map(t => t._id);
      if (traineeIds.length === 0) continue;

      const updT = await User.updateMany(
        { _id: { $in: traineeIds } },
        { $set: { assignedTrainer: trainerDoc._id, status: 'active' } }
      );
      updatedTrainees += updT.modifiedCount || 0;

      const updR = await User.updateOne(
        { _id: trainerDoc._id },
        { $addToSet: { assignedTrainees: { $each: traineeIds } } }
      );
      updatedTrainers += updR.modifiedCount || 0;
    }

    res.json({ success: true, updatedTrainees, updatedTrainers, totalAssignments: active.length });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Sync failed', error: error.message });
  }
};

module.exports = {
  createAssignment,
  getAssignments,
  getTrainerAssignment,
  getTraineeAssignment,
  updateAssignment,
  acknowledgeAssignment,
  completeAssignment,
  getAvailableTrainers,
  getUnassignedTrainees,
  syncAssignmentsToUsers
};
