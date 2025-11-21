const User = require('../models/User');
const UserNew = require('../models/UserNew');
const LearningReport = require('../models/LearningReport');
const AttendanceReport = require('../models/AttendanceReport');
const GroomingReport = require('../models/GroomingReport');
const InteractionsReport = require('../models/InteractionsReport');
const Joiner = require('../models/Joiner');
const axios = require('axios');

// @desc    Validate author_id exists in users collection
// @route   POST /api/candidate-reports/validate-author
// @access  Private (BOA)
const validateAuthorId = async (req, res) => {
  try {
    const { author_id } = req.body;

    if (!author_id) {
      return res.status(400).json({
        success: false,
        message: 'Author ID is required'
      });
    }

    // Check if author_id exists in User model
    let user = await User.findOne({ author_id: author_id.trim() });
    
    if (!user) {
      // Try UserNew model as well
      user = await UserNew.findOne({ author_id: author_id.trim() });
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: `User with author_id "${author_id}" not found in users collection`
      });
    }

    res.status(200).json({
      success: true,
      message: 'Author ID validated successfully',
      user: {
        author_id: user.author_id,
        name: user.name,
        email: user.email
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Bulk upload candidate reports to separate collections (from single sheet with sub-sheets)
// @route   POST /api/candidate-reports/bulk-upload
// @access  Private (BOA)
const bulkUploadCandidateReports = async (req, res) => {
  try {
    // Validate authentication
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please log in again.'
      });
    }

    const { 
      spread_sheet_name, 
      data_sets_to_be_loaded, 
      google_sheet_url,
      candidate_reports_data 
    } = req.body;

    if (!spread_sheet_name || !data_sets_to_be_loaded) {
      return res.status(400).json({
        success: false,
        message: 'spread_sheet_name and data_sets_to_be_loaded are required'
      });
    }

    let reportsData = [];

    // If Google Sheet URL is provided, fetch data from the sheet (which contains sub-sheets)
    if (google_sheet_url && google_sheet_url.trim()) {
      try {
        // Build URL with JSON config as query parameter
        let url = google_sheet_url.trim();
        const jsonConfig = {
          spread_sheet_name: spread_sheet_name,
          data_sets_to_be_loaded: data_sets_to_be_loaded
        };
        const jsonConfigParam = encodeURIComponent(JSON.stringify(jsonConfig));
        url += (url.includes('?') ? '&' : '?') + 'json_config=' + jsonConfigParam;
        
        const response = await axios.get(url);
        
        if (typeof response.data === 'string' && response.data.includes('<!DOCTYPE html>')) {
          return res.status(400).json({
            success: false,
            message: 'Google Sheets URL returned HTML instead of JSON. Please check your Apps Script deployment.',
            received: 'HTML'
          });
        }

        const sheetData = response.data;

        if (typeof sheetData !== 'object' || sheetData === null) {
          return res.status(400).json({
            success: false,
            message: 'Invalid response from Google Sheets. Expected JSON object.',
            received: typeof sheetData
          });
        }

        // The Apps Script should return data organized by sub-sheets
        // Expected structure: { success: true, data: [{ author_id, learningReport, attendanceReport, groomingReport, ... }] }
        // OR: { DailyQuizReports: [...], FortnightScores: [...], AttendanceReport: [...], GroomingReport: [...] }
        
        let extractedData = [];
        
        // Check if data is already combined by author_id
        if (sheetData.success && sheetData.data && Array.isArray(sheetData.data)) {
          extractedData = sheetData.data;
        } else if (Array.isArray(sheetData)) {
          extractedData = sheetData;
        } else if (sheetData.data && Array.isArray(sheetData.data)) {
          extractedData = sheetData.data;
        } else {
          // If data is organized by sub-sheet names, combine them
          const combinedData = {};
          
          // Learning Report sub-sheets: combine DailyQuizReports, FortnightScores, CourseExamScores, OnlineDemoReports, OfflineDemoReports
          const learningSubSheets = ['DailyQuizReports', 'FortnightScores', 'CourseExamScores', 'OnlineDemoReports', 'OfflineDemoReports'];
          learningSubSheets.forEach(sheetName => {
            if (sheetData[sheetName] && Array.isArray(sheetData[sheetName])) {
              sheetData[sheetName].forEach(item => {
                const authorId = item.author_id || item.authorId;
                if (authorId) {
                  if (!combinedData[authorId]) {
                    combinedData[authorId] = { author_id: authorId, learningReport: {} };
                  }
                  // Merge sub-sheet data into learningReport
                  if (!combinedData[authorId].learningReport) {
                    combinedData[authorId].learningReport = {};
                  }
                  // Deep merge to preserve nested structures
                  Object.keys(item).forEach(key => {
                    if (key !== 'author_id' && key !== 'authorId') {
                      if (combinedData[authorId].learningReport[key] && typeof combinedData[authorId].learningReport[key] === 'object' && !Array.isArray(combinedData[authorId].learningReport[key])) {
                        combinedData[authorId].learningReport[key] = {
                          ...combinedData[authorId].learningReport[key],
                          ...item[key]
                        };
                      } else {
                        combinedData[authorId].learningReport[key] = item[key];
                      }
                    }
                  });
                }
              });
            }
          });
          
          // Attendance Report sub-sheet
          if (sheetData['AttendanceReport'] && Array.isArray(sheetData['AttendanceReport'])) {
            sheetData['AttendanceReport'].forEach(item => {
              const authorId = item.author_id || item.authorId;
              if (authorId) {
                if (!combinedData[authorId]) {
                  combinedData[authorId] = { author_id: authorId };
                }
                combinedData[authorId].attendanceReport = item;
              }
            });
          }
          
          // Grooming Report sub-sheet
          if (sheetData['GroomingReport'] && Array.isArray(sheetData['GroomingReport'])) {
            sheetData['GroomingReport'].forEach(item => {
              const authorId = item.author_id || item.authorId;
              if (authorId) {
                if (!combinedData[authorId]) {
                  combinedData[authorId] = { author_id: authorId };
                }
                combinedData[authorId].groomingReport = item;
              }
            });
          }
          
          // Convert combined data object to array
          extractedData = Object.values(combinedData);
        }
        
        reportsData = extractedData;

      } catch (error) {
        return res.status(400).json({
          success: false,
          message: 'Failed to fetch data from Google Sheets',
          error: error.message,
          details: error.response?.data
        });
      }
    } else if (candidate_reports_data && Array.isArray(candidate_reports_data)) {
      // Use provided data if no Google Sheet URL
      reportsData = candidate_reports_data;
    } else {
      return res.status(400).json({
        success: false,
        message: 'Either google_sheet_url or candidate_reports_data must be provided'
      });
    }

    if (!reportsData || reportsData.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No candidate reports data found'
      });
    }

    // Determine which reports to process based on data_sets_to_be_loaded
    const learningReportSubSheets = ['DailyQuizReports', 'FortnightScores', 'CourseExamScores', 'OnlineDemoReports', 'OfflineDemoReports'];
    const sheetsToProcess = new Set();
    
    // Flatten data_sets_to_be_loaded and handle comma-separated values
    if (data_sets_to_be_loaded && Array.isArray(data_sets_to_be_loaded)) {
      // If array is empty, return error
      if (data_sets_to_be_loaded.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'data_sets_to_be_loaded cannot be empty. Please specify at least one sheet name.'
        });
      }
      
      data_sets_to_be_loaded.forEach(item => {
        if (typeof item === 'string') {
          const sheets = item.split(',').map(s => s.trim()).filter(s => s !== '');
          sheets.forEach(sheet => sheetsToProcess.add(sheet));
        } else {
          sheetsToProcess.add(item.toString().trim());
        }
      });
      
      // If no valid sheets found after processing, return error
      if (sheetsToProcess.size === 0) {
        return res.status(400).json({
          success: false,
          message: 'No valid sheet names found in data_sets_to_be_loaded. Please provide valid sheet names.'
        });
      }
    }

    // Process each candidate report
    const processedReports = [];
    const errors = [];
    let createdCount = 0;
    let updatedCount = 0;

    for (let i = 0; i < reportsData.length; i++) {
      try {
        const reportData = reportsData[i];
        
        if (!reportData.author_id) {
          errors.push(`Row ${i + 1}: author_id is required`);
          continue;
        }

        // Validate author_id exists in users collection
        let user = await User.findOne({ author_id: reportData.author_id.trim() });
        if (!user) {
          user = await UserNew.findOne({ author_id: reportData.author_id.trim() });
        }

        if (!user) {
          errors.push(`Row ${i + 1}: User not found with author_id ${reportData.author_id}`);
          continue;
        }

        // Extract reports based on data_sets_to_be_loaded filter
        let learningReport = null;
        let attendanceReport = null;
        let groomingReport = null;
        const culturalReport = reportData.culturalReport || reportData.interactionsReport || null;

        // Only include learningReport if any learning sub-sheet is in the filter
        const shouldProcessLearning = !sheetsToProcess.size || 
          learningReportSubSheets.some(sheet => sheetsToProcess.has(sheet));
        
        if (shouldProcessLearning && reportData.learningReport && Object.keys(reportData.learningReport).length > 0) {
          // Transform the data structure from sub-sheet based to metric based
          // Input: { DailyQuizReports: { Static: { "Daily Quiz counts": 4, ... }, ... }, ... }
          // Output: { "Daily Quiz counts": { Static: 4, Responsive: 5, ... }, ... }
          
          const transformedLearningReport = {};
          const allTopics = new Set();
          const allMetrics = new Set();
          
          // First pass: Collect all topics and metrics from all sub-sheets
          learningReportSubSheets.forEach(subSheet => {
            if (sheetsToProcess.size === 0 || sheetsToProcess.has(subSheet)) {
              const subSheetData = reportData.learningReport[subSheet];
              if (subSheetData && typeof subSheetData === 'object') {
                Object.keys(subSheetData).forEach(topic => {
                  allTopics.add(topic);
                  if (subSheetData[topic] && typeof subSheetData[topic] === 'object') {
                    Object.keys(subSheetData[topic]).forEach(metricName => {
                      allMetrics.add(metricName);
                    });
                  }
                });
              }
            }
          });
          
          // Second pass: Transform - group by metric name instead of sub-sheet
          allMetrics.forEach(metricName => {
            transformedLearningReport[metricName] = {};
            
            allTopics.forEach(topic => {
              // Check all sub-sheets for this metric in this topic
              learningReportSubSheets.forEach(subSheet => {
                if (sheetsToProcess.size === 0 || sheetsToProcess.has(subSheet)) {
                  const subSheetData = reportData.learningReport[subSheet];
                  if (subSheetData && 
                      subSheetData[topic] && 
                      typeof subSheetData[topic] === 'object' &&
                      subSheetData[topic][metricName] !== undefined) {
                    // Use the value from the first sub-sheet that has it, or merge if needed
                    if (transformedLearningReport[metricName][topic] === undefined) {
                      transformedLearningReport[metricName][topic] = subSheetData[topic][metricName];
                    }
                  }
                }
              });
            });
            
            // Remove metric if it has no data
            if (Object.keys(transformedLearningReport[metricName]).length === 0) {
              delete transformedLearningReport[metricName];
            }
          });
          
          // Only save if there's data
          if (Object.keys(transformedLearningReport).length > 0) {
            learningReport = transformedLearningReport;
            console.log(`[DEBUG] Transformed learning report for ${reportData.author_id}:`, {
              metricsCount: Object.keys(transformedLearningReport).length,
              sampleMetrics: Object.keys(transformedLearningReport).slice(0, 3),
              sampleMetricData: Object.keys(transformedLearningReport).length > 0 ? {
                metric: Object.keys(transformedLearningReport)[0],
                topics: Object.keys(transformedLearningReport[Object.keys(transformedLearningReport)[0]])
              } : null
            });
          } else {
            console.log(`[DEBUG] No transformed data for ${reportData.author_id}, original structure:`, {
              hasLearningReport: !!reportData.learningReport,
              subSheets: Object.keys(reportData.learningReport || {}),
              allTopics: Array.from(allTopics),
              allMetrics: Array.from(allMetrics)
            });
          }
        }

        // Only include attendanceReport if AttendanceReport is in the filter
        const shouldProcessAttendance = !sheetsToProcess.size || sheetsToProcess.has('AttendanceReport');
        if (shouldProcessAttendance && reportData.attendanceReport && Object.keys(reportData.attendanceReport).length > 0) {
          attendanceReport = reportData.attendanceReport;
        }

        // Only include groomingReport if GroomingReport is in the filter
        const shouldProcessGrooming = !sheetsToProcess.size || sheetsToProcess.has('GroomingReport');
        if (shouldProcessGrooming && reportData.groomingReport && Object.keys(reportData.groomingReport).length > 0) {
          groomingReport = reportData.groomingReport;
        }

        // Save Learning Report (combines all learning sub-sheets)
        if (learningReport && Object.keys(learningReport).length > 0) {
          try {
            // Extract all topics from the transformed data to create a skills array
            const allTopicsFromData = new Set();
            Object.keys(learningReport).forEach(metricName => {
              if (learningReport[metricName] && typeof learningReport[metricName] === 'object') {
                Object.keys(learningReport[metricName]).forEach(topic => {
                  allTopicsFromData.add(topic);
                });
              }
            });
            
            // Add skills array to the report data for frontend compatibility
            const reportDataWithSkills = {
              ...learningReport,
              skills: Array.from(allTopicsFromData)
            };
            
            let learningReportDoc = await LearningReport.findOne({ author_id: reportData.author_id.trim() });
            if (learningReportDoc) {
              learningReportDoc.reportData = reportDataWithSkills;
              learningReportDoc.uploadedBy = req.user.id;
              learningReportDoc.uploadedAt = new Date();
              learningReportDoc.lastUpdatedAt = new Date();
              await learningReportDoc.save();
              updatedCount++;
            } else {
              await LearningReport.create({
                author_id: reportData.author_id.trim(),
                user: user._id || null,
                reportData: reportDataWithSkills,
                uploadedBy: req.user.id
              });
              createdCount++;
            }
          } catch (saveError) {
            throw new Error(`Failed to save Learning Report for author_id ${reportData.author_id}: ${saveError.message}`);
          }
        }

        // Save Attendance Report
        if (attendanceReport && Object.keys(attendanceReport).length > 0) {
          try {
            let attendanceReportDoc = await AttendanceReport.findOne({ author_id: reportData.author_id.trim() });
            if (attendanceReportDoc) {
              attendanceReportDoc.reportData = attendanceReport;
              attendanceReportDoc.uploadedBy = req.user.id;
              attendanceReportDoc.uploadedAt = new Date();
              attendanceReportDoc.lastUpdatedAt = new Date();
              await attendanceReportDoc.save();
              updatedCount++;
            } else {
              await AttendanceReport.create({
                author_id: reportData.author_id.trim(),
                user: user._id || null,
                reportData: attendanceReport,
                uploadedBy: req.user.id
              });
              createdCount++;
            }
          } catch (saveError) {
            throw new Error(`Failed to save Attendance Report for author_id ${reportData.author_id}: ${saveError.message}`);
          }
        }

        // Save Grooming Report
        if (groomingReport && Object.keys(groomingReport).length > 0) {
          try {
            let groomingReportDoc = await GroomingReport.findOne({ author_id: reportData.author_id.trim() });
            if (groomingReportDoc) {
              groomingReportDoc.reportData = groomingReport;
              groomingReportDoc.uploadedBy = req.user.id;
              groomingReportDoc.uploadedAt = new Date();
              groomingReportDoc.lastUpdatedAt = new Date();
              await groomingReportDoc.save();
              updatedCount++;
            } else {
              await GroomingReport.create({
                author_id: reportData.author_id.trim(),
                user: user._id || null,
                reportData: groomingReport,
                uploadedBy: req.user.id
              });
              createdCount++;
            }
          } catch (saveError) {
            throw new Error(`Failed to save Grooming Report for author_id ${reportData.author_id}: ${saveError.message}`);
          }
        }

        // Save Cultural Report (stored in InteractionsReport collection for backward compatibility)
        if (culturalReport && (Array.isArray(culturalReport) ? culturalReport.length > 0 : Object.keys(culturalReport).length > 0)) {
          let interactionsReportDoc = await InteractionsReport.findOne({ author_id: reportData.author_id });
          if (interactionsReportDoc) {
            interactionsReportDoc.reportData = culturalReport;
            interactionsReportDoc.uploadedBy = req.user.id;
            interactionsReportDoc.uploadedAt = new Date();
            interactionsReportDoc.lastUpdatedAt = new Date();
            await interactionsReportDoc.save();
            updatedCount++;
          } else {
            await InteractionsReport.create({
              author_id: reportData.author_id,
              user: user._id,
              reportData: culturalReport,
              uploadedBy: req.user.id
            });
            createdCount++;
          }
        }

        processedReports.push({
          author_id: reportData.author_id,
          name: user.name,
          email: user.email
        });

      } catch (error) {
        const errorMessage = error.message || error.toString();
        const errorDetails = error.stack ? error.stack.split('\n')[0] : '';
        errors.push(`Row ${i + 1}: ${errorMessage}${errorDetails ? ' - ' + errorDetails : ''}`);
      }
    }

    res.status(200).json({
      success: true,
      message: `Successfully processed ${processedReports.length} candidate reports`,
      createdCount,
      updatedCount,
      totalProcessed: processedReports.length,
      errors: errors.length > 0 ? errors : undefined,
      processedReports
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get candidate performance data (all reports)
// @route   GET /api/candidate-reports/performance/:authorId
// @access  Private (Admin)
const getCandidatePerformance = async (req, res) => {
  try {
    const { authorId } = req.params;

    if (!authorId) {
      return res.status(400).json({
        success: false,
        message: 'Author ID is required'
      });
    }

    // Fetch Personal Details from users collection
    let user = await User.findOne({ author_id: authorId })
      .select('-password -tempPassword')
      .lean();
    
    let userModel = 'User';
    
    if (!user) {
      // Try UserNew model as well
      user = await UserNew.findOne({ author_id: authorId })
        .select('-password -tempPassword')
        .lean();
      userModel = 'UserNew';
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found with this author_id'
      });
    }

    // Get employee ID - check joiner collection for NW format
    let finalEmployeeId = null;
    let joiner = null;
    
    try {
      // Try to find joiner by author_id first
      joiner = await Joiner.findOne({ author_id: authorId }).lean();
      
      // If not found by author_id, try by email
      if (!joiner && user.email) {
        joiner = await Joiner.findOne({
          $or: [
            { email: user.email.toLowerCase() },
            { candidate_personal_mail_id: user.email.toLowerCase() }
          ]
        }).lean();
      }
      
      // If joiner found, use joiner's employeeId (NW format)
      if (joiner && joiner.employeeId) {
        finalEmployeeId = String(joiner.employeeId).trim();
      }
    } catch (err) {
      // Error fetching joiner - continue with user's employeeId
    }
    
    // If no joiner employeeId found, use user's employeeId (even if EMP_ format)
    if (!finalEmployeeId && user.employeeId) {
      finalEmployeeId = String(user.employeeId).trim();
    }

    // Prepare Personal Details from users collection
    const personalDetails = {
      uid: user.author_id,
      name: user.name,
      email: user.email,
      phone: user.phone || user.phone_number || null,
      phoneNumber: user.phone || user.phone_number || null,
      employeeId: finalEmployeeId || null,
      dateOfJoining: user.joiningDate || user.date_of_joining || user.createdAt || null,
      joiningDate: user.joiningDate || user.date_of_joining || user.createdAt || null,
      state: user.state || null,
      qualification: user.qualification || null,
      highestQualification: user.qualification || null,
      specialization: user.specialization || null,
      haveMTechPC: user.haveMTechPC || null,
      haveMTechOD: user.haveMTechOD || null,
      yearOfPassout: user.yearOfPassout || user.yearOfPassing || null,
      yearOfPassing: user.yearOfPassout || user.yearOfPassing || null,
      department: user.department || null,
      role: user.role || null,
      isActive: user.isActive !== undefined ? user.isActive : true
    };

    // Fetch all reports for the candidate (get the latest one if multiple exist)
    const learningReportDoc = await LearningReport.find({ author_id: authorId })
      .populate('uploadedBy', 'name email')
      .sort({ uploadedAt: -1 })
      .limit(1)
      .lean();
    const learningReport = learningReportDoc && learningReportDoc.length > 0 ? learningReportDoc[0] : null;

    const attendanceReportDoc = await AttendanceReport.find({ author_id: authorId })
      .populate('uploadedBy', 'name email')
      .sort({ uploadedAt: -1 })
      .limit(1)
      .lean();
    const attendanceReport = attendanceReportDoc && attendanceReportDoc.length > 0 ? attendanceReportDoc[0] : null;

    const groomingReportDoc = await GroomingReport.find({ author_id: authorId })
      .populate('uploadedBy', 'name email')
      .sort({ uploadedAt: -1 })
      .limit(1)
      .lean();
    const groomingReport = groomingReportDoc && groomingReportDoc.length > 0 ? groomingReportDoc[0] : null;

    const interactionsReportDoc = await InteractionsReport.find({ author_id: authorId })
      .populate('uploadedBy', 'name email')
      .sort({ uploadedAt: -1 })
      .limit(1)
      .lean();
    const interactionsReport = interactionsReportDoc && interactionsReportDoc.length > 0 ? interactionsReportDoc[0] : null;

    // Transform learning report data if it's still in sub-sheet format
    let transformedLearningReportData = null;
    if (learningReport && learningReport.reportData) {
      const reportData = learningReport.reportData;
      const reportDataKeys = Object.keys(reportData);
      
      // Check if data is in sub-sheet format (has DailyQuizReports, FortnightScores, etc.)
      const isSubSheetFormat = reportDataKeys.some(key => 
        ['DailyQuizReports', 'FortnightScores', 'CourseExamScores', 'OnlineDemoReports', 'OfflineDemoReports'].includes(key)
      );
      
      if (isSubSheetFormat) {
        // Transform from sub-sheet format to metric-based format
        console.log('[TRANSFORM] Converting sub-sheet format to metric-based format for', authorId);
        const transformed = {};
        const allTopics = new Set();
        const allMetrics = new Set();
        const learningReportSubSheets = ['DailyQuizReports', 'FortnightScores', 'CourseExamScores', 'OnlineDemoReports', 'OfflineDemoReports'];
        
        // First pass: Collect all topics and metrics
        learningReportSubSheets.forEach(subSheet => {
          if (reportData[subSheet] && typeof reportData[subSheet] === 'object') {
            Object.keys(reportData[subSheet]).forEach(topic => {
              allTopics.add(topic);
              if (reportData[subSheet][topic] && typeof reportData[subSheet][topic] === 'object') {
                Object.keys(reportData[subSheet][topic]).forEach(metricName => {
                  allMetrics.add(metricName);
                });
              }
            });
          }
        });
        
        // Second pass: Transform
        allMetrics.forEach(metricName => {
          transformed[metricName] = {};
          allTopics.forEach(topic => {
            learningReportSubSheets.forEach(subSheet => {
              if (reportData[subSheet] && 
                  reportData[subSheet][topic] && 
                  typeof reportData[subSheet][topic] === 'object' &&
                  reportData[subSheet][topic][metricName] !== undefined) {
                if (transformed[metricName][topic] === undefined) {
                  transformed[metricName][topic] = reportData[subSheet][topic][metricName];
                }
              }
            });
          });
          if (Object.keys(transformed[metricName]).length === 0) {
            delete transformed[metricName];
          }
        });
        
        // Add skills array
        transformed.skills = Array.from(allTopics);
        transformedLearningReportData = transformed;
        
        // console.log('[TRANSFORM] Transformation complete:', {
        //   metricsCount: Object.keys(transformed).length - 1, // -1 for skills
        //   topicsCount: allTopics.size,
        //   sampleMetrics: Object.keys(transformed).filter(k => k !== 'skills').slice(0, 3)
        // });
      } else {
        // Already in metric-based format
        transformedLearningReportData = reportData;
      }
    }

    res.status(200).json({
      success: true,
      data: {
        personalDetails,
        learningReport: learningReport ? {
          reportData: transformedLearningReportData || learningReport.reportData,
          uploadedAt: learningReport.uploadedAt,
          uploadedBy: learningReport.uploadedBy
        } : null,
        attendanceReport: attendanceReport ? {
          reportData: attendanceReport.reportData,
          uploadedAt: attendanceReport.uploadedAt,
          uploadedBy: attendanceReport.uploadedBy
        } : null,
        groomingReport: groomingReport ? {
          reportData: groomingReport.reportData,
          uploadedAt: groomingReport.uploadedAt,
          uploadedBy: groomingReport.uploadedBy
        } : null,
        interactionsReport: interactionsReport ? {
          reportData: interactionsReport.reportData,
          uploadedAt: interactionsReport.uploadedAt,
          uploadedBy: interactionsReport.uploadedBy
        } : null
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

module.exports = {
  validateAuthorId,
  bulkUploadCandidateReports,
  getCandidatePerformance
};

