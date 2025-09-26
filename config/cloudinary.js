const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Configure multer storage for Cloudinary
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'task-manager/demos', // Folder in Cloudinary
    resource_type: 'video', // Specify that we're uploading videos
    allowed_formats: ['mp4', 'avi', 'mov', 'webm'], // Allowed video formats
    transformation: [
      {
        width: 1280,
        height: 720,
        crop: 'limit',
        quality: 'auto',
        format: 'mp4'
      }
    ]
  }
});

// Configure multer with Cloudinary storage
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
  },
  fileFilter: (req, file, cb) => {
    // Check if file is a video
    if (file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only video files are allowed!'), false);
    }
  }
});

module.exports = { cloudinary, upload };
