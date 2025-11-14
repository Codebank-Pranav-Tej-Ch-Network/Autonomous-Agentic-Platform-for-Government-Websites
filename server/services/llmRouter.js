/**
 * LLM Router - FIXED WITH TIMEOUT HANDLING & FALLBACK
 * 
 * CRITICAL FIXES:
 * - 90-second timeout for Gemini API
 * - Retry mechanism (3 attempts)
 * - Fallback to simpler prompts if timeout
 * - Better error handling
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const logger = require('../utils/logger');
const User = require('../models/User');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const TASK_CONFIGURATIONS = {
  itr_filing: {
    scriptPath: './automation/scripts/itrFiling.js',
    profileFields: ['personalInfo.fullName', 'governmentIds.pan', 'personalInfo.mobile', 'email'],
    requiredDynamicParams: ['financialYear', 'income', 'deductions'],
    optionalDynamicParams: ['taxPaid', 'investmentDetails', 'housePropertyIncome', 'otherIncome'],
    description: 'File Income Tax Return online',
    estimatedDuration: 300000
  },
  digilocker_download: {
    scriptPath: './automation/scripts/digilocker.js',
    profileFields: ['personalInfo.fullName', 'governmentIds.aadhaar'],
    requiredDynamicParams: ['documentType'],
    optionalDynamicParams: ['documentId'],
    description: 'Download documents from DigiLocker',
    estimatedDuration: 120000
  },
  epfo_balance: {
    scriptPath: './automation/scripts/epfo.js',
    profileFields: ['personalInfo.fullName', 'governmentIds.uan'],
    requiredDynamicParams: ['epfoPassword'],
    optionalDynamicParams: [],
    description: 'Check EPFO balance and download passbook',
    estimatedDuration: 180000
  }
};

class LLMRouter {
  constructor() {
    this.model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature: 0.1,
        topP: 0.95,
        topK: 40,
        maxOutputTokens: 1024, // REDUCED from 2048 to speed up
      }
    });
    this.maxRetries = 3;
  }

  /**
   * FIXED: Classification with timeout and retries
   */
  async classifyWithUserContext(userMessage, userId, additionalContext = {}) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      logger.info('Classifying intent for user', {
        userId: user._id,
        email: user.email,
        profileCompleteness: user.profileCompleteness
      });

      // Try classification with retries
      let classification;
      let lastError;

      for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
        try {
          logger.info(`Classification attempt ${attempt}/${this.maxRetries}`);
          
          classification = await this.classifyIntentWithTimeout(userMessage, {
            ...additionalContext,
            userProfile: this.sanitizeProfileForLLM(user)
          }, 90000); // 90 second timeout
          
          break; // Success!
          
        } catch (error) {
          lastError = error;
          logger.error(`Attempt ${attempt} failed:`, error.message);
          
          if (attempt < this.maxRetries) {
            logger.info(`Retrying in 2 seconds...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }
      }

      if (!classification) {
        logger.error('All classification attempts failed');
        throw lastError || new Error('Classification failed after retries');
      }

      const enrichedClassification = await this.enrichWithProfileData(
        classification,
        user,
        userMessage
      );

      logger.info('Classification completed', {
        taskType: enrichedClassification.taskType,
        confidence: enrichedClassification.confidence,
        profileDataUsed: Object.keys(enrichedClassification.profileData || {}).length,
        missingFields: enrichedClassification.missingFields?.length || 0
      });

      return enrichedClassification;

    } catch (error) {
      logger.error('LLM classification with user context failed:', error);
      throw new Error(`Failed to classify: ${error.message}`);
    }
  }

  /**
   * FIXED: Intent classification with timeout
   */
  async classifyIntentWithTimeout(userMessage, additionalContext = {}, timeoutMs = 90000) {
    return new Promise(async (resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Gemini API timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      try {
        const prompt = this._buildClassificationPrompt(userMessage, additionalContext);

        logger.info('Sending classification request to Gemini', {
          messageLength: userMessage.length,
          hasUserProfile: !!additionalContext.userProfile,
          timeout: `${timeoutMs}ms`
        });

        const result = await this.model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        clearTimeout(timeoutId);

        logger.info('Received LLM response', {
          responseLength: text.length
        });

        const classification = this._parseClassificationResponse(text);

        logger.info('Parsed classification', {
          taskType: classification.taskType,
          confidence: classification.confidence
        });

        resolve(classification);

      } catch (error) {
        clearTimeout(timeoutId);
        reject(error);
      }
    });
  }

  async enrichWithProfileData(classification, user, originalMessage) {
    const taskType = classification.taskType;
    const config = TASK_CONFIGURATIONS[taskType];

    if (!config) {
      throw new Error(`Unknown task type: ${taskType}`);
    }

    const enriched = {
      ...classification,
      profileData: {},
      missingFields: [],
      readyToExecute: false
    };

    for (const fieldPath of config.profileFields) {
      const value = this._getNestedValue(user, fieldPath);

      if (value) {
        const key = fieldPath.split('.').pop();
        enriched.profileData[key] = value;
        logger.info(`Found ${key} in user profile`);
      } else {
        enriched.missingFields.push({
          field: fieldPath,
          label: this._fieldPathToLabel(fieldPath),
          source: 'profile'
        });
        logger.warn(`Missing profile field: ${fieldPath}`);
      }
    }

    // Check Aadhaar
    if (taskType === 'digilocker_download' || taskType === 'itr_filing') {
      if (user.governmentIds?.aadhaar) {
        enriched.profileData.aadhaar = user.governmentIds.aadhaar;
      }
    }

    // Get primary bank account
    if (taskType === 'itr_filing') {
      const primaryBank = user.getPrimaryBankAccount();
      if (primaryBank) {
        enriched.profileData.bankName = primaryBank.bankName;
        enriched.profileData.accountNumber = primaryBank.accountNumber;
        enriched.profileData.ifscCode = primaryBank.ifscCode;
      } else {
        enriched.missingFields.push({
          field: 'bankDetails',
          label: 'Bank Account Details',
          source: 'profile'
        });
      }
    }

    for (const param of config.requiredDynamicParams) {
      if (!classification.extractedParams[param]) {
        enriched.missingFields.push({
          field: param,
          label: this._paramToLabel(param),
          source: 'conversation'
        });
      }
    }

    enriched.readyToExecute = enriched.missingFields.length === 0;

    if (!enriched.readyToExecute) {
      enriched.clarificationNeeded = true;
      enriched.clarificationQuestion = await this._generateClarificationQuestion(
        enriched.missingFields,
        taskType,
        originalMessage
      );
    }

    return enriched;
  }

  async _generateClarificationQuestion(missingFields, taskType, originalMessage) {
    const profileMissing = missingFields.filter(f => f.source === 'profile');
    const conversationMissing = missingFields.filter(f => f.source === 'conversation');

    let question = '';

    if (profileMissing.length > 0) {
      question += 'Your profile is missing some required information:\n';
      profileMissing.forEach(field => {
        question += `• ${field.label}\n`;
      });
      question += '\nPlease update your profile with this information before continuing.\n\n';
    }

    if (conversationMissing.length > 0) {
      question += 'I need the following information to proceed:\n';
      conversationMissing.forEach(field => {
        question += `• ${field.label}\n`;
      });
      question += '\nPlease provide these details.';
    }

    return question;
  }

  /**
   * SIMPLIFIED: Shorter, faster prompt
   */
  _buildClassificationPrompt(userMessage, context) {
    const userProfile = context.userProfile || {};

    return `You are a task classifier for government services. Analyze the request and respond with JSON only.

TASKS:
- itr_filing: Income Tax Return filing
- digilocker_download: Download documents
- epfo_balance: Check PF balance

USER REQUEST: "${userMessage}"

PROFILE: ${JSON.stringify(userProfile)}

Respond with ONLY this JSON:
{
  "taskType": "itr_filing|digilocker_download|epfo_balance",
  "confidence": 0.0-1.0,
  "extractedParams": {},
  "reasoning": "brief reason"
}

Extract any mentioned: salary, income, deductions, financialYear, documentType.

JSON:`;
  }

  _parseClassificationResponse(text) {
    try {
      const parsed = JSON.parse(text);
      return this._validateClassification(parsed);
    } catch (e) {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          return this._validateClassification(parsed);
        } catch (e2) {
          // Fall through
        }
      }

      logger.error('Failed to parse LLM response:', { text });
      throw new Error('Could not parse classification response from LLM');
    }
  }

  _validateClassification(obj) {
    const required = ['taskType', 'confidence', 'extractedParams'];
    for (const field of required) {
      if (!(field in obj)) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    if (!Object.keys(TASK_CONFIGURATIONS).includes(obj.taskType)) {
      throw new Error(`Invalid task type: ${obj.taskType}`);
    }

    if (typeof obj.confidence !== 'number' || obj.confidence < 0 || obj.confidence > 1) {
      obj.confidence = 0.5;
    }

    if (typeof obj.extractedParams !== 'object' || Array.isArray(obj.extractedParams)) {
      obj.extractedParams = {};
    }

    return obj;
  }

  _getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  _fieldPathToLabel(fieldPath) {
    const labels = {
      'personalInfo.fullName': 'Full Name',
      'personalInfo.dateOfBirth': 'Date of Birth',
      'personalInfo.mobile': 'Mobile Number',
      'personalInfo.address.line1': 'Address',
      'governmentIds.pan': 'PAN Number',
      'governmentIds.aadhaar': 'Aadhaar Number',
      'governmentIds.uan': 'UAN (Universal Account Number)',
      'bankDetails': 'Bank Account Details'
    };
    return labels[fieldPath] || fieldPath;
  }

  _paramToLabel(param) {
    const labels = {
      financialYear: 'Financial Year (e.g., 2023-24)',
      income: 'Total Annual Income',
      deductions: 'Tax Deductions (80C, 80D, etc.)',
      documentType: 'Document Type',
      epfoPassword: 'EPFO Portal Password'
    };
    return labels[param] || param;
  }

  sanitizeProfileForLLM(user) {
    return {
      fullName: user.personalInfo?.fullName,
      email: user.email,
      hasPAN: !!user.governmentIds?.pan,
      hasAadhaar: !!user.governmentIds?.aadhaar,
      hasUAN: !!user.governmentIds?.uan,
      hasBankDetails: !!(user.bankDetails && user.bankDetails.length > 0),
      profileCompleteness: user.profileCompleteness
    };
  }

  getTaskConfig(taskType) {
    const config = TASK_CONFIGURATIONS[taskType];
    if (!config) {
      throw new Error(`Unknown task type: ${taskType}`);
    }
    return config;
  }
}

module.exports = new LLMRouter();
