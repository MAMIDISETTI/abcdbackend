const Campus = require('../models/Campus');
const User = require('../models/User');

// @desc    Create a new campus
// @route   POST /api/campus
// @access  Private (Master Trainer, BOA)
const createCampus = async (req, res) => {
  try {
    const { name, location, capacity, description, facilities, contactPerson } = req.body;
    const createdBy = req.user.id;

    // Check if campus with same name already exists
    const existingCampus = await Campus.findOne({ 
      name: { $regex: new RegExp(`^${name}$`, 'i') },
      location: { $regex: new RegExp(`^${location}$`, 'i') }
    });

    if (existingCampus) {
      return res.status(400).json({
        success: false,
        message: 'Campus with this name and location already exists'
      });
    }

    const campus = await Campus.create({
      name,
      location,
      capacity,
      description,
      facilities: facilities || [],
      contactPerson: contactPerson || {},
      createdBy
    });

    res.status(201).json({
      success: true,
      message: 'Campus created successfully',
      campus
    });

  } catch (error) {
    console.error('Error creating campus:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create campus',
      error: error.message
    });
  }
};

// @desc    Get all campuses
// @route   GET /api/campus
// @access  Private (Master Trainer, BOA, Trainer)
const getCampuses = async (req, res) => {
  try {
    const { status, page = 1, limit = 20, search } = req.query;
    const userId = req.user.id;
    const userRole = req.user.role;

    let query = {};

    // Filter by status if provided
    if (status) {
      query.status = status;
    }

    // Search functionality
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { location: { $regex: search, $options: 'i' } }
      ];
    }

    const campuses = await Campus.find(query)
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Campus.countDocuments(query);

    res.json({
      success: true,
      campuses,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });

  } catch (error) {
    console.error('Error fetching campuses:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch campuses',
      error: error.message
    });
  }
};

// @desc    Get campus by ID
// @route   GET /api/campus/:id
// @access  Private (Master Trainer, BOA, Trainer)
const getCampusById = async (req, res) => {
  try {
    const campus = await Campus.findById(req.params.id)
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email');

    if (!campus) {
      return res.status(404).json({
        success: false,
        message: 'Campus not found'
      });
    }

    res.json({
      success: true,
      campus
    });

  } catch (error) {
    console.error('Error fetching campus:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch campus',
      error: error.message
    });
  }
};

// @desc    Update campus
// @route   PUT /api/campus/:id
// @access  Private (Master Trainer, BOA)
const updateCampus = async (req, res) => {
  try {
    const { name, location, capacity, description, facilities, contactPerson, status } = req.body;
    const updatedBy = req.user.id;

    const campus = await Campus.findById(req.params.id);

    if (!campus) {
      return res.status(404).json({
        success: false,
        message: 'Campus not found'
      });
    }

    // Check if campus with same name and location already exists (excluding current campus)
    if (name && location) {
      const existingCampus = await Campus.findOne({ 
        _id: { $ne: req.params.id },
        name: { $regex: new RegExp(`^${name}$`, 'i') },
        location: { $regex: new RegExp(`^${location}$`, 'i') }
      });

      if (existingCampus) {
        return res.status(400).json({
          success: false,
          message: 'Campus with this name and location already exists'
        });
      }
    }

    const updateData = {
      ...(name && { name }),
      ...(location && { location }),
      ...(capacity && { capacity }),
      ...(description !== undefined && { description }),
      ...(facilities && { facilities }),
      ...(contactPerson && { contactPerson }),
      ...(status && { status }),
      updatedBy
    };

    const updatedCampus = await Campus.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).populate('createdBy', 'name email')
     .populate('updatedBy', 'name email');

    res.json({
      success: true,
      message: 'Campus updated successfully',
      campus: updatedCampus
    });

  } catch (error) {
    console.error('Error updating campus:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update campus',
      error: error.message
    });
  }
};

// @desc    Delete campus
// @route   DELETE /api/campus/:id
// @access  Private (Master Trainer, BOA)
const deleteCampus = async (req, res) => {
  try {
    const campus = await Campus.findById(req.params.id);

    if (!campus) {
      return res.status(404).json({
        success: false,
        message: 'Campus not found'
      });
    }

    // Check if campus has any allocations (you might want to add this check)
    // const allocations = await Allocation.find({ campusId: req.params.id });
    // if (allocations.length > 0) {
    //   return res.status(400).json({
    //     success: false,
    //     message: 'Cannot delete campus with active allocations'
    //   });
    // }

    await Campus.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Campus deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting campus:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete campus',
      error: error.message
    });
  }
};

module.exports = {
  createCampus,
  getCampuses,
  getCampusById,
  updateCampus,
  deleteCampus
};
