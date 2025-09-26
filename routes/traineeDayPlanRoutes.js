const express = require("express");
const router = express.Router();
const { protect, traineeOnly, requireRoles } = require("../middlewares/authMiddleware");
const {
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
} = require("../controllers/traineeDayPlanController");

// All routes are protected
router.use(protect);

// Trainee routes
router.get("/test", traineeOnly, testDayPlans);
router.post("/", requireRoles(["trainee", "trainer"]), createTraineeDayPlan);
router.post("/eod-update", traineeOnly, submitEodUpdate);
router.get("/", requireRoles(["trainee", "trainer"]), getTraineeDayPlans);
router.get("/:id", requireRoles(["trainee", "trainer"]), getTraineeDayPlan);
router.put("/:id", traineeOnly, updateTraineeDayPlan);
router.put("/:id/submit", traineeOnly, submitTraineeDayPlan);
router.delete("/:id", traineeOnly, deleteTraineeDayPlan);

// Trainer routes
router.put("/:id/review", requireRoles(["trainer"]), reviewTraineeDayPlan);
router.put("/:id/eod-review", requireRoles(["trainer"]), reviewEodUpdate);

module.exports = router;
