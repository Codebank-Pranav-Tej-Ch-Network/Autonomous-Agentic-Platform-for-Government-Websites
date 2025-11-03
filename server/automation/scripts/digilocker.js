// server/automation/scripts/digilocker.js
const { chromium } = require('playwright');
const logger = require('../../utils/logger');
const EventEmitter = require('events');

class DigiLockerAutomation extends EventEmitter {
  constructor(taskData) {
    super();
    this.taskData = taskData;
    this.inputData = taskData.inputData;
    this.browser = null;
    this.page = null;
    this.result = { success: false, data: {}, files: [] };
    this.config = {
      headless: process.env.HEADLESS !== 'false',
      mockPortalUrl: process.env.MOCK_DIGILOCKER_URL || 'http://localhost:4002'
    };
  }

  async execute() {
    try {
      this.emitProgress('Initializing browser', 10);
      await this.initializeBrowser();
      
      this.emitProgress('Navigating to DigiLocker', 20);
      await this.page.goto(this.config.mockPortalUrl);
      
      this.emitProgress('Logging in with Aadhaar', 30);
      await this.login();
      
      this.emitProgress('Navigating to documents', 50);
      await this.navigateToDocuments();
      
      this.emitProgress('Selecting document', 70);
      await this.selectDocument();
      
      this.emitProgress('Downloading document', 85);
      await this.downloadDocument();
      
      this.emitProgress('Download complete', 100);
      this.result.success = true;
      return this.result;
      
    } catch (error) {
      logger.error('DigiLocker automation failed:', error);
      throw error;
    } finally {
      await this.cleanup();
    }
  }

  async initializeBrowser() {
    this.browser = await chromium.launch({ headless: this.config.headless });
    this.page = await this.browser.newPage();
  }

  async login() {
    await this.page.click('button:has-text("Sign In with Aadhaar")');
    await this.page.fill('input[name="aadhaar"]', this.inputData.get('aadhaar'));
    await this.page.click('button[type="submit"]');
    await this.page.waitForSelector('.dashboard');
  }

  async navigateToDocuments() {
    await this.page.click('a:has-text("Issued Documents")');
    await this.page.waitForSelector('.documents-list');
  }

  async selectDocument() {
    const docType = this.inputData.get('documentType');
    await this.page.click(`div[data-doc-type="${docType}"]`);
  }

  async downloadDocument() {
    const [download] = await Promise.all([
      this.page.waitForEvent('download'),
      this.page.click('button:has-text("Download")')
    ]);
    
    const path = require('path');
    const filepath = path.join(__dirname, '../../uploads/downloads', 
      `digilocker_${Date.now()}.pdf`);
    await download.saveAs(filepath);
    
    this.result.files.push({ filename: path.basename(filepath), path: filepath });
  }

  emitProgress(message, percentage) {
    this.emit('progress', { taskId: this.taskData._id, message, percentage });
  }

  async cleanup() {
    if (this.page) await this.page.close();
    if (this.browser) await this.browser.close();
  }
}

module.exports = async function executeDigiLocker(taskData, progressCallback) {
  const automation = new DigiLockerAutomation(taskData);
  automation.on('progress', progressCallback);
  return await automation.execute();
};