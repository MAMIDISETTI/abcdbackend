const express = require("express");
const router = express.Router();
const { protect, trainerOnly, traineeOnly, requireRoles } = require("../middlewares/authMiddleware");
const {
  createDayPlan,
  getDayPlans,
  getTraineeDayPlans,
  getDayPlan,
  updateDayPlan,
  publishDayPlan,
  updateTaskStatus,
  deleteDayPlan
} = require("../controllers/dayPlanController");

// Trainer and Master Trainer routes
router.post("/", protect, trainerOnly, createDayPlan);
router.get("/", protect, requireRoles(['trainer', 'master_trainer']), getDayPlans);
router.get("/:id", protect, requireRoles(["trainer", "trainee"]), getDayPlan);
router.put("/:id", protect, trainerOnly, updateDayPlan);
router.put("/:id/publish", protect, trainerOnly, publishDayPlan);
router.delete("/:id", protect, trainerOnly, deleteDayPlan);

// Trainee routes
router.get("/trainee/list", protect, traineeOnly, getTraineeDayPlans);
router.get("/trainee/assigned", protect, trainerOnly, getTraineeDayPlans);
router.put("/:id/tasks/:taskIndex", protect, traineeOnly, updateTaskStatus);

module.exports = router;
