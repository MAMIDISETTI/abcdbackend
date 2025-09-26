const Result = require("../models/Result");
const User = require("../models/User");
const axios = require("axios");

// @desc    Get all results
// @route   GET /api/results
// @access  Private
const getResults = async (req, res) => {
  try {
    const { examType, authorId, page = 1, limit = 10 } = req.query;
    
    // console.log('Fetching results with query params:', { examType, authorId, page, limit });
    
    let query = {};
    
    // If user is a trainee, automatically filter by their author_id
    if (req.user.role === 'trainee') {
      query.author_id = req.user.author_id;
    } else if (authorId) {
      // For other roles, use the provided authorId if available
      query.author_id = authorId;
    }
    
    if (examType) {
      // Make the exam type search more flexible to handle variations
      if (examType === 'fortnight') {
        query.exam_type = { 
          $regex: /^fortnight/i 
        };
      } else if (examType === 'daily') {
        query.exam_type = { 
          $regex: /^daily/i 
        };
      } else if (examType === 'course') {
        query.exam_type = { 
          $regex: /^course/i 
        };
      } else {
        query.exam_type = examType;
      }
    }

    // console.log('Query being used:', query);

    // First, let's see what results exist in the database
    const allResults = await Result.find({}).select('exam_type author_id trainee_name score').limit(5);
    // console.log('Sample results in database:', allResults);
    
    // Get all unique exam types in the database
    const uniqueExamTypes = await Result.distinct('exam_type');
    // console.log('All unique exam types in database:', uniqueExamTypes);

    const results = await Result.find(query)
      .sort({ uploaded_at: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    // Manually populate uploaded_by and trainer information using author_id
    const populatedResults = await Promise.all(results.map(async (result) => {
      const uploadedBy = await User.findOne({ author_id: result.uploaded_by }).select('name email author_id');
      
      // Get trainee information to find their assigned trainer
      const trainee = await User.findOne({ author_id: result.author_id }).select('assignedTrainer name email');
      let trainerName = result.trainer_name || 'N/A';
      
      console.log(`Processing result for trainee ${result.author_id}:`, {
        traineeFound: !!trainee,
        traineeAssignedTrainer: trainee?.assignedTrainer,
        existingTrainerName: result.trainer_name
      });
      
      // If no trainer_name is set and trainee has an assigned trainer, get trainer name
      if ((!result.trainer_name || result.trainer_name === '') && trainee && trainee.assignedTrainer) {
        const trainer = await User.findById(trainee.assignedTrainer).select('name');
        console.log(`Looking up trainer by ID ${trainee.assignedTrainer}:`, {
          trainerFound: !!trainer,
          trainerName: trainer?.name
        });
        if (trainer) {
          trainerName = trainer.name;
        }
      }
      
      return {
        ...result.toObject(),
        uploaded_by: uploadedBy,
        trainer_name: trainerName
      };
    }));

    const total = await Result.countDocuments(query);

    // console.log('Found results:', results.length, 'Total:', total);

    res.json({
      success: true,
      results: populatedResults,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Error fetching results:', error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// @desc    Get result by ID
// @route   GET /api/results/:id
// @access  Private
const getResultById = async (req, res) => {
  try {
    const result = await Result.findById(req.params.id).populate('uploaded_by', 'name email');
    
    if (!result) {
      return res.status(404).json({ success: false, message: "Result not found" });
    }

    res.json({ success: true, result });
  } catch (error) {
    console.error('Error fetching result:', error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// @desc    Create a new result
// @route   POST /api/results
// @access  Private
const createResult = async (req, res) => {
  try {
    const {
      author_id,
      trainee_name,
      email,
      exam_type,
      score,
      total_marks,
      exam_date,
      remarks,
      department,
      trainer_name,
      batch_name
    } = req.body;

    // Calculate percentage
    const percentage = Math.round((score / total_marks) * 100);
    
    // Determine status based on percentage
    let status = 'failed';
    if (percentage >= 60) {
      status = 'passed';
    }

    // Get trainer name if trainee has an assigned trainer
    let finalTrainerName = trainer_name || '';
    if ((!finalTrainerName || finalTrainerName === '') && author_id) {
      const trainee = await User.findOne({ author_id }).select('assignedTrainer');
      if (trainee && trainee.assignedTrainer) {
        const trainer = await User.findOne({ author_id: trainee.assignedTrainer }).select('name');
        if (trainer) {
          finalTrainerName = trainer.name;
        }
      }
    }

    // Generate result name based on exam type and count
    const count = await Result.countDocuments({ exam_type });
    const result_name = `${exam_type.charAt(0).toUpperCase() + exam_type.slice(1)}Results${count + 1}`;

    const result = await Result.create({
      author_id,
      trainee_name,
      email,
      exam_type,
      result_name,
      score,
      total_marks,
      percentage,
      exam_date: new Date(exam_date),
      uploaded_by: req.user.id,
      status,
      remarks,
      department,
      trainer_name: finalTrainerName,
      batch_name
    });

    res.status(201).json({ success: true, result });
  } catch (error) {
    console.error('Error creating result:', error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// @desc    Bulk upload results from Google Sheets
// @route   POST /api/results/bulk-upload
// @access  Private
const bulkUploadResults = async (req, res) => {
  try {
    const { examType, results, config, googleSheetUrl, jsonData } = req.body;

    // console.log('Bulk upload request:', { examType, resultsLength: results?.length, config, googleSheetUrl, jsonData });
    // console.log('Request user:', { id: req.user?.id, name: req.user?.name, role: req.user?.role });

    if (!examType) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid request. examType is required." 
      });
    }

    let resultsToProcess = results;
    
    // If no results provided but jsonData is available, use that
    if (!resultsToProcess && jsonData && jsonData.data) {
      resultsToProcess = jsonData.data;
    }

    if (!resultsToProcess || !Array.isArray(resultsToProcess)) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid request. Results data is required." 
      });
    }

    const uploadedResults = [];
    const errors = [];

    for (let i = 0; i < resultsToProcess.length; i++) {
      try {
        const resultData = resultsToProcess[i];
        
        // Log the result data for debugging
        // console.log(`Processing result ${i + 1}:`, resultData);

        // Validate required fields
        if (!resultData.author_id) {
          errors.push(`Row ${i + 1}: author_id is required`);
          continue;
        }

         // Find user by author_id and validate role
         let user = await User.findOne({ author_id: resultData.author_id });
         
         // If not found and author_id looks truncated, try partial match
         if (!user && resultData.author_id && resultData.author_id.length < 36) {
           // console.log(`Trying partial match for truncated author_id: ${resultData.author_id}`);
           user = await User.findOne({ 
             author_id: { $regex: `^${resultData.author_id}`, $options: 'i' } 
           });
         }
         
         if (!user) {
           errors.push(`Row ${i + 1}: User with author_id ${resultData.author_id} not found`);
           continue;
         }

         // Check if user has trainee role
         if (user.role !== 'trainee') {
           errors.push(`Row ${i + 1}: author_id ${resultData.author_id} did not match with trainee role (current role: ${user.role})`);
           continue;
         }

         // console.log(`Found trainee user for author_id ${resultData.author_id}:`, {
         //   name: user.name,
         //   email: user.email,
         //   department: user.department,
         //   role: user.role
         // });

         // Calculate percentage - handle 0 as a valid score
         // console.log('=== SCORE PROCESSING ===');
         // console.log('resultData.score:', resultData.score);
         // console.log('resultData.score type:', typeof resultData.score);
         // console.log('resultData.score is null:', resultData.score === null);
         // console.log('resultData.score is undefined:', resultData.score === undefined);
         // console.log('resultData.score is empty string:', resultData.score === '');
         
         let score = 0;
         if (resultData.score !== null && resultData.score !== undefined && resultData.score !== '') {
           score = parseFloat(resultData.score);
           // console.log('Parsed score:', score);
           // console.log('isNaN(score):', isNaN(score));
           if (isNaN(score)) {
             score = 0;
           }
         }
         const total_marks = parseFloat(resultData.total_marks) || 100;
         const percentage = Math.round((score / total_marks) * 100);
         
         // console.log('Final score:', score);
         // console.log('Total marks:', total_marks);
         // console.log('Percentage:', percentage);
         // console.log('=== END SCORE PROCESSING ===');
        
        // Determine status
        let status = 'failed';
        if (percentage >= 60) {
          status = 'passed';
        }

         // Use exam_type from data or fallback to request examType
         let rawExamType = (resultData.exam_type || examType).toString().trim();
         
         // Normalize the exam type to proper format (e.g., Fornight1 -> fortnight1)
         let finalExamType;
         if (rawExamType.toLowerCase().includes('fortnight') || rawExamType.toLowerCase().includes('fornight')) {
           // Extract number if present, otherwise default to 1
           const numberMatch = rawExamType.match(/\d+/);
           const number = numberMatch ? numberMatch[0] : '1';
           finalExamType = `fortnight${number}`;
         } else if (rawExamType.toLowerCase().includes('daily') || rawExamType.toLowerCase().includes('dailyquiz') || examType === 'dailyquizzes' || examType === 'dailyquiz' || examType === 'adddataforjoiners') {
           const numberMatch = rawExamType.match(/\d+/);
           const number = numberMatch ? numberMatch[0] : '1';
           finalExamType = `daily${number}`;
         } else if (rawExamType.toLowerCase().includes('course')) {
           const numberMatch = rawExamType.match(/\d+/);
           const number = numberMatch ? numberMatch[0] : '1';
           finalExamType = `course${number}`;
         } else {
           // Fallback to the request examType with number 1
           finalExamType = `${examType}1`;
         }
         
         // Check for duplicate exam type for this author_id
         const existingResult = await Result.findOne({ 
           author_id: resultData.author_id, 
           exam_type: finalExamType 
         });
         
         if (existingResult) {
           errors.push(`Row ${i + 1}: For author_id ${resultData.author_id}, ${finalExamType} is already added`);
           continue;
         }
         
         // console.log(`Processing result for user ${user.name}:`, {
         //   resultData: resultData,
         //   examType: examType,
         //   rawExamType: rawExamType,
         //   finalExamType: finalExamType,
         //   resultDataExamType: resultData.exam_type,
         //   resultDataType: resultData.type
         // });
         
         // Generate result name
         const count = await Result.countDocuments({ exam_type: finalExamType });
         const result_name = `${finalExamType.charAt(0).toUpperCase() + finalExamType.slice(1)}Results${count + 1}`;

         // Get trainer name if trainee has an assigned trainer
         let trainerName = resultData.trainer_name || '';
         if ((!trainerName || trainerName === '') && user.assignedTrainer) {
           const trainer = await User.findOne({ author_id: user.assignedTrainer }).select('name');
           if (trainer) {
             trainerName = trainer.name;
           }
         }
         
         // Create result
         // console.log(`Creating result for ${user.name} with data:`, {
         //   author_id: resultData.author_id,
         //   trainee_name: resultData.trainee_name || user.name,
         //   email: resultData.email || user.email,
         //   exam_type: finalExamType,
         //   result_name,
         //   score,
         //   total_marks,
         //   percentage,
         //   exam_date: new Date(resultData.exam_date || new Date()),
         //   uploaded_by: req.user.id,
         //   status,
         //   remarks: resultData.remarks || '',
         //   department: resultData.department || user.department || '',
         //   trainer_name: trainerName,
         //   batch_name: resultData.batch_name || ''
         // });
         
         let result;
         try {
           result = await Result.create({
             author_id: resultData.author_id,
             trainee_name: resultData.trainee_name || user.name,
             email: resultData.email || user.email,
             exam_type: finalExamType,
             result_name,
             score,
             total_marks,
             percentage,
             exam_date: new Date(resultData.exam_date || new Date()),
             uploaded_by: req.user.id,
             status,
             remarks: resultData.remarks || '',
             department: resultData.department || user.department || '',
             trainer_name: trainerName,
             batch_name: resultData.batch_name || ''
           });
           
           // console.log(`Result created successfully with ID: ${result._id}`);
         } catch (createError) {
           console.error(`Error creating result for ${user.name}:`, createError);
           errors.push(`Row ${i + 1}: Failed to create result - ${createError.message}`);
           continue;
         }

         // console.log(`Created result for ${user.name}:`, {
         //   result_name: result_name,
         //   score: score,
         //   total_marks: total_marks,
         //   percentage: percentage,
         //   status: status
         // });

         // Add to user's appropriate exam array based on exam type
         // console.log(`Checking exam type for user ${user.name}:`, {
         //   finalExamType: finalExamType,
         //   originalExamType: examType,
         //   resultDataExamType: resultData.exam_type,
         //   type: resultData.type,
         //   allResultDataKeys: Object.keys(resultData)
         // });
         
         // Determine which exam array to add to based on the final exam type
         const isFortnightExam = finalExamType.startsWith('fortnight');
         const isDailyExam = finalExamType.startsWith('daily');
         const isCourseExam = finalExamType.startsWith('course');
             
         // console.log(`Is fortnight exam? ${isFortnightExam} for user ${user.name}`);
         
         if (isFortnightExam) {
           const examData = {
             resultId: result._id,
             result_name: result_name,
             score: score,
             total_marks: total_marks,
             percentage: percentage,
             exam_date: result.exam_date,
             status: status,
             uploaded_at: new Date(),
             uploaded_by: req.user.id
           };

           try {
             // console.log(`Attempting to add fortnight exam to user ${user.name} (ID: ${user._id})`);
             // console.log(`Exam data to add:`, examData);
             
             const updatedUser = await User.findByIdAndUpdate(
               user._id,
               { $push: { fortnightExams: examData } },
               { new: true }
             );
             
             if (updatedUser) {
               // console.log(`Successfully added fortnight exam to user ${user.name}'s profile:`, examData);
               // console.log(`Updated user fortnightExams array length:`, updatedUser.fortnightExams.length);
               // console.log(`Updated user fortnightExams array:`, updatedUser.fortnightExams);
             } else {
               console.error(`Failed to update user ${user.name} - updatedUser is null`);
             }
           } catch (updateError) {
             console.error(`Error adding fortnight exam to user ${user.name}:`, updateError);
             console.error(`Update error details:`, updateError.message);
           }
         } else if (isDailyExam) {
           // Add to dailyQuizzes array
           const examData = {
             resultId: result._id,
             result_name: result_name,
             score: score,
             total_marks: total_marks,
             percentage: percentage,
             exam_date: result.exam_date,
             status: status,
             uploaded_at: new Date(),
             uploaded_by: req.user.id
           };

           await User.findByIdAndUpdate(
             user._id,
             { $push: { dailyQuizzes: examData } },
             { new: true }
           );

           // console.log(`Added daily quiz to user ${user.name}'s profile:`, examData);
         } else if (isCourseExam) {
           // Add to courseLevelExams array
           const examData = {
             resultId: result._id,
             result_name: result_name,
             score: score,
             total_marks: total_marks,
             percentage: percentage,
             exam_date: result.exam_date,
             status: status,
             uploaded_at: new Date(),
             uploaded_by: req.user.id
           };

           await User.findByIdAndUpdate(
             user._id,
             { $push: { courseLevelExams: examData } },
             { new: true }
           );

           // console.log(`Added course-level exam to user ${user.name}'s profile:`, examData);
         } else {
           // Fallback: Add to appropriate array based on request examType
           // console.log(`No specific exam type match found, using fallback based on request examType: ${examType}`);
           
           // Re-detect column types for array assignment
           const hasDailyQuizColumn = row.DailyQuizzesResults !== undefined || row.dailyquizzesresults !== undefined;
           const hasCourseLevelColumn = row.CourseLevelExamResults !== undefined || row.courselevelexamresults !== undefined;
           const hasFortnightColumn = row.FortnightEaxmResults !== undefined || row.FortnightExamResults !== undefined || row.FornightEaxmResults !== undefined;
           
           let targetArray = 'fortnightExams'; // Default to fortnight
           if (hasDailyQuizColumn || examType === 'daily' || examType === 'dailyquizzes' || examType === 'dailyquiz') {
             targetArray = 'dailyQuizzes';
           } else if (hasCourseLevelColumn || examType === 'course') {
             targetArray = 'courseLevelExams';
           } else if (hasFortnightColumn || examType === 'fortnight' || examType === 'fornight') {
             targetArray = 'fortnightExams';
           }
           
           const examData = {
             resultId: result._id,
             result_name: result_name,
             score: score,
             total_marks: total_marks,
             percentage: percentage,
             exam_date: result.exam_date,
             status: status,
             uploaded_at: new Date(),
             uploaded_by: req.user.id
           };

           try {
             // console.log(`Attempting to add exam to user ${user.name}'s ${targetArray} array (fallback)`);
             // console.log(`Exam data to add:`, examData);
             
             const updatedUser = await User.findByIdAndUpdate(
               user._id,
               { $push: { [targetArray]: examData } },
               { new: true }
             );
             
             if (updatedUser) {
               // console.log(`Added exam to user ${user.name}'s ${targetArray} array (fallback):`, examData);
               // console.log(`Updated user ${targetArray} array length:`, updatedUser[targetArray].length);
               // console.log(`Updated user ${targetArray} array:`, updatedUser[targetArray]);
             } else {
               console.error(`Failed to update user ${user.name} - updatedUser is null (fallback)`);
             }
           } catch (updateError) {
             console.error(`Error adding exam to user ${user.name}'s ${targetArray} array:`, updateError);
             console.error(`Update error details:`, updateError.message);
           }
         }

         uploadedResults.push(result);
      } catch (error) {
        errors.push(`Row ${i + 1}: ${error.message}`);
      }
    }

    // Determine the appropriate response message
    let message;
    if (uploadedResults.length > 0 && errors.length > 0) {
      message = `Successfully uploaded ${uploadedResults.length} results. ${errors.length} errors occurred.`;
    } else if (uploadedResults.length > 0) {
      message = `Successfully uploaded ${uploadedResults.length} results`;
    } else if (errors.length > 0) {
      message = `Upload failed. ${errors.length} errors occurred.`;
    } else {
      message = `No results to upload`;
    }

    res.json({
      success: uploadedResults.length > 0,
      message: message,
      uploadedCount: uploadedResults.length,
      errorCount: errors.length,
      errors: errors.length > 0 ? errors : undefined,
      results: uploadedResults
    });
  } catch (error) {
    console.error('Error in bulk upload:', error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// @desc    Update result
// @route   PUT /api/results/:id
// @access  Private
const updateResult = async (req, res) => {
  try {
    const { score, total_marks, remarks, status } = req.body;
    
    const result = await Result.findById(req.params.id);
    if (!result) {
      return res.status(404).json({ success: false, message: "Result not found" });
    }

    // Update fields
    if (score !== undefined) result.score = score;
    if (total_marks !== undefined) result.total_marks = total_marks;
    if (remarks !== undefined) result.remarks = remarks;
    if (status !== undefined) result.status = status;

    // Recalculate percentage if score or total_marks changed
    if (score !== undefined || total_marks !== undefined) {
      result.percentage = Math.round((result.score / result.total_marks) * 100);
      
      // Update status based on new percentage
      if (result.percentage >= 60) {
        result.status = 'passed';
      } else {
        result.status = 'failed';
      }
    }

    await result.save();

    res.json({ success: true, result });
  } catch (error) {
    console.error('Error updating result:', error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// @desc    Delete result
// @route   DELETE /api/results/:id
// @access  Private
const deleteResult = async (req, res) => {
  try {
    const result = await Result.findById(req.params.id);
    if (!result) {
      return res.status(404).json({ success: false, message: "Result not found" });
    }

    await Result.findByIdAndDelete(req.params.id);

    res.json({ success: true, message: "Result deleted successfully" });
  } catch (error) {
    console.error('Error deleting result:', error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// @desc    Validate Google Sheets for results upload
// @route   POST /api/results/validate-sheets
// @access  Private
const validateSheets = async (req, res) => {
  try {
    const { spread_sheet_name, data_sets_to_be_loaded, googleSheetUrl } = req.body;

    // console.log('Results validation request:', { spread_sheet_name, data_sets_to_be_loaded, googleSheetUrl });

    if (!spread_sheet_name || !data_sets_to_be_loaded) {
      return res.status(400).json({ 
        success: false,
        message: 'Missing required fields: spread_sheet_name, data_sets_to_be_loaded' 
      });
    }

    let resultsData = [];

    // If Google Sheet URL is provided, try to fetch data
    if (googleSheetUrl && googleSheetUrl.trim()) {
      try {
         // Add subsheet and exam type parameters to the URL
         const examType = data_sets_to_be_loaded[0].toLowerCase().replace('results', '').replace('exam', '');
         const urlWithParams = `${googleSheetUrl}${googleSheetUrl.includes('?') ? '&' : '?'}subsheet=${data_sets_to_be_loaded[0]}&examType=${examType}`;
         // console.log('Fetching results data from Google Sheets:', urlWithParams);
         const response = await axios.get(urlWithParams);
        
        // Check if response is HTML (error page)
        if (typeof response.data === 'string' && response.data.includes('<!DOCTYPE html>')) {
          return res.status(400).json({
            success: false,
            message: 'Google Sheets URL returned HTML instead of JSON. Please check your Apps Script deployment.',
            received: 'HTML',
            suggestion: 'Make sure your Google Apps Script is properly deployed and returns JSON data'
          });
        }

        const sheetData = response.data;

        // Check if response is valid JSON object
        if (typeof sheetData !== 'object' || sheetData === null) {
          return res.status(400).json({
            success: false,
            message: 'Invalid response from Google Sheets. Expected JSON object.',
            received: typeof sheetData,
            data: sheetData
          });
        }

        // Check if the response has the expected structure
        if (sheetData.spread_sheet_name === spread_sheet_name && 
            sheetData.data_sets_to_be_loaded && 
            sheetData.data_sets_to_be_loaded.includes(data_sets_to_be_loaded[0])) {
          
          const rawData = sheetData.data || [];
          // console.log('Raw data from Google Sheet:', rawData);
          // console.log('=== STARTING DATA TRANSFORMATION ===');
          // console.log('Exam type:', examType);
          // console.log('Data length:', rawData.length);
          // console.log('First row sample:', rawData[0]);
          
           // Transform the data to match the expected results format
           resultsData = await Promise.all(rawData.map(async (row, index) => {
             // console.log(`\n=== PROCESSING ROW ${index + 1} ===`);
             // console.log('Raw row data:', row);
             
             // Handle the specific column names from your Google Sheet
             const authorId = row.Author_id || row.author_id || row.AuthorId;
             const date = row.Date || row.date || row.exam_date;
             const type = row.Type || row.type || row.ExamType || row.exam_type;
             // Try multiple variations of the score column name based on exam type
             let score;
             // console.log('=== EXAM TYPE DETECTION ===');
             // console.log('examType parameter:', examType);
             // console.log('type from row:', type);
             // console.log('Row data keys:', Object.keys(row));
             // console.log('=== END EXAM TYPE DETECTION ===');
             
             // Smart detection: Check for specific score columns in the data
             const hasDailyQuizColumn = row.DailyQuizzesResults !== undefined || row.dailyquizzesresults !== undefined;
             const hasCourseLevelColumn = row.CourseLevelExamResults !== undefined || row.courselevelexamresults !== undefined;
             const hasFortnightColumn = row.FortnightEaxmResults !== undefined || row.FortnightExamResults !== undefined || row.FornightEaxmResults !== undefined;
             
             // console.log('Column detection:', { hasDailyQuizColumn, hasCourseLevelColumn, hasFortnightColumn });
             
             if (hasDailyQuizColumn || examType === 'daily' || examType === 'dailyquizzes' || examType === 'dailyquiz') {
               // console.log('=== DAILY QUIZ SCORE MAPPING ===');
               // console.log('Row data:', row);
               // console.log('All row keys:', Object.keys(row));
               
               // Direct mapping for DailyQuizzesResults (try both cases)
               score = row.DailyQuizzesResults || row.dailyquizzesresults;
               // console.log('Direct DailyQuizzesResults value:', row.DailyQuizzesResults);
               // console.log('Direct dailyquizzesresults value:', row.dailyquizzesresults);
               // console.log('Final score value:', score);
               // console.log('Score type:', typeof score);
               
               // If direct mapping fails, try alternative methods
               if (score === undefined || score === null || score === '') {
                 // console.log('Direct mapping failed, trying alternative methods...');
                 
                 // Try to find the score column dynamically
                 const possibleScoreColumns = [
                   'DailyQuizzesResults',
                   'dailyquizzesresults',
                   'DailyQuizResults', 
                   'dailyquizresults',
                   'DailyQuizzes',
                   'dailyquizzes',
                   'DailyQuizResult',
                   'dailyquizresult',
                   'DailyQuiz',
                   'dailyquiz',
                   'DailyResults',
                   'dailyresults',
                   'DailyExams',
                   'dailyexams',
                   'Daily',
                   'daily',
                   'QuizResults',
                   'quizresults',
                   'Quiz',
                   'quiz'
                 ];
                 
                 // console.log('Checking possible score columns:');
                 possibleScoreColumns.forEach(col => {
                   // console.log(`  ${col}:`, row[col]);
                 });
                 
                 // Find the first non-empty score column
                 const foundColumn = possibleScoreColumns.find(col => 
                   row[col] !== undefined && 
                   row[col] !== null && 
                   row[col] !== '' && 
                   !isNaN(parseFloat(row[col]))
                 );
                 
                 if (foundColumn) {
                   score = row[foundColumn];
                   // console.log(`Found score in column: ${foundColumn} = ${score}`);
                 } else {
                   score = row.score || row.Score;
                   // console.log(`No specific column found, using generic score: ${score}`);
                 }
               }
               
               // console.log('Final score value:', score);
               // console.log('Score type:', typeof score);
               // console.log('=== END DAILY QUIZ SCORE MAPPING ===');
             } else if (hasCourseLevelColumn || examType === 'course') {
               // console.log('=== COURSE LEVEL EXAM SCORE MAPPING ===');
               // console.log('Row data:', row);
               // console.log('All row keys:', Object.keys(row));
               // console.log('All row values:', Object.values(row));
               
               // Direct mapping for CourseLevelExamResults (try both cases)
               score = row.CourseLevelExamResults || row.courselevelexamresults;
               // console.log('Direct CourseLevelExamResults value:', row.CourseLevelExamResults);
               // console.log('Direct courselevelexamresults value:', row.courselevelexamresults);
               // console.log('Final score value:', score);
               // console.log('Score type:', typeof score);
               
               // If direct mapping fails, try alternative methods
               if (score === undefined || score === null || score === '') {
                 // console.log('Direct mapping failed, trying alternative methods...');
                 
                 // Try to find the score column dynamically
                 const possibleScoreColumns = [
                   'CourseLevelExamResults',
                   'courselevelexamresults',
                   'CourseLevelResults', 
                   'courselevelresults',
                   'CourseLevelExams',
                   'courselevelexams',
                   'CourseLevelExamResult',
                   'courselevelexamresult',
                   'CourseLevelExam',
                   'courselevelexam',
                   'CourseResults',
                   'courseresults',
                   'CourseExams',
                   'courseexams',
                   'CourseLevel',
                   'courselevel',
                   'Course',
                   'course'
                 ];
                 
                 // console.log('Checking possible score columns:');
                 possibleScoreColumns.forEach(col => {
                   // console.log(`  ${col}:`, row[col]);
                 });
                 
                 // Find the first non-empty score column
                 const foundColumn = possibleScoreColumns.find(col => 
                   row[col] !== undefined && 
                   row[col] !== null && 
                   row[col] !== '' && 
                   !isNaN(parseFloat(row[col]))
                 );
                 
                 if (foundColumn) {
                   score = row[foundColumn];
                   // console.log(`Found score in column: ${foundColumn} = ${score}`);
                 } else {
                   score = row.score || row.Score;
                   // console.log(`No specific column found, using generic score: ${score}`);
                 }
               }
               
               // console.log('Final score value:', score);
               // console.log('Score type:', typeof score);
               // console.log('=== END COURSE LEVEL EXAM SCORE MAPPING ===');
             } else if (hasFortnightColumn || examType === 'fortnight' || examType === 'fornight') {
               // console.log('=== FORTNIGHT EXAM SCORE MAPPING ===');
               score = row.FortnightEaxmResults || 
                       row.FortnightExamResults || 
                       row.FornightEaxmResults || 
                       row.FortnightEaxmResults || 
                       row['FortnightEaxmResults'] || 
                       row['FortnightExamResults'] || 
                       row.score || 
                       row.Score;
               // console.log('Fortnight score value:', score);
               // console.log('=== END FORTNIGHT EXAM SCORE MAPPING ===');
             } else {
               // Fallback: try generic score columns
               // console.log('=== FALLBACK SCORE MAPPING ===');
               score = row.score || row.Score;
               // console.log('Fallback score value:', score);
               // console.log('=== END FALLBACK SCORE MAPPING ===');
             }
             
             // Debug: Check all possible score column variations
             const scoreVariations = {
               'FortnightEaxmResults': row.FortnightEaxmResults,
               'FortnightExamResults': row.FortnightExamResults,
               'FornightEaxmResults': row.FornightEaxmResults,
               'DailyQuizzesResults': row.DailyQuizzesResults,
               'DailyQuizResults': row.DailyQuizResults,
               'CourseLevelExamResults': row.CourseLevelExamResults,
               'CourseLevelResults': row.CourseLevelResults,
               'score': row.score,
               'Score': row.Score
             };
             
             // console.log(`Transforming row ${index + 1}:`, { 
             //   authorId, 
             //   authorIdType: typeof authorId,
             //   authorIdLength: authorId?.toString().length,
             //   date, 
             //   type,
             //   score,
             //   scoreType: typeof score,
             //   scoreValue: score,
             //   originalRow: row,
             //   allKeys: Object.keys(row),
             //   scoreVariations: scoreVariations,
             //   allColumnValues: {
             //     'Author_id': row.Author_id,
             //     'Date': row.Date,
             //     'Type': row.Type,
             //     'FortnightEaxmResults': row.FortnightEaxmResults,
             //     'FortnightExamResults': row.FortnightExamResults,
             //     'CourseLevelExamResults': row.CourseLevelExamResults,
             //     'DailyQuizzesResults': row.DailyQuizzesResults
             //   }
             // });
             
             // Try to find user during validation to populate trainee_name and email
             let trainee_name = '';
             let email = '';
             
             if (authorId) {
               try {
                 // First try exact match
                 let user = await User.findOne({ author_id: authorId });
                 
                 // If not found and author_id looks truncated, try partial match
                 if (!user && authorId.length < 36) {
                   // console.log(`Trying partial match for truncated author_id: ${authorId}`);
                   user = await User.findOne({ 
                     author_id: { $regex: `^${authorId}`, $options: 'i' } 
                   });
                 }
                 
                 if (user) {
                   trainee_name = user.name;
                   email = user.email;
                   // console.log(`Found user during validation: ${user.name} (${user.email}) with author_id: ${user.author_id}`);
                 } else {
                   // console.log(`User not found during validation for author_id: ${authorId}`);
                   
                   // Let's also search for any user with similar author_id for debugging
                   const similarUsers = await User.find({ 
                     author_id: { $regex: authorId.substring(0, 8), $options: 'i' } 
                   }).limit(3);
                   // console.log(`Similar users found:`, similarUsers.map(u => ({ 
                   //   author_id: u.author_id,
                   //   name: u.name,
                   //   email: u.email
                   // })));
                 }
               } catch (err) {
                 // console.log(`Error during validation lookup: ${err.message}`);
               }
             }
             
             // Parse score properly - handle 0 as a valid score
             let parsedScore = 0;
             if (score !== null && score !== undefined && score !== '') {
               parsedScore = parseFloat(score);
               if (isNaN(parsedScore)) {
                 parsedScore = 0;
               }
             } else {
               // If no score found, try to find it in the original row data
               // console.log(`No score found for row ${index + 1}, trying alternative methods...`);
               let alternativeScore;
               if (examType === 'daily') {
                 alternativeScore = row[Object.keys(row).find(key => 
                   key.toLowerCase().includes('daily') && 
                   key.toLowerCase().includes('result')
                 )];
               } else if (examType === 'course') {
                 alternativeScore = row[Object.keys(row).find(key => 
                   key.toLowerCase().includes('course') && 
                   key.toLowerCase().includes('result')
                 )];
               } else {
                 alternativeScore = row[Object.keys(row).find(key => 
                   key.toLowerCase().includes('fortnight') && 
                   key.toLowerCase().includes('result')
                 )];
               }
               if (alternativeScore !== undefined && alternativeScore !== null && alternativeScore !== '') {
                 parsedScore = parseFloat(alternativeScore);
                 if (isNaN(parsedScore)) {
                   parsedScore = 0;
                 }
                 // console.log(`Found alternative score: ${parsedScore}`);
               }
             }

             const transformedData = {
               author_id: authorId,
               trainee_name: trainee_name,
               email: email,
               score: parsedScore,
               total_marks: 100, // Default to 100, can be made configurable
               exam_date: date,
               exam_type: type || examType, // Use type from sheet or fallback to examType
               remarks: '',
               department: '',
               trainer_name: '',
               batch_name: ''
             };
             
             // console.log(`=== FINAL TRANSFORMED DATA FOR ROW ${index + 1} ===`);
             // console.log('Original score from mapping:', score);
             // console.log('Parsed score:', parsedScore);
             // console.log('Final transformed data:', transformedData);
             // console.log('=== END FINAL TRANSFORMED DATA ===');
             
             return transformedData;
           }));
          
          // console.log('Successfully fetched and transformed results data:', resultsData.length, 'records');
        } else {
          return res.status(400).json({
            success: false,
            message: 'Spreadsheet name or dataset mismatch',
            expected: { spread_sheet_name, data_sets_to_be_loaded },
            received: { 
              spread_sheet_name: sheetData.spread_sheet_name, 
              data_sets_to_be_loaded: sheetData.data_sets_to_be_loaded 
            }
          });
        }
      } catch (error) {
        console.error('Error fetching from Google Sheets:', error);
        return res.status(400).json({
          success: false,
          message: 'Failed to fetch data from Google Sheets',
          error: error.message
        });
      }
    } else {
      // If no Google Sheet URL, return mock data for testing
      // console.log('No Google Sheet URL provided, using mock data');
      resultsData = [
        {
          author_id: "AUTH001",
          trainee_name: "John Doe",
          email: "john.doe@example.com",
          score: 85,
          total_marks: 100,
          exam_date: "2025-09-27",
          remarks: "Good performance",
          department: "Engineering",
          trainer_name: "Trainer 1",
          batch_name: "Batch A"
        },
        {
          author_id: "AUTH002", 
          trainee_name: "Jane Smith",
          email: "jane.smith@example.com",
          score: 92,
          total_marks: 100,
          exam_date: "2025-09-27",
          remarks: "Excellent performance",
          department: "Engineering", 
          trainer_name: "Trainer 1",
          batch_name: "Batch A"
        }
      ];
    }

    res.json({
      success: true,
      message: "Configuration validated successfully!",
      spread_sheet_name: spread_sheet_name,
      data_sets_to_be_loaded: data_sets_to_be_loaded,
      data: resultsData
    });
  } catch (error) {
    console.error('Error validating sheets:', error);
    res.status(500).json({ 
      success: false, 
      message: "Server error", 
      error: error.message 
    });
  }
};

// @desc    Get user's exam data for debugging
// @route   GET /api/results/debug-user/:authorId
// @access  Private
const debugUserExams = async (req, res) => {
  try {
    const { authorId } = req.params;
    
    const user = await User.findOne({ author_id: authorId });
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    
    res.json({
      success: true,
      user: {
        name: user.name,
        email: user.email,
        author_id: user.author_id,
        fortnightExams: user.fortnightExams || [],
        dailyQuizzes: user.dailyQuizzes || [],
        courseLevelExams: user.courseLevelExams || []
      }
    });
  } catch (error) {
    console.error('Error debugging user exams:', error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// @desc    Get exam statistics for Reports & Statistics
// @route   GET /api/results/statistics
// @access  Private
const getExamStatistics = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    // Build date filter
    let dateFilter = {};
    if (startDate && endDate) {
      dateFilter.exam_date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    // Get all results with date filter
    const results = await Result.find(dateFilter).select('exam_type score total_marks percentage status exam_date trainee_name trainer_name');

    // Group results by exam type
    const examTypeStats = {};
    
    results.forEach(result => {
      const examType = result.exam_type;
      
      if (!examTypeStats[examType]) {
        examTypeStats[examType] = {
          examType: examType,
          totalAttempts: 0,
          totalScore: 0,
          passedAttempts: 0,
          failedAttempts: 0,
          averageScore: 0,
          passRate: 0,
          results: []
        };
      }
      
      examTypeStats[examType].totalAttempts++;
      examTypeStats[examType].totalScore += result.percentage;
      examTypeStats[examType].results.push({
        trainee_name: result.trainee_name,
        trainer_name: result.trainer_name,
        score: result.score,
        total_marks: result.total_marks,
        percentage: result.percentage,
        status: result.status,
        exam_date: result.exam_date
      });
      
      if (result.status === 'passed') {
        examTypeStats[examType].passedAttempts++;
      } else {
        examTypeStats[examType].failedAttempts++;
      }
    });

    // Calculate averages and pass rates
    Object.keys(examTypeStats).forEach(examType => {
      const stats = examTypeStats[examType];
      stats.averageScore = stats.totalAttempts > 0 ? Math.round(stats.totalScore / stats.totalAttempts) : 0;
      stats.passRate = stats.totalAttempts > 0 ? Math.round((stats.passedAttempts / stats.totalAttempts) * 100) : 0;
    });

    // Categorize by exam type groups
    const dailyQuizzes = Object.keys(examTypeStats)
      .filter(type => type.startsWith('daily'))
      .map(type => examTypeStats[type])
      .sort((a, b) => a.examType.localeCompare(b.examType));

    const fortnightExams = Object.keys(examTypeStats)
      .filter(type => type.startsWith('fortnight'))
      .map(type => examTypeStats[type])
      .sort((a, b) => a.examType.localeCompare(b.examType));

    const courseLevelExams = Object.keys(examTypeStats)
      .filter(type => type.startsWith('course'))
      .map(type => examTypeStats[type])
      .sort((a, b) => a.examType.localeCompare(b.examType));

    // Calculate overall statistics
    const totalAttempts = results.length;
    const totalPassed = results.filter(r => r.status === 'passed').length;
    const overallPassRate = totalAttempts > 0 ? Math.round((totalPassed / totalAttempts) * 100) : 0;
    const overallAverageScore = totalAttempts > 0 ? Math.round(results.reduce((sum, r) => sum + r.percentage, 0) / totalAttempts) : 0;

    // Get top performers (top 10 by average score)
    const traineeStats = {};
    results.forEach(result => {
      if (!traineeStats[result.trainee_name]) {
        traineeStats[result.trainee_name] = {
          name: result.trainee_name,
          totalAttempts: 0,
          totalScore: 0,
          passedAttempts: 0,
          averageScore: 0
        };
      }
      
      traineeStats[result.trainee_name].totalAttempts++;
      traineeStats[result.trainee_name].totalScore += result.percentage;
      if (result.status === 'passed') {
        traineeStats[result.trainee_name].passedAttempts++;
      }
    });

    // Calculate trainee averages
    Object.keys(traineeStats).forEach(trainee => {
      const stats = traineeStats[trainee];
      stats.averageScore = Math.round(stats.totalScore / stats.totalAttempts);
    });

    // Get top 10 performers
    const topPerformers = Object.values(traineeStats)
      .sort((a, b) => b.averageScore - a.averageScore)
      .slice(0, 10);

    res.json({
      success: true,
      statistics: {
        overall: {
          totalAttempts,
          totalPassed,
          overallPassRate,
          overallAverageScore
        },
        byExamType: {
          dailyQuizzes,
          fortnightExams,
          courseLevelExams
        },
        topPerformers,
        summary: {
          dailyQuizzes: {
            totalTypes: dailyQuizzes.length,
            totalAttempts: dailyQuizzes.reduce((sum, exam) => sum + exam.totalAttempts, 0),
            averageScore: dailyQuizzes.length > 0 ? Math.round(dailyQuizzes.reduce((sum, exam) => sum + exam.averageScore, 0) / dailyQuizzes.length) : 0,
            passRate: dailyQuizzes.length > 0 ? Math.round(dailyQuizzes.reduce((sum, exam) => sum + exam.passRate, 0) / dailyQuizzes.length) : 0
          },
          fortnightExams: {
            totalTypes: fortnightExams.length,
            totalAttempts: fortnightExams.reduce((sum, exam) => sum + exam.totalAttempts, 0),
            averageScore: fortnightExams.length > 0 ? Math.round(fortnightExams.reduce((sum, exam) => sum + exam.averageScore, 0) / fortnightExams.length) : 0,
            passRate: fortnightExams.length > 0 ? Math.round(fortnightExams.reduce((sum, exam) => sum + exam.passRate, 0) / fortnightExams.length) : 0
          },
          courseLevelExams: {
            totalTypes: courseLevelExams.length,
            totalAttempts: courseLevelExams.reduce((sum, exam) => sum + exam.totalAttempts, 0),
            averageScore: courseLevelExams.length > 0 ? Math.round(courseLevelExams.reduce((sum, exam) => sum + exam.averageScore, 0) / courseLevelExams.length) : 0,
            passRate: courseLevelExams.length > 0 ? Math.round(courseLevelExams.reduce((sum, exam) => sum + exam.passRate, 0) / courseLevelExams.length) : 0
          }
        }
      }
    });
  } catch (error) {
    console.error('Error fetching exam statistics:', error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

module.exports = {
  getResults,
  getResultById,
  createResult,
  bulkUploadResults,
  updateResult,
  deleteResult,
  validateSheets,
  debugUserExams,
  getExamStatistics
};
