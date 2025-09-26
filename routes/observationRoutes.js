const express = require("express");
const router = express.Router();
const { protect, masterTrainerOnly, trainerOnly, traineeOnly, requireRoles } = require("../middlewares/authMiddleware");
const {
  createObservation,
  getObservations,
  getMasterTrainerObservations,
  getTraineeObservations,
  getObservation,
  updateObservation,
  submitObservation,
  reviewObservation,
  getObservationStats
} = require("../controllers/observationController");

// Trainer routes
router.post("/", protect, trainerOnly, createObservation);
router.get("/", protect, trainerOnly, getObservations);
router.get("/stats", protect, trainerOnly, getObservationStats);
router.get("/:id", protect, requireRoles(["trainer", "trainee", "master_trainer"]), getObservation);
router.put("/:id", protect, trainerOnly, updateObservation);
router.put("/:id/submit", protect, trainerOnly, submitObservation);

// Master Trainer routes
router.get("/master-trainer/list", protect, masterTrainerOnly, getMasterTrainerObservations);
router.put("/:id/review", protect, masterTrainerOnly, reviewObservation);

// Trainee routes
router.get("/trainee/list", protect, traineeOnly, getTraineeObservations);

module.exports = router;
