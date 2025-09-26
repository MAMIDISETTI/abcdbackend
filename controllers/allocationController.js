const Allocation = require('../models/Allocation');
const User = require('../models/User');
const Campus = require('../models/Campus');

// @desc    Create a new campus allocation
// @route   POST /api/allocation
// @access  Private (Master Trainer, BOA)
const createAllocation = async (req, res) => {
  try {
    const { traineeId, campusId, allocatedDate, status = 'confirmed', notes } = req.body;
    const allocatedBy = req.user.id;

    // Validate trainee exists
    const trainee = await User.findOne({ 
      $or: [
        { _id: traineeId },
        { author_id: traineeId }
      ],
      role: 'trainee'
    });

    if (!trainee) {
      return res.status(400).json({
        success: false,
        message: 'Trainee not found'
      });
    }

    // Validate campus exists
    const campus = await Campus.findOne({ 
      $or: [
        { _id: campusId },
        { name: campusId }
      ]
    });

    if (!campus) {
      return res.status(400).json({
        success: false,
        message: 'Campus not found'
      });
    }

    // Check if trainee already has an active allocation
    const existingAllocation = await Allocation.findOne({
      traineeId: trainee.author_id || trainee._id.toString(),
      status: { $in: ['confirmed', 'pending'] }
    });

    if (existingAllocation) {
      return res.status(400).json({
        success: false,
        message: 'Trainee already has an active campus allocation'
      });
    }

    const traineeIdToStore = trainee.author_id || trainee._id.toString();
    console.log('Creating allocation with traineeId:', traineeIdToStore, 'for trainee:', trainee.name);
    
    const allocation = await Allocation.create({
      traineeId: traineeIdToStore,
      campusId: campus._id.toString(),
      campusName: campus.name,
      allocatedDate: new Date(allocatedDate),
      status,
      notes,
      allocatedBy
    });
    
    console.log('Allocation created successfully:', allocation);

    res.status(201).json({
      success: true,
      message: 'Campus allocation created successfully',
      allocation
    });

  } catch (error) {
    console.error('Error creating allocation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create allocation',
      error: error.message
    });
  }
};

// @desc    Get all allocations
// @route   GET /api/allocation
// @access  Private (Master Trainer, BOA, Trainer, Trainee)
const getAllocations = async (req, res) => {
  try {
    const { status, page = 1, limit = 20, traineeId, campusId } = req.query;
    const userId = req.user.id;
    const userRole = req.user.role;

    let query = {};

    // Filter by status if provided
    if (status) {
      query.status = status;
    }

    // Security check: If user is a trainee, they can only view their own allocations
    if (userRole === 'trainee') {
      // Get the trainee's author_id to match with stored allocations
      const trainee = await User.findById(userId).select('author_id');
      const authorId = trainee?.author_id;
      
      console.log('Trainee accessing allocations - userId:', userId, 'traineeId:', traineeId, 'authorId:', authorId);
      
      // Query for both the trainee's _id and author_id to match any stored allocations
      query.$or = [
        { traineeId: userId }, // Match by _id (ObjectId)
        { traineeId: userId.toString() }, // Match by _id as string
        { traineeId: authorId }, // Match by author_id (UUID)
        { traineeId: traineeId }, // Match by provided traineeId
        { traineeId: traineeId?.toString() } // Match by provided traineeId as string
      ].filter(Boolean); // Remove undefined values
      
      console.log('Trainee query:', query);
    } else if (traineeId) {
      // For non-trainees, filter by traineeId if provided
      query.$or = [
        { traineeId: traineeId },
        { traineeId: traineeId.toString() }
      ];
    }

    // Filter by campus if provided
    if (campusId) {
      query.campusId = campusId;
    }

    console.log('Final query for allocations:', JSON.stringify(query, null, 2));
    
    // First, let's see all allocations in the database for debugging
    const allAllocations = await Allocation.find({}).limit(5);
    console.log('All allocations in database (first 5):', allAllocations.map(a => ({ id: a._id, traineeId: a.traineeId, campusName: a.campusName })));
    
    const allocations = await Allocation.find(query)
      .populate('allocatedBy', 'name email')
      .populate('updatedBy', 'name email')
      .sort({ allocatedDate: -1, createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    console.log('Found allocations:', allocations.length);

    // Get trainee details for each allocation
    const allocationsWithTrainees = await Promise.all(allocations.map(async (allocation) => {
      const trainee = await User.findById(allocation.traineeId).select('name email employeeId department');
      return {
        ...allocation.toObject(),
        traineeName: trainee?.name || 'Unknown',
        traineeEmail: trainee?.email || '',
        traineeEmployeeId: trainee?.employeeId || '',
        traineeDepartment: trainee?.department || ''
      };
    }));

    const total = await Allocation.countDocuments(query);

    res.json({
      success: true,
      allocations: allocationsWithTrainees,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });

  } catch (error) {
    console.error('Error fetching allocations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch allocations',
      error: error.message
    });
  }
};

// @desc    Get allocation by ID
// @route   GET /api/allocation/:id
// @access  Private (Master Trainer, BOA, Trainer)
const getAllocationById = async (req, res) => {
  try {
    const allocation = await Allocation.findById(req.params.id)
      .populate('allocatedBy', 'name email')
      .populate('updatedBy', 'name email');

    if (!allocation) {
      return res.status(404).json({
        success: false,
        message: 'Allocation not found'
      });
    }

    // Get trainee details
    const trainee = await User.findById(allocation.traineeId).select('name email employeeId department');
    const allocationWithTrainee = {
      ...allocation.toObject(),
      traineeName: trainee?.name || 'Unknown',
      traineeEmail: trainee?.email || '',
      traineeEmployeeId: trainee?.employeeId || '',
      traineeDepartment: trainee?.department || ''
    };

    res.json({
      success: true,
      allocation: allocationWithTrainee
    });

  } catch (error) {
    console.error('Error fetching allocation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch allocation',
      error: error.message
    });
  }
};

// @desc    Update allocation
// @route   PUT /api/allocation/:id
// @access  Private (Master Trainer, BOA)
const updateAllocation = async (req, res) => {
  try {
    const { status, notes, deploymentDate } = req.body;
    const updatedBy = req.user.id;

    const allocation = await Allocation.findById(req.params.id);

    if (!allocation) {
      return res.status(404).json({
        success: false,
        message: 'Allocation not found'
      });
    }

    const updateData = {
      ...(status && { status }),
      ...(notes !== undefined && { notes }),
      ...(deploymentDate && { deploymentDate: new Date(deploymentDate) }),
      updatedBy
    };

    const updatedAllocation = await Allocation.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).populate('allocatedBy', 'name email')
     .populate('updatedBy', 'name email');

    res.json({
      success: true,
      message: 'Allocation updated successfully',
      allocation: updatedAllocation
    });

  } catch (error) {
    console.error('Error updating allocation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update allocation',
      error: error.message
    });
  }
};

// @desc    Delete allocation
// @route   DELETE /api/allocation/:id
// @access  Private (Master Trainer, BOA)
const deleteAllocation = async (req, res) => {
  try {
    const allocation = await Allocation.findById(req.params.id);

    if (!allocation) {
      return res.status(404).json({
        success: false,
        message: 'Allocation not found'
      });
    }

    await Allocation.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Allocation deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting allocation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete allocation',
      error: error.message
    });
  }
};

// @desc    Debug endpoint to check all allocations
// @route   GET /api/allocation/debug
// @access  Private (Master Trainer, BOA)
const debugAllocations = async (req, res) => {
  try {
    const allAllocations = await Allocation.find({}).limit(10);
    const traineeCount = await User.countDocuments({ role: 'trainee' });
    const campusCount = await Campus.countDocuments({});
    
    res.json({
      success: true,
      totalAllocations: allAllocations.length,
      traineeCount,
      campusCount,
      allocations: allAllocations.map(alloc => ({
        id: alloc._id,
        traineeId: alloc.traineeId,
        campusName: alloc.campusName,
        status: alloc.status,
        allocatedDate: alloc.allocatedDate
      }))
    });
  } catch (error) {
    console.error('Debug allocations error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to debug allocations',
      error: error.message
    });
  }
};

module.exports = {
  createAllocation,
  getAllocations,
  getAllocationById,
  updateAllocation,
  deleteAllocation,
  debugAllocations
};
