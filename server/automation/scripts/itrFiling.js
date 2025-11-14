/**
 * ITR Filing Automation Script - CORRECTED VERSION
 * 
 * This version is specifically aligned with the mock Income Tax portal structure
 * we created. Every selector has been verified to match the actual HTML elements
 * in the portal pages.
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs').promises;
const logger = require('../../utils/logger');
const EventEmitter = require('events');

class ITRFilingAutomation extends EventEmitter {
  constructor(taskData) {
    super();
    this.taskData = taskData;
    this.inputData = taskData.inputData;
    this.browser = null;
    this.page = null;
    this.context = null;
    
    this.result = {
      success: false,
      data: {},
      screenshots: [],
      files: []
    };
    
    this.config = {
      headless: process.env.HEADLESS !== 'false',
      slowMo: parseInt(process.env.SLOW_MO) || 0,
      timeout: 30000,
      mockPortalUrl: process.env.MOCK_IT_PORTAL_URL || 'http://localhost:4001'
    };
  }

  async execute() {
    try {
      this.emitProgress('Initializing browser', 10);
      await this.initializeBrowser();
      
      this.emitProgress('Navigating to Income Tax portal', 20);
      await this.navigateToPortal();
      
      this.emitProgress('Logging in', 30);
      await this.login();
      
      this.emitProgress('Navigating to ITR filing section', 40);
      await this.navigateToITRForm();
      
      this.emitProgress('Filling ITR form', 60);
      await this.fillITRForm();
      
      this.emitProgress('Submitting ITR', 80);
      await this.submitForm();
      
      this.emitProgress('Downloading acknowledgement', 90);
      await this.downloadAcknowledgement();
      
      this.emitProgress('ITR filing completed successfully', 100);
      this.result.success = true;
      
      return this.result;
      
    } catch (error) {
      await this.captureScreenshot('error');
      logger.error('ITR filing automation failed:', error);
      throw {
        code: error.code || 'ITR_FILING_FAILED',
        message: error.message,
        stack: error.stack,
        recoverable: this.determineRecoverability(error)
      };
    } finally {
      await this.cleanup();
    }
  }

  async initializeBrowser() {
    try {
      this.browser = await chromium.launch({
        headless: this.config.headless,
        slowMo: this.config.slowMo,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage'
        ]
      });
      
      this.context = await this.browser.newContext({
        viewport: { width: 1920, height: 1080 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        locale: 'en-IN',
        timezoneId: 'Asia/Kolkata'
      });
      
      this.page = await this.context.newPage();
      this.page.setDefaultTimeout(this.config.timeout);
      
      this.page.on('console', msg => logger.debug(`Browser console: ${msg.text()}`));
      this.page.on('pageerror', error => logger.error('Page error:', error));
      
      logger.info('Browser initialized successfully');
      
    } catch (error) {
      throw new Error(`Failed to initialize browser: ${error.message}`);
    }
  }

  async navigateToPortal() {
    try {
      await this.page.goto(this.config.mockPortalUrl, {
        waitUntil: 'networkidle',
        timeout: this.config.timeout
      });
      
      // Verify we're on the correct page by looking for the Income Tax Department heading
      await this.page.waitForSelector('h1:has-text("Income Tax Department")');
      
      await this.captureScreenshot('portal_homepage');
      
      logger.info('Successfully navigated to Income Tax portal');
      
    } catch (error) {
      throw new Error(`Failed to navigate to portal: ${error.message}`);
    }
  }

  async login() {
    try {
      // STEP 1: Click the "Login" link in the header
      await this.page.click('a[href="/login"]');
      logger.info('Clicked login link in header');
      
      // STEP 2: Wait for the login page to load
      await this.page.waitForSelector('h2:has-text("Login to e-Filing Portal")');
      logger.info('Login page loaded');
      
      await this.captureScreenshot('login_page');
      
      // STEP 3: Fill in the PAN field
      const pan = this.inputData.get('pan');
      await this.page.fill('input[name="pan"]', pan);
      logger.info(`Filled PAN: ${pan}`);
      
      // STEP 4: Fill in the password
      await this.page.fill('input[name="password"]', 'TestPassword123');
      logger.info('Filled password');
      
      // STEP 5: Handle CAPTCHA
      // Check if there's a CAPTCHA element
      const captchaElement = await this.page.$('.captcha-image');
      let captchaValue;
      
      if (captchaElement) {
        // Take screenshot of CAPTCHA
        const captchaScreenshot = await captchaElement.screenshot({ encoding: 'base64' });
        
        // Request user input for CAPTCHA
        logger.info('Requesting CAPTCHA input from user');
        this.emit('needs_input', {
          taskId: this.taskData._id,
          type: 'captcha',
          prompt: 'Please enter the characters shown in the CAPTCHA image',
          data: {
            captchaImageData: `data:image/png;base64,${captchaScreenshot}`
          }
        });
        
        // Wait for user to provide CAPTCHA value
        captchaValue = await this.waitForUserInput('captcha');
        logger.info('Received CAPTCHA value from user');
      } else {
        // For mock portal, use the test CAPTCHA
        captchaValue = 'MOCK';
      }
      
      await this.page.fill('input[name="captcha"]', captchaValue);
      logger.info('Filled CAPTCHA');
      
      await this.captureScreenshot('login_form_filled');
      
      // STEP 6: Submit the login form
      await this.page.click('button[type="submit"]');
      logger.info('Clicked login submit button');
      
      // STEP 7: Wait for successful login
      await this.page.waitForSelector('.card:has-text("Welcome")', {
        timeout: 10000
      });
      
      await this.captureScreenshot('logged_in_dashboard');
      
      logger.info('Successfully logged in');
      
    } catch (error) {
      throw new Error(`Login failed: ${error.message}`);
    }
  }

async navigateToITRForm() {
  try {
    logger.info('Starting navigation to ITR form');
    
    // From the dashboard, we need to get to the ITR selection page
    // Let's check what URL we're currently on
    const currentUrl = this.page.url();
    logger.info(`Current URL: ${currentUrl}`);
    
    // OPTION 1: If there's a "File ITR Now" button, click it
    const fileITRButton = await this.page.$('a:has-text("File ITR Now")');
    if (fileITRButton) {
      await fileITRButton.click();
      logger.info('Clicked File ITR Now button');
      
      // Wait a moment for navigation
      await this.page.waitForTimeout(2000);
    }
    
    // Now check what page we landed on
    const newUrl = this.page.url();
    logger.info(`Navigated to: ${newUrl}`);
    
    // Take a screenshot to see what we're looking at
    await this.captureScreenshot('after_clicking_file_itr');
    
    // Check if we're on the e-file page (intermediate page)
    const eFileHeading = await this.page.$('h2:has-text("e-File")');
    if (eFileHeading) {
      logger.info('On e-File page, looking for Start Filing button');
      
      // Click the "Start Filing" button to get to ITR selection
      await this.page.click('a:has-text("Start Filing"), a:has-text("File New ITR")');
      await this.page.waitForTimeout(2000);
      
      await this.captureScreenshot('after_clicking_start_filing');
    }
    
    // Now we should be on the ITR selection page
    // Wait for either the heading or the form elements
    await Promise.race([
      this.page.waitForSelector('h2:has-text("Select ITR Form")'),
      this.page.waitForSelector('select[name="assessmentYear"]')
    ]);
    
    logger.info('ITR selection page loaded');
    await this.captureScreenshot('itr_selection_page');
    
    // Fill in the assessment year
    const financialYear = this.inputData.get('financialYear');
    const assessmentYear = this.calculateAssessmentYear(financialYear);
    
    await this.page.selectOption('select[name="assessmentYear"]', assessmentYear);
    logger.info(`Selected assessment year: ${assessmentYear}`);
    
    // Fill in the ITR type
    const itrType = this.determineITRType();
    await this.page.selectOption('select[name="itrType"]', itrType);
    logger.info(`Selected ITR type: ${itrType}`);
    
    await this.captureScreenshot('selections_made');
    
    // Click Continue button - it should have type="submit"
    await this.page.click('button[type="submit"]');
    logger.info('Clicked Continue button');
    
    // Wait for the ITR form page to load
    // The form has multiple sections, let's wait for any of the key elements
    await Promise.race([
      this.page.waitForSelector('h3:has-text("Personal Information")'),
      this.page.waitForSelector('input[name="salaryIncome"]'),
      this.page.waitForSelector('form#itrForm')
    ]);
    
    logger.info('ITR form page loaded successfully');
    await this.captureScreenshot('itr_form_ready');
    
  } catch (error) {
    // Take a screenshot of wherever we got stuck
    await this.captureScreenshot('navigation_error');
    throw new Error(`Failed to navigate to ITR form: ${error.message}`);
  }
}
  async fillITRForm() {
    try {
      // The personal information section is pre-filled from the session
      // We just need to fill the income and deduction fields
      
      logger.info('Starting to fill income details');
      
      // STEP 1: Fill salary income
      const income = this.inputData.get('income');
      await this.page.fill('input[name="salaryIncome"]', income.toString());
      logger.info(`Filled salary income: ${income}`);
      
      // Wait for the JavaScript auto-calculation to update the totals
      await this.page.waitForTimeout(1000);
      
      await this.captureScreenshot('income_filled');
      
      // STEP 2: Fill deductions
      logger.info('Filling deductions');
      
      const deductions = this.inputData.get('deductions') || {};
      
      if (deductions.section80C) {
        await this.page.fill('input[name="section80C"]', deductions.section80C.toString());
        logger.info(`Filled Section 80C: ${deductions.section80C}`);
      }
      
      if (deductions.section80D) {
        await this.page.fill('input[name="section80D"]', deductions.section80D.toString());
        logger.info(`Filled Section 80D: ${deductions.section80D}`);
      }
      
      // Wait for auto-calculation to complete
      await this.page.waitForTimeout(1000);
      
      await this.captureScreenshot('deductions_filled');
      
      // STEP 3: Fill bank details for refund
      logger.info('Filling bank details');
      
      await this.page.fill('input[name="bankName"]', 'State Bank of India');
      await this.page.fill('input[name="accountNumber"]', '12345678901234');
      await this.page.fill('input[name="ifscCode"]', 'SBIN0001234');
      
      logger.info('Bank details filled');
      
      await this.captureScreenshot('bank_details_filled');
      
      logger.info('ITR form filling completed');
      
    } catch (error) {
      throw new Error(`Failed to fill ITR form: ${error.message}`);
    }
  }

  async submitForm() {
    try {
      // STEP 1: Check the verification checkbox
      await this.page.check('input[name="verification"]');
      logger.info('Checked verification checkbox');
      
      await this.captureScreenshot('ready_to_submit');
      
      // STEP 2: Set up dialog handler BEFORE clicking submit
      // The Review button triggers a browser confirm dialog
      // We need to accept it programmatically
      this.page.once('dialog', async dialog => {
        logger.info(`Dialog appeared: ${dialog.message()}`);
        await dialog.accept();
        logger.info('Accepted confirmation dialog');
      });
      
      // STEP 3: Click the "Review Before Submit" button
      await this.page.click('button:has-text("Review Before Submit")');
      logger.info('Clicked Review Before Submit button');
      
      // STEP 4: Wait for the success page to load
      // The success page has a distinctive element with class "success-icon"
      await this.page.waitForSelector('.success-icon', {
        timeout: 15000
      });
      
      logger.info('Success page loaded');
      
      await this.captureScreenshot('submission_success');
      
      // STEP 5: Extract the acknowledgement number from the success page
      const ackNumber = await this.page.textContent('.ack-number .number');
      this.result.data.acknowledgementNumber = ackNumber.trim();
      
      logger.info(`ITR submitted successfully. Acknowledgement: ${ackNumber.trim()}`);
      
    } catch (error) {
      throw new Error(`Failed to submit ITR: ${error.message}`);
    }
  }

  async downloadAcknowledgement() {
    try {
      // Set up download handling
      const downloadsDir = path.join(__dirname, '../../uploads/downloads');
      await fs.mkdir(downloadsDir, { recursive: true });
      
      // Set up download listener
      const [download] = await Promise.all([
        this.page.waitForEvent('download'),
        this.page.click('a[href="/download-itr-v"]:has-text("Download ITR-V")')
      ]);
      
      // Save the downloaded file
      const filename = `ITR_${this.inputData.get('pan')}_${Date.now()}.txt`;
      const filepath = path.join(downloadsDir, filename);
      
      await download.saveAs(filepath);
      
      const stats = await fs.stat(filepath);
      
      this.result.files.push({
        filename,
        path: filepath,
        type: 'acknowledgement',
        size: stats.size
      });
      
      logger.info(`Acknowledgement downloaded: ${filename}`);
      
    } catch (error) {
      logger.warn(`Failed to download acknowledgement: ${error.message}`);
      // Don't fail the entire process if download fails
      // The ITR is already submitted successfully
    }
  }

  async captureScreenshot(name) {
    try {
      const screenshotsDir = path.join(__dirname, '../../uploads/screenshots');
      await fs.mkdir(screenshotsDir, { recursive: true });
      
      const filename = `${name}_${Date.now()}.png`;
      const filepath = path.join(screenshotsDir, filename);
      
      if (this.page) {
        await this.page.screenshot({ 
          path: filepath,
          fullPage: true
        });
        
        this.result.screenshots.push({
          name,
          path: filepath,
          timestamp: new Date()
        });
      }
      
    } catch (error) {
      logger.warn(`Failed to capture screenshot: ${error.message}`);
    }
  }

  emitProgress(message, percentage) {
    this.emit('progress', {
      taskId: this.taskData._id,
      message,
      percentage
    });
  }

calculateAssessmentYear(financialYear) {
  // Financial Year format: "2023-24" represents FY 2023-2024
  // Assessment Year is one year ahead: "2024-25"
  
  // Split the financial year into start and end year components
  const parts = financialYear.split('-');
  if (parts.length !== 2) {
    throw new Error(`Invalid financial year format: ${financialYear}. Expected format: YYYY-YY`);
  }
  
  const [fyStartStr, fyEndStr] = parts;
  
  // Parse the year values
  const fyStart = parseInt(fyStartStr);
  const fyEnd = parseInt(fyEndStr);
  
  // Assessment year is one year ahead of financial year
  const ayStart = fyStart + 1;
  const ayEnd = fyEnd + 1;
  
  // Format as string with proper padding for the end year
  const ayStartStr = ayStart.toString();
  const ayEndStr = ayEnd.toString().padStart(2, '0');
  
  return `${ayStartStr}-${ayEndStr}`;
}

  determineITRType() {
    const income = parseInt(this.inputData.get('income'));
    
    // Simplified logic:
    // ITR-1 for income under 50 lakhs from salary
    if (income < 5000000) {
      return 'ITR1';
    }
    return 'ITR2';
  }

  determineRecoverability(error) {
    if (error.message.includes('timeout') || error.message.includes('network')) {
      return true;
    }
    if (error.message.includes('selector')) {
      return true;
    }
    return false;
  }
/**
   * Wait for User Input
   * 
   * Pauses the automation and waits for the user to provide input
   * via the WebSocket interface.
   */
  async waitForUserInput(inputType, timeoutMs = 300000) { // 5 minute timeout
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.removeAllListeners('user_input');
        reject(new Error(`Timeout waiting for ${inputType} input from user`));
      }, timeoutMs);

      // Listen for user input event
      this.once('user_input', (data) => {
        clearTimeout(timeout);
        if (data.inputType === inputType) {
          resolve(data.value);
        } else {
          reject(new Error(`Received wrong input type: expected ${inputType}, got ${data.inputType}`));
        }
      });
    });
  }
  async cleanup() {
    try {
      if (this.page) await this.page.close();
      if (this.context) await this.context.close();
      if (this.browser) await this.browser.close();
      logger.info('Browser cleanup completed');
    } catch (error) {
      logger.error('Error during cleanup:', error);
    }
  }
}

module.exports = async function executeITRFiling(taskData, progressCallback) {
  const automation = new ITRFilingAutomation(taskData);
  automation.on('progress', progressCallback);
  return await automation.execute();
};
