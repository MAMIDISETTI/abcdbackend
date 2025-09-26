// Test Cloudinary configuration
const { cloudinary, upload } = require('./config/cloudinary');

console.log('Testing Cloudinary configuration...');

// Test if cloudinary is configured
if (cloudinary.config().cloud_name) {
  console.log('✅ Cloudinary configured successfully!');
  console.log('Cloud Name:', cloudinary.config().cloud_name);
  console.log('API Key:', cloudinary.config().api_key ? 'Set' : 'Not set');
  console.log('API Secret:', cloudinary.config().api_secret ? 'Set' : 'Not set');
} else {
  console.log('❌ Cloudinary not configured properly');
  console.log('Please set your environment variables:');
  console.log('- CLOUDINARY_CLOUD_NAME');
  console.log('- CLOUDINARY_API_KEY');
  console.log('- CLOUDINARY_API_SECRET');
}

// Test upload configuration
console.log('\nTesting upload configuration...');
if (upload) {
  console.log('✅ Upload middleware configured successfully!');
} else {
  console.log('❌ Upload middleware not configured');
}
