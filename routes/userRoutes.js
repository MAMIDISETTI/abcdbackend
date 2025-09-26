const express = require("express");
const { protect, masterTrainerOnly, requireRoles } = require("../middlewares/authMiddleware");
const { getUsers, getUserById, createUser } = require("../controllers/userController");

const router = express.Router();

// User Management Routes
router.get("/", protect, requireRoles(["master_trainer", "boa", "trainer"]), getUsers); // Get all users (Master Trainer, BOA, and Trainer)
router.get("/:id", protect, getUserById); // Get a specific user
router.post("/", protect, createUser); // Create a new user (BOA/Admin)

module.exports = router;
