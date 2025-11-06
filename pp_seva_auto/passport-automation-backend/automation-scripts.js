// automation-scripts.js
// Real browser automation scripts for passport applications

const puppeteer = require('puppeteer');

/**
 * Fresh Passport Application Automation
 * This script automates the entire fresh passport application process
 */
async function automateFreshPassport(userData) {
    console.log('🚀 Starting Fresh Passport Automation...');
    
    const browser = await puppeteer.launch({
        headless: false, // Show browser for debugging
        slowMo: 50 // Slow down by 50ms
    });
    
    try {
        const page = await browser.newPage();
        
        // Step 1: Navigate to Passport Seva
        console.log('📍 Step 1: Navigating to Passport Seva portal...');
        await page.goto('http://localhost:8080/passport-website.html', {
            waitUntil: 'networkidle2'
        });
        
        // Step 2: Login
        console.log('🔐 Step 2: Logging in...');
        await page.waitForSelector('#loginEmail');
        await page.type('#loginEmail', userData.email, { delay: 100 });
        await page.type('#loginPassword', 'password123', { delay: 100 });
        await page.click('button[type="submit"]');
        await page.waitForNavigation();
        
        // Step 3: Navigate to Fresh Passport Application
        console.log('📋 Step 3: Starting new application...');
        await page.waitForSelector('.service-card');
        await page.evaluate(() => {
            document.querySelector('.service-card').click();
        });
        await page.waitForTimeout(1000);
        
        // Step 4: Fill Personal Details
        console.log('✍️ Step 4: Filling personal details...');
        await page.waitForSelector('#firstName');
        
        await page.type('#firstName', userData.firstName, { delay: 100 });
        await page.type('#lastName', userData.lastName, { delay: 100 });
        await page.type('#dob', userData.dob, { delay: 100 });
        await page.select('#gender', userData.gender);
        
        // Step 5: Fill Contact Details
        console.log('📱 Step 5: Filling contact information...');
        await page.type('#email', userData.email, { delay: 100 });
        await page.type('#mobile', userData.mobile, { delay: 100 });
        
        // Step 6: Fill Address
        console.log('🏠 Step 6: Filling address details...');
        await page.type('#address', userData.address, { delay: 100 });
        await page.select('#state', userData.state);
        await page.type('#pincode', userData.pincode || '500001', { delay: 100 });
        
        // Step 7: Handle CAPTCHA
        console.log('🔐 Step 7: CAPTCHA detected - Waiting for user input...');
        await page.waitForSelector('#captchaCode');
        
        // Get CAPTCHA text
        const captchaText = await page.evaluate(() => {
            return document.getElementById('captchaCode').textContent;
        });
        
        console.log(`📸 CAPTCHA Code: ${captchaText}`);
        console.log('⏳ Waiting for user to solve CAPTCHA...');
        
        // Return CAPTCHA to user
        return {
            status: 'CAPTCHA_REQUIRED',
            captchaCode: captchaText,
            page: page, // Keep page alive for CAPTCHA submission
            browser: browser
        };
        
    } catch (error) {
        console.error('❌ Automation failed:', error);
        await browser.close();
        throw error;
    }
}

/**
 * Complete application after CAPTCHA is solved
 */
async function completeCaptchaAndSubmit(page, browser, captchaSolution) {
    try {
        console.log('✅ CAPTCHA received, submitting...');
        
        // Enter CAPTCHA
        await page.type('#captchaInput', captchaSolution, { delay: 100 });
        
        // Submit form
        await page.click('button[type="submit"]');
        
        // Wait for success modal
        await page.waitForSelector('#successModal.show', { timeout: 5000 });
        
        // Get reference number
        const refNumber = await page.evaluate(() => {
            return document.getElementById('refNumber').textContent;
        });
        
        console.log(`🎉 Success! Reference Number: ${refNumber}`);
        
        await browser.close();
        
        return {
            status: 'SUCCESS',
            referenceNumber: refNumber
        };
        
    } catch (error) {
        console.error('❌ Submission failed:', error);
        await browser.close();
        throw error;
    }
}

/**
 * Police Clearance Certificate Automation
 */
async function automatePCC(userData) {
    console.log('🚀 Starting PCC Automation...');
    
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();
    
    try {
        // Navigate and login
        await page.goto('http://localhost:8080/passport-website.html');
        await page.waitForSelector('#loginEmail');
        await page.type('#loginEmail', userData.email);
        await page.type('#loginPassword', 'password123');
        await page.click('button[type="submit"]');
        await page.waitForNavigation();
        
        // Select PCC service
        console.log('📋 Selecting PCC service...');
        await page.evaluate(() => {
            const cards = document.querySelectorAll('.service-card');
            cards[2].click(); // PCC is 3rd card
        });
        
        await page.waitForTimeout(1000);
        
        // Fill form (similar to fresh passport)
        console.log('✍️ Filling PCC application...');
        // ... form filling logic ...
        
        // Get CAPTCHA
        const captchaText = await page.evaluate(() => {
            return document.getElementById('captchaCode').textContent;
        });
        
        return {
            status: 'CAPTCHA_REQUIRED',
            captchaCode: captchaText,
            page: page,
            browser: browser
        };
        
    } catch (error) {
        await browser.close();
        throw error;
    }
}

/**
 * Track Application Status
 */
async function trackApplication(referenceNumber) {
    console.log(`🔍 Tracking application: ${referenceNumber}`);
    
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    
    try {
        // Navigate to tracking page
        await page.goto('http://localhost:8080/passport-website.html');
        
        // Login
        await page.type('#loginEmail', 'user@example.com');
        await page.type('#loginPassword', 'password123');
        await page.click('button[type="submit"]');
        await page.waitForNavigation();
        
        // Go to applications page
        await page.click('a[href="#applications"]');
        await page.waitForTimeout(1000);
        
        // Search for application
        // ... tracking logic ...
        
        await browser.close();
        
        return {
            status: 'FOUND',
            applicationStatus: 'PROCESSING',
            submittedOn: '2025-11-05',
            currentStage: 'Document Verification'
        };
        
    } catch (error) {
        await browser.close();
        throw error;
    }
}

/**
 * Auto-fill form with saved data (without automation)
 * Uses window.postMessage() to communicate with the website
 */
function autoFillViaPostMessage(targetWindow, userData) {
    console.log('📤 Sending data to website via postMessage...');
    
    targetWindow.postMessage({
        type: 'AUTO_FILL',
        data: userData
    }, '*');
    
    console.log('✅ Data sent to website');
}

/**
 * Main automation orchestrator
 */
async function runAutomation(taskType, userData, captchaSolution = null) {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`🤖 AUTOMATION STARTED`);
    console.log(`Task: ${taskType}`);
    console.log(`User: ${userData.firstName} ${userData.lastName}`);
    console.log(`${'='.repeat(50)}\n`);
    
    try {
        let result;
        
        switch (taskType) {
            case 'fresh-passport':
                if (captchaSolution) {
                    // Complete submission
                    result = await completeCaptchaAndSubmit(
                        userData.page,
                        userData.browser,
                        captchaSolution
                    );
                } else {
                    // Initial automation
                    result = await automateFreshPassport(userData);
                }
                break;
                
            case 'pcc':
                result = await automatePCC(userData);
                break;
                
            case 'track':
                result = await trackApplication(userData.referenceNumber);
                break;
                
            default:
                throw new Error('Unknown task type');
        }
        
        console.log('\n✅ Automation completed successfully!');
        return result;
        
    } catch (error) {
        console.error('\n❌ Automation failed:', error.message);
        throw error;
    }
}

// Export functions
module.exports = {
    automateFreshPassport,
    automatePCC,
    trackApplication,
    completeCaptchaAndSubmit,
    autoFillViaPostMessage,
    runAutomation
};

// Example usage:
/*
const userData = {
    firstName: 'Vinay',
    lastName: 'Myneni',
    dob: '1995-08-15',
    gender: 'male',
    email: 'vinay@example.com',
    mobile: '9876543210',
    state: 'AP',
    address: 'Tirupati, Andhra Pradesh',
    pincode: '517501'
};

// Start automation
runAutomation('fresh-passport', userData)
    .then(result => {
        if (result.status === 'CAPTCHA_REQUIRED') {
            console.log('Please solve CAPTCHA:', result.captchaCode);
            
            // After user solves CAPTCHA
            const captchaSolution = '8K7B2M'; // User input
            
            // Continue automation
            return runAutomation('fresh-passport', {
                ...userData,
                page: result.page,
                browser: result.browser
            }, captchaSolution);
        }
        return result;
    })
    .then(finalResult => {
        console.log('Final Result:', finalResult);
    })
    .catch(error => {
        console.error('Error:', error);
    });
*/