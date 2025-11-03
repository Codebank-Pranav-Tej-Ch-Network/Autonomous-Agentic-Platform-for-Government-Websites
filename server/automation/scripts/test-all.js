/**
 * Master Test Script
 * 
 * Runs all automation tests sequentially.
 * This is useful for verifying that all your automation scripts work
 * after making changes to the codebase.
 */

require('dotenv').config({ path: '../../.env' });

const testITR = require('./test-itr');
const testDigiLocker = require('./test-digilocker');
const testEPFO = require('./test-epfo');

async function runAllTests() {
  console.log('');
  console.log('🧪 RUNNING ALL AUTOMATION TESTS');
  console.log('='.repeat(80));
  console.log('');

  const results = {
    passed: 0,
    failed: 0,
    tests: []
  };

  // Test 1: ITR Filing
  console.log('Test 1 of 3: ITR Filing');
  try {
    await testITR();
    results.passed++;
    results.tests.push({ name: 'ITR Filing', status: 'PASSED' });
  } catch (error) {
    results.failed++;
    results.tests.push({ name: 'ITR Filing', status: 'FAILED', error: error.message });
  }

  console.log('');
  console.log('Waiting 3 seconds before next test...');
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Test 2: DigiLocker
  console.log('Test 2 of 3: DigiLocker');
  try {
    await testDigiLocker();
    results.passed++;
    results.tests.push({ name: 'DigiLocker', status: 'PASSED' });
  } catch (error) {
    results.failed++;
    results.tests.push({ name: 'DigiLocker', status: 'FAILED', error: error.message });
  }

  console.log('');
  console.log('Waiting 3 seconds before next test...');
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Test 3: EPFO
  console.log('Test 3 of 3: EPFO');
  try {
    await testEPFO();
    results.passed++;
    results.tests.push({ name: 'EPFO', status: 'PASSED' });
  } catch (error) {
    results.failed++;
    results.tests.push({ name: 'EPFO', status: 'FAILED', error: error.message });
  }

  // Summary
  console.log('');
  console.log('='.repeat(80));
  console.log('TEST SUMMARY');
  console.log('='.repeat(80));
  console.log('');
  
  results.tests.forEach((test, index) => {
    const icon = test.status === 'PASSED' ? '✅' : '❌';
    console.log(`${icon} ${index + 1}. ${test.name}: ${test.status}`);
    if (test.error) {
      console.log(`   Error: ${test.error}`);
    }
  });

  console.log('');
  console.log(`Total: ${results.passed + results.failed} tests`);
  console.log(`Passed: ${results.passed}`);
  console.log(`Failed: ${results.failed}`);
  console.log('');

  process.exit(results.failed > 0 ? 1 : 0);
}

if (require.main === module) {
  runAllTests();
}
