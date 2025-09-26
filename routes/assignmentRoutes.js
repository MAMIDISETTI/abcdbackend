const express = require("express");
const router = express.Router();
const { protect, masterTrainerOnly, trainerOnly, traineeOnly, requireRoles } = require("../middlewares/authMiddleware");
const {
  createAssignment,
  getAssignments,
  getTrainerAssignment,
  getTraineeAssignment,
  updateAssignment,
  acknowledgeAssignment,
  completeAssignment,
  getAvailableTrainers,
  getUnassignedTrainees
} = require("../controllers/assignmentController");

// Master Trainer and BOA routes
router.post("/", protect, requireRoles(["master_trainer", "boa"]), createAssignment);
router.get("/", protect, requireRoles(["master_trainer", "boa"]), getAssignments);
router.get("/trainers/available", protect, requireRoles(["master_trainer", "boa"]), getAvailableTrainers);
router.get("/trainees/unassigned", protect, requireRoles(["master_trainer", "boa"]), getUnassignedTrainees);
router.put("/:id", protect, requireRoles(["master_trainer", "boa"]), updateAssignment);
router.put("/:id/complete", protect, requireRoles(["master_trainer", "boa"]), completeAssignment);

// Trainer routes
router.get("/trainer", protect, trainerOnly, getTrainerAssignment);
router.put("/:id/acknowledge", protect, trainerOnly, acknowledgeAssignment);

// Trainee routes
router.get("/trainee", protect, traineeOnly, getTraineeAssignment);

module.exports = router;
