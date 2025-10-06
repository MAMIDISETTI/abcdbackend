// Test Cloudinary configuration
const { cloudinary, upload } = require('./config/cloudinary');

// Test if cloudinary is configured
if (cloudinary.config().cloud_name) {
  } else {
  }

// Test upload configuration
if (upload) {
  } else {
  }
