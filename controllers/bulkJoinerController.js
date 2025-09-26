const Joiner = require('../models/Joiner');
const User = require('../models/User');
const axios = require('axios');
const crypto = require('crypto');
const mongoose = require('mongoose');

// Generate UUID v4 using crypto module
const generateUUID = () => {
  return crypto.randomUUID();
};

// @desc    Validate Google Sheets data and fetch data
// @route   POST /api/joiners/validate-sheets
// @access  Private (BOA)
const validateGoogleSheets = async (req, res) => {
  try {
    const { spread_sheet_name, data_sets_to_be_loaded, google_sheet_url } = req.body;

    if (!spread_sheet_name || !data_sets_to_be_loaded) {
      return res.status(400).json({ 
        message: 'Missing required fields: spread_sheet_name, data_sets_to_be_loaded' 
      });
    }

    // If Google Sheet URL is provided, try to fetch data
    if (google_sheet_url && google_sheet_url.trim()) {
      try {
        // console.log('Fetching data from Google Sheets:', google_sheet_url);
        const response = await axios.get(google_sheet_url);
        
        // Check if response is HTML (error page)
        if (typeof response.data === 'string' && response.data.includes('<!DOCTYPE html>')) {
          return res.status(400).json({
            message: 'Google Sheets URL returned HTML instead of JSON. Please check your Apps Script deployment.',
            received: 'HTML',
            suggestion: 'Make sure your Google Apps Script is properly deployed and returns JSON data'
          });
        }

        const sheetData = response.data;

        // Check if response is valid JSON object
        if (typeof sheetData !== 'object' || sheetData === null) {
          return res.status(400).json({
            message: 'Invalid response from Google Sheets. Expected JSON object.',
            received: typeof sheetData,
            data: sheetData
          });
        }

        // Check if spread_sheet_name matches
        if (sheetData.spread_sheet_name !== spread_sheet_name) {
          return res.status(400).json({
            message: 'Spreadsheet name does not match',
            expected: spread_sheet_name,
            actual: sheetData.spread_sheet_name
          });
        }

        // Check if data_sets_to_be_loaded matches
        if (!Array.isArray(sheetData.data_sets_to_be_loaded) || 
            !data_sets_to_be_loaded.every(dataset => 
              sheetData.data_sets_to_be_loaded.includes(dataset)
            )) {
          return res.status(400).json({
            message: 'Data sets do not match',
            expected: data_sets_to_be_loaded,
            actual: sheetData.data_sets_to_be_loaded
          });
        }

        res.status(200).json({
          message: 'Google Sheets validation successful',
          data: sheetData
        });

      } catch (error) {
        console.error('Google Sheets API error:', error);
        return res.status(400).json({
          message: 'Failed to fetch data from Google Sheets',
          error: error.message,
          details: error.response?.data
        });
      }
    } else {
      // No Google Sheet URL provided, return mock data for manual entry
      const mockSheetData = {
        spread_sheet_name: spread_sheet_name,
        data_sets_to_be_loaded: data_sets_to_be_loaded,
        data: [],
        headers: [],
        total_rows: 0,
        message: 'No Google Sheet URL provided. You can add data manually.'
      };

      res.status(200).json({
        message: 'Configuration validated (Manual mode)',
        data: mockSheetData
      });
    }

  } catch (error) {
    console.error('Error validating Google Sheets:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Process bulk joiner data
// @route   POST /api/joiners/bulk-upload
// @access  Private (BOA)
const bulkUploadJoiners = async (req, res) => {
  try {
    const { 
      spread_sheet_name, 
      data_sets_to_be_loaded, 
      google_sheet_url,
      joiners_data 
    } = req.body;

    if (!joiners_data || !Array.isArray(joiners_data)) {
      return res.status(400).json({ 
        message: 'joiners_data is required and must be an array' 
      });
    }

    // Skip Google Sheets validation in direct mode
    // console.log('Processing bulk upload in direct mode:', { 
    //   spread_sheet_name, 
    //   data_sets_to_be_loaded, 
    //   joiners_count: joiners_data.length,
    //   user_id: req.user?.id,
    //   user_role: req.user?.role
    // });

    // Process each joiner data
    const processedJoiners = [];
    const errors = [];

    // console.log('Processing joiners data:', {
    //   count: joiners_data.length,
    //   sample: joiners_data[0]
    // });

    for (let i = 0; i < joiners_data.length; i++) {
      try {
        const joinerData = joiners_data[i];
        // console.log(`Processing row ${i + 1}:`, joinerData);
        
        // Generate author_id
        const author_id = generateUUID();

        // Helper function to convert empty strings to null
        const nullIfEmpty = (value) => {
          if (value === '' || value === null || value === undefined) return null;
          return value;
        };

        // Map the data to our schema based on your exact data structure
        const mappedData = {
          // Required fields with proper fallbacks
          name: joinerData.candidate_name || 'Unknown',
          email: joinerData.candidate_personal_mail_id || 'unknown@example.com',
          phone: joinerData.phone_number ? joinerData.phone_number.toString() : '0000000000',
          department: nullIfEmpty(joinerData.top_department_name_as_per_darwinbox) || 'OTHERS',
          role: 'trainee', // Default role since role_type is "Full-time" which is not in our enum
          joiningDate: joinerData.date_of_joining ? new Date(joinerData.date_of_joining) : new Date(),
          
          // Optional fields with proper null handling
          candidate_name: nullIfEmpty(joinerData.candidate_name),
          candidate_personal_mail_id: nullIfEmpty(joinerData.candidate_personal_mail_id),
          phone_number: joinerData.phone_number ? joinerData.phone_number.toString() : null,
          top_department_name_as_per_darwinbox: nullIfEmpty(joinerData.top_department_name_as_per_darwinbox),
          department_name_as_per_darwinbox: nullIfEmpty(joinerData.department_name_as_per_darwinbox),
          date_of_joining: joinerData.date_of_joining ? new Date(joinerData.date_of_joining) : null,
          joining_status: nullIfEmpty(joinerData.joining_status)?.toLowerCase() || 'pending',
          role_type: nullIfEmpty(joinerData.role_type),
          role_assign: nullIfEmpty(joinerData.role_assign) || 'OTHER',
          qualification: nullIfEmpty(joinerData.qualification),
          author_id: author_id, // Generated UUID
          employeeId: nullIfEmpty(joinerData.employee_id),
          genre: nullIfEmpty(joinerData.genre) ? 
            nullIfEmpty(joinerData.genre).charAt(0).toUpperCase() + nullIfEmpty(joinerData.genre).slice(1).toLowerCase() : 
            null,
          status: 'pending',
          accountCreated: false,
          accountCreatedAt: null,
          createdBy: req.user?.id ? new mongoose.Types.ObjectId(req.user.id) : new mongoose.Types.ObjectId(),
          
          // Onboarding checklist
          onboardingChecklist: {
            welcomeEmailSent: false,
            credentialsGenerated: false,
            accountActivated: false,
            trainingAssigned: false,
            documentsSubmitted: false
          }
        };

            // Debug: Log the date being processed
            // console.log(`Row ${i + 1} date processing:`, {
            //   original_date: joinerData.date_of_joining,
            //   original_type: typeof joinerData.date_of_joining,
            //   parsed_date: joinerData.date_of_joining ? new Date(joinerData.date_of_joining) : null,
            //   parsed_timestamp: joinerData.date_of_joining ? new Date(joinerData.date_of_joining).getTime() : null,
            //   name: joinerData.candidate_name
            // });

            // Validate required fields based on your Google Sheet structure
            if (!joinerData.candidate_name) {
              errors.push(`Row ${i + 1}: candidate_name is required`);
              continue;
            }

        if (!joinerData.candidate_personal_mail_id) {
          errors.push(`Row ${i + 1}: candidate_personal_mail_id is required`);
          continue;
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(joinerData.candidate_personal_mail_id)) {
          errors.push(`Row ${i + 1}: Invalid email format: ${joinerData.candidate_personal_mail_id}`);
          continue;
        }

        if (!joinerData.phone_number) {
          errors.push(`Row ${i + 1}: phone_number is required`);
          continue;
        }

        // Validate phone format - more flexible regex
        const phoneRegex = /^[\+]?[0-9][\d]{0,15}$/;
        if (!phoneRegex.test(joinerData.phone_number.toString())) {
          errors.push(`Row ${i + 1}: Invalid phone format: ${joinerData.phone_number}`);
          continue;
        }

        // Validate role_assign if provided
        if (joinerData.role_assign && !['SDM', 'SDI', 'SDF', 'OTHER'].includes(joinerData.role_assign)) {
          errors.push(`Row ${i + 1}: Invalid role_assign value: ${joinerData.role_assign}. Must be one of: SDM, SDI, SDF, OTHER`);
          continue;
        }

        // Check if joiner already exists
        const existingJoiner = await Joiner.findOne({
          $or: [
            { candidate_personal_mail_id: mappedData.candidate_personal_mail_id },
            { author_id: mappedData.author_id }
          ]
        });

        if (existingJoiner) {
          errors.push(`Row ${i + 1}: Joiner with email ${mappedData.candidate_personal_mail_id} or author_id ${mappedData.author_id} already exists`);
          continue;
        }

        processedJoiners.push(mappedData);

      } catch (error) {
        errors.push(`Row ${i + 1}: ${error.message}`);
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        message: 'Validation errors found',
        errors: errors,
        processedCount: processedJoiners.length,
        totalCount: joiners_data.length
      });
    }

    // Validate data before insertion
    // console.log('Validating data before insertion...');
    for (let i = 0; i < processedJoiners.length; i++) {
      const joiner = processedJoiners[i];
      // console.log(`Validating joiner ${i + 1}:`, {
      //   name: joiner.name,
      //   email: joiner.email,
      //   phone: joiner.phone,
      //   department: joiner.department,
      //   role: joiner.role,
      //   role_assign: joiner.role_assign,
      //   joiningDate: joiner.joiningDate,
      //   author_id: joiner.author_id,
      //   createdBy: joiner.createdBy
      // });
    }

    // Insert all valid joiners
    // console.log('Attempting to insert joiners:', {
    //   count: processedJoiners.length,
    //   sample: processedJoiners[0]
    // });

    let createdJoiners;
    try {
      // Test with a single joiner first
      if (processedJoiners.length > 0) {
        // console.log('Testing single joiner insertion first...');
        const testJoiner = new Joiner(processedJoiners[0]);
        await testJoiner.validate();
        // console.log('Single joiner validation passed');
      }
      
      createdJoiners = await Joiner.insertMany(processedJoiners);
      // console.log('Successfully inserted joiners:', createdJoiners.length);
    } catch (dbError) {
      console.error('Database insertion error:', dbError);
      console.error('Error name:', dbError.name);
      console.error('Error code:', dbError.code);
      console.error('Error message:', dbError.message);
      console.error('Error details:', dbError);
      
      return res.status(500).json({
        message: 'Database insertion failed',
        error: dbError.message,
        errorName: dbError.name,
        errorCode: dbError.code,
        details: dbError.toString()
      });
    }

    res.status(201).json({
      message: 'Bulk upload successful',
      createdCount: createdJoiners.length,
      totalCount: joiners_data.length,
      joiners: createdJoiners
    });

  } catch (error) {
    console.error('Error in bulk upload:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      message: 'Server error', 
      error: error.message,
      details: error.stack,
      type: error.name
    });
  }
};

// @desc    Test Google Sheets URL
// @route   GET /api/joiners/test-sheets
// @access  Private (BOA)
const testGoogleSheets = async (req, res) => {
  try {
    const { url } = req.query;
    
    if (!url) {
      return res.status(400).json({ 
        message: 'URL parameter is required' 
      });
    }

    // console.log('Testing URL:', url);
    const response = await axios.get(url);
    
    res.status(200).json({
      message: 'URL test successful',
      status: response.status,
      dataType: typeof response.data,
      data: response.data,
      headers: response.headers
    });

  } catch (error) {
    console.error('URL test error:', error);
    res.status(400).json({
      message: 'URL test failed',
      error: error.message,
      details: error.response?.data
    });
  }
};

module.exports = {
  validateGoogleSheets,
  bulkUploadJoiners,
  testGoogleSheets
};
