const express = require("express");
const { registerUser, loginUser, getUserProfile, updateUserProfile, changePassword } = require("../controllers/authControllerNew");
const { protect } = require("../middlewares/authMiddleware");
const upload = require("../middlewares/uploadMiddleware");

const router = express.Router();

// Auth Routes
router.post("/register", registerUser);   // Register User
router.post("/login", loginUser);         // Login User
router.get("/profile", protect, getUserProfile);  // Get User Profile
router.put("/profile", protect, updateUserProfile); // Update Profile
router.put("/change-password", protect, changePassword); // Change Password

// Debug: Log all registered routes
// Test route to verify server is working
router.get("/test", (req, res) => {
  res.json({ success: true, message: "Auth routes are working", timestamp: new Date().toISOString() });
});

router.post("/upload-image", upload.single("image"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded" });
  }
  const imageUrl = `${req.protocol}://${req.get("host")}/uploads/${
    req.file.filename
  }`;
  res.status(200).json({ imageUrl });
});

module.exports = router;
