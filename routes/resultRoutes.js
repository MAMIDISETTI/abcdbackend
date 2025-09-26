const express = require("express");
const { protect, requireRoles } = require("../middlewares/authMiddleware");
const {
  getResults,
  getResultById,
  createResult,
  bulkUploadResults,
  updateResult,
  deleteResult,
  validateSheets,
  debugUserExams,
  getExamStatistics
} = require("../controllers/resultController");

const router = express.Router();

// All routes are protected
router.use(protect);

// Results Management Routes
router.get("/", requireRoles(["master_trainer", "boa", "trainer"]), getResults); // Get all results
router.get("/my-results", requireRoles(["trainee"]), getResults); // Get trainee's own results
router.get("/statistics", requireRoles(["master_trainer", "boa"]), getExamStatistics); // Get exam statistics
router.get("/debug-user/:authorId", requireRoles(["master_trainer", "boa"]), debugUserExams); // Debug user exams
router.get("/:id", requireRoles(["master_trainer", "boa", "trainer"]), getResultById); // Get result by ID
router.post("/", requireRoles(["master_trainer", "boa"]), createResult); // Create a new result
router.post("/bulk-upload", requireRoles(["master_trainer", "boa"]), bulkUploadResults); // Bulk upload results
router.post("/validate-sheets", requireRoles(["master_trainer", "boa"]), validateSheets); // Validate Google Sheets
router.put("/:id", requireRoles(["master_trainer", "boa"]), updateResult); // Update result
router.delete("/:id", requireRoles(["master_trainer", "boa"]), deleteResult); // Delete result

module.exports = router;
