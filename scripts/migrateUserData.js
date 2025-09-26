const mongoose = require('mongoose');
const User = require('../models/User');
const Joiner = require('../models/Joiner');
const UserNew = require('../models/UserNew');

// Migration script to move from duplicated data to reference-based approach
async function migrateUserData() {
  try {
    // console.log('Starting user data migration...');
    
    // Get all existing users
    const users = await User.find({});
    // console.log(`Found ${users.length} users to migrate`);
    
    let migratedCount = 0;
    let errorCount = 0;
    
    for (const user of users) {
      try {
        // Check if user already has a joiner record
        let joiner = await Joiner.findOne({ 
          $or: [
            { email: user.email },
            { candidate_personal_mail_id: user.email }
          ]
        });
        
        // If no joiner record exists, create one from user data
        if (!joiner) {
          joiner = new Joiner({
            name: user.name,
            candidate_name: user.candidate_name || user.name,
            email: user.email,
            candidate_personal_mail_id: user.candidate_personal_mail_id || user.email,
            phone: user.phone,
            phone_number: user.phone_number || user.phone,
            department: user.department,
            top_department_name_as_per_darwinbox: user.top_department_name_as_per_darwinbox || user.department,
            department_name_as_per_darwinbox: user.department_name_as_per_darwinbox || user.department,
            role: user.role,
            role_assign: user.role_assign,
            qualification: user.qualification,
            employeeId: user.employeeId,
            genre: user.genre,
            joiningDate: user.joiningDate || user.date_of_joining || new Date(),
            date_of_joining: user.date_of_joining || user.joiningDate || new Date(),
            joining_status: user.joining_status || 'active',
            author_id: user.author_id,
            status: user.status || 'active',
            accountCreated: user.accountCreated || true,
            accountCreatedAt: user.accountCreatedAt || user.accountCreatedAt,
            createdBy: user.createdBy,
            userId: user._id,
            onboardingChecklist: user.onboardingChecklist || [{
              welcomeEmailSent: false,
              credentialsGenerated: false,
              accountActivated: true,
              trainingAssigned: false,
              documentsSubmitted: false
            }]
          });
          
          await joiner.save();
          // console.log(`Created joiner record for user: ${user.email}`);
        } else {
          // Update existing joiner with user ID
          joiner.userId = user._id;
          await joiner.save();
          // console.log(`Updated joiner record for user: ${user.email}`);
        }
        
        // Create new user record with reference
        const newUser = new UserNew({
          author_id: user.author_id,
          name: user.name,
          email: user.email,
          password: user.password,
          profileImageUrl: user.profileImageUrl,
          role: user.role,
          joinerId: joiner._id,
          assignedTrainer: user.assignedTrainer,
          assignedTrainees: user.assignedTrainees,
          isActive: user.isActive,
          lastClockIn: user.lastClockIn,
          lastClockOut: user.lastClockOut,
          accountCreatedAt: user.accountCreatedAt || user.createdAt,
          createdBy: user.createdBy
        });
        
        await newUser.save();
        migratedCount++;
        // console.log(`Migrated user: ${user.email}`);
        
      } catch (error) {
        console.error(`Error migrating user ${user.email}:`, error.message);
        errorCount++;
      }
    }
    
    // console.log(`Migration completed!`);
    // console.log(`Successfully migrated: ${migratedCount} users`);
    // console.log(`Errors: ${errorCount} users`);
    
  } catch (error) {
    console.error('Migration failed:', error);
  }
}

// Function to rollback migration (if needed)
async function rollbackMigration() {
  try {
    // console.log('Rolling back migration...');
    await UserNew.deleteMany({});
    // console.log('Rollback completed');
  } catch (error) {
    console.error('Rollback failed:', error);
  }
}

module.exports = { migrateUserData, rollbackMigration };

// Run migration if called directly
if (require.main === module) {
  const { connectDB } = require('../config/db');
  connectDB().then(() => {
    migrateUserData().then(() => {
      process.exit(0);
    });
  });
}
