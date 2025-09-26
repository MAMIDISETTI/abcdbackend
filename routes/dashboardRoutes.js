const express = require("express");
const router = express.Router();
const { protect, masterTrainerOnly, trainerOnly, traineeOnly } = require("../middlewares/authMiddleware");
const {
  getMasterTrainerDashboard,
  getTrainerDashboard,
  getTraineeDashboard
} = require("../controllers/dashboardController");

// Dashboard routes
router.get("/master-trainer", protect, masterTrainerOnly, getMasterTrainerDashboard);
router.get("/trainer", protect, trainerOnly, getTrainerDashboard);
router.get("/trainee", protect, traineeOnly, getTraineeDashboard);

module.exports = router;
