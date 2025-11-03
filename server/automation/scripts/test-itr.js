/**
 * ITR Filing Automation Test Script
 * 
 * This is a standalone test script that lets you run the ITR filing
 * automation without needing the full application stack (database,
 * API server, queue system, etc.)
 * 
 * WHY THIS IS USEFUL:
 * - Debug automation logic in isolation
 * - See the browser in action (run non-headless)
 * - Test different scenarios quickly
 * - Verify the mock portal is working correctly
 * - Develop automation scripts before backend is ready
 * 
 * HOW TO USE:
 * 1. Make sure your mock Income Tax portal is running on port 4001
 * 2. Set HEADLESS=false to watch the automation happen
 * 3. Run: HEADLESS=false node test-itr.js
 * 4. Watch the magic happen in the browser window
 */

// We need to load environment variables even in test scripts
require('dotenv').config({ path: '../../.env' });

const path = require('path');

// Import the automation function we want to test
const executeITRFiling = require('./itrFiling');

/**
 * Create Mock Task Data
 * 
 * The automation script expects a task object with certain properties.
 * Since we're not loading from the database, we create a mock task
 * that has the same structure a real database task would have.
 * 
 * This is like creating a practice form before filling out the real one.
 */
function createMockTask() {
  // Create a Map to hold input data (this is what the real Task model uses)
  const inputData = new Map();
  
  // Fill in the required data for ITR filing
  inputData.set('pan', 'ABCDE1234F');
  inputData.set('financialYear', '2023-24');
  inputData.set('income', '800000');
  inputData.set('deductions', {
    section80C: '150000',
    section80D: '25000'
  });
  inputData.set('name', 'Test User');
  inputData.set('email', 'test@example.com');

  // Create a mock task object that looks like a Mongoose document
  const mockTask = {
    _id: 'test-task-' + Date.now(),
    taskType: 'itr_filing',
    inputData: inputData,
    user: 'test-user-id',
    status: 'processing',
    // Add any other fields your automation script might use
  };

  return mockTask;
}

/**
 * Progress Callback Handler
 * 
 * The automation script calls this function to report progress.
 * In the real application, this would update the database and emit
 * WebSocket events. For testing, we just log to the console.
 * 
 * This lets you see what's happening step by step.
 */
function handleProgress(progressData) {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`[${timestamp}] Progress: ${progressData.percentage}% - ${progressData.message}`);
  
  // You could also write this to a file for later analysis
  // or do more sophisticated logging
}

/**
 * Main Test Function
 * 
 * This orchestrates the entire test - creates mock data, runs the
 * automation, handles results, and catches errors.
 */
async function runTest() {
  console.log('='.repeat(80));
  console.log('ITR FILING AUTOMATION TEST');
  console.log('='.repeat(80));
  console.log('');

  // Check if mock portal URL is configured
  const mockPortalUrl = process.env.MOCK_IT_PORTAL_URL || 'http://localhost:4001';
  console.log(`📍 Mock Portal URL: ${mockPortalUrl}`);
  console.log(`🎭 Headless Mode: ${process.env.HEADLESS !== 'false' ? 'Yes' : 'No'}`);
  console.log('');

  // Warn user if running in headless mode
  if (process.env.HEADLESS !== 'false') {
    console.log('💡 TIP: To watch the automation happen, run with:');
    console.log('   HEADLESS=false node test-itr.js');
    console.log('');
  }

  // Wait a moment so user can read the setup info
  await new Promise(resolve => setTimeout(resolve, 2000));

  console.log('Creating mock task data...');
  const mockTask = createMockTask();
  
  console.log('Mock Task Created:');
  console.log(`  Task ID: ${mockTask._id}`);
  console.log(`  PAN: ${mockTask.inputData.get('pan')}`);
  console.log(`  Financial Year: ${mockTask.inputData.get('financialYear')}`);
  console.log(`  Income: ₹${mockTask.inputData.get('income')}`);
  console.log('');

  console.log('Starting ITR filing automation...');
  console.log('-'.repeat(80));
  console.log('');

  const startTime = Date.now();

  try {
    // Run the automation script
    const result = await executeITRFiling(mockTask, handleProgress);

    // Calculate how long it took
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('');
    console.log('-'.repeat(80));
    console.log('✅ AUTOMATION COMPLETED SUCCESSFULLY!');
    console.log('-'.repeat(80));
    console.log('');
    console.log('Results:');
    console.log(`  Success: ${result.success}`);
    console.log(`  Duration: ${duration} seconds`);
    
    if (result.data.acknowledgementNumber) {
      console.log(`  Acknowledgement Number: ${result.data.acknowledgementNumber}`);
    }
    
    if (result.files && result.files.length > 0) {
      console.log(`  Files Generated: ${result.files.length}`);
      result.files.forEach((file, index) => {
        console.log(`    ${index + 1}. ${file.filename} (${file.type})`);
      });
    }
    
    if (result.screenshots && result.screenshots.length > 0) {
      console.log(`  Screenshots Captured: ${result.screenshots.length}`);
      result.screenshots.forEach((screenshot, index) => {
        console.log(`    ${index + 1}. ${screenshot.name} at ${screenshot.timestamp.toLocaleTimeString()}`);
      });
    }

    console.log('');
    console.log('Full Result Object:');
    console.log(JSON.stringify(result, null, 2));
    console.log('');
    console.log('='.repeat(80));

    // Exit with success code
    process.exit(0);

  } catch (error) {
    // Calculate how long it took before failing
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('');
    console.log('-'.repeat(80));
    console.log('❌ AUTOMATION FAILED');
    console.log('-'.repeat(80));
    console.log('');
    console.log(`Duration before failure: ${duration} seconds`);
    console.log('');
    console.log('Error Details:');
    console.log(`  Message: ${error.message}`);
    console.log(`  Code: ${error.code || 'UNKNOWN'}`);
    
    if (error.recoverable !== undefined) {
      console.log(`  Recoverable: ${error.recoverable ? 'Yes' : 'No'}`);
    }
    
    console.log('');
    console.log('Full Stack Trace:');
    console.log(error.stack);
    console.log('');
    
    // Provide helpful debugging hints based on the error
    console.log('Debugging Hints:');
    if (error.message.includes('timeout') || error.message.includes('navigation')) {
      console.log('  ⚠️  This looks like a navigation or timeout error');
      console.log('  → Is the mock portal running? Check: curl http://localhost:4001');
      console.log('  → Try increasing timeout in automation script');
      console.log('  → Run non-headless to see what\'s happening: HEADLESS=false node test-itr.js');
    } else if (error.message.includes('selector') || error.message.includes('element')) {
      console.log('  ⚠️  This looks like an element selector error');
      console.log('  → The automation couldn\'t find an expected element on the page');
      console.log('  → Check if the mock portal HTML structure matches what the script expects');
      console.log('  → Run non-headless to see the actual page state');
    } else if (error.message.includes('ECONNREFUSED')) {
      console.log('  ⚠️  Connection refused - the mock portal isn\'t responding');
      console.log('  → Make sure the mock portal is running: cd mock-portals/income-tax && node app.js');
      console.log('  → Check the port number in your .env file');
    } else {
      console.log('  → Run with HEADLESS=false to see what\'s happening in the browser');
      console.log('  → Check the screenshots folder for visual clues');
      console.log('  → Review the automation script logs above');
    }
    
    console.log('');
    console.log('='.repeat(80));

    // Exit with error code
    process.exit(1);
  }
}

/**
 * Handle uncaught errors gracefully
 * This prevents ugly stack traces and gives cleaner error messages
 */
process.on('unhandledRejection', (reason, promise) => {
  console.error('');
  console.error('💥 Unhandled Promise Rejection:');
  console.error(reason);
  console.error('');
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('');
  console.error('💥 Uncaught Exception:');
  console.error(error);
  console.error('');
  process.exit(1);
});

// Check if this script is being run directly (not imported as a module)
if (require.main === module) {
  console.log('');
  console.log('Starting test in 2 seconds...');
  console.log('Press Ctrl+C to cancel');
  console.log('');
  
  // Give user a moment to read the message
  setTimeout(() => {
    runTest();
  }, 2000);
}

// Also export the test function so it can be used by other scripts
module.exports = runTest;
