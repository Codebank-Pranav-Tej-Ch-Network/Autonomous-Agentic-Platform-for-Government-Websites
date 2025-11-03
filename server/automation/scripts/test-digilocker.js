/**
 * DigiLocker Automation Test Script
 */

require('dotenv').config({ path: '../../.env' });

const executeDigiLocker = require('./digilocker');

function createMockTask() {
  const inputData = new Map();
  inputData.set('aadhaar', '123456789012');
  inputData.set('documentType', 'driving_license');

  return {
    _id: 'test-digilocker-' + Date.now(),
    taskType: 'digilocker_download',
    inputData: inputData,
    user: 'test-user-id',
    status: 'processing'
  };
}

function handleProgress(progressData) {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`[${timestamp}] Progress: ${progressData.percentage}% - ${progressData.message}`);
}

async function runTest() {
  console.log('='.repeat(80));
  console.log('DIGILOCKER AUTOMATION TEST');
  console.log('='.repeat(80));
  console.log('');

  const mockPortalUrl = process.env.MOCK_DIGILOCKER_URL || 'http://localhost:4002';
  console.log(`📍 Mock Portal URL: ${mockPortalUrl}`);
  console.log(`🎭 Headless Mode: ${process.env.HEADLESS !== 'false' ? 'Yes' : 'No'}`);
  console.log('');

  const mockTask = createMockTask();
  console.log('Mock Task Created:');
  console.log(`  Aadhaar: ${mockTask.inputData.get('aadhaar')}`);
  console.log(`  Document Type: ${mockTask.inputData.get('documentType')}`);
  console.log('');

  const startTime = Date.now();

  try {
    const result = await executeDigiLocker(mockTask, handleProgress);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('');
    console.log('✅ AUTOMATION COMPLETED SUCCESSFULLY!');
    console.log(`Duration: ${duration} seconds`);
    console.log('Result:', JSON.stringify(result, null, 2));
    
    process.exit(0);

  } catch (error) {
    console.error('');
    console.error('❌ AUTOMATION FAILED');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

if (require.main === module) {
  setTimeout(runTest, 1000);
}

module.exports = runTest;
