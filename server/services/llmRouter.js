/**
 * Enhanced LLM Router Service with Database Integration
 *
 * This service now integrates with the User model to access stored profile data,
 * making it truly intelligent about what information is available versus what
 * needs to be collected from the user through conversation.
 *
 * The router performs several sophisticated tasks:
 * 1. Classifies user intent using Gemini AI
 * 2. Extracts parameters from natural language
 * 3. Checks user's database profile for stored information
 * 4. Identifies what additional data needs to be collected
 * 5. Generates context-aware clarification questions
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const logger = require('../utils/logger');
const User = require('../models/User');

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Task Configuration with Required and Optional Parameters
 *
 * This defines what data each task type needs. The router uses this to know
 * what to look for in the user's profile and what to ask the user to provide.
 */
const TASK_CONFIGURATIONS = {
  itr_filing: {
    scriptPath: './automation/scripts/itrFiling.js',
    // These come from user profile (will be auto-filled)
    profileFields: ['personalInfo.fullName', 'governmentIds.pan', 'personalInfo.mobile', 'email'],
    // These must be asked for each filing (dynamic data)
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
    requiredDynamicParams: ['epfoPassword'],  // Password must always be asked fresh
    optionalDynamicParams: [],
    description: 'Check EPFO balance and download passbook',
    estimatedDuration: 180000
  }
};

class LLMRouter {
  constructor() {
    this.model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      generationConfig: {
        temperature: 0.1,  // Low temperature for consistent, deterministic responses
        topP: 0.95,
        topK: 40,
        maxOutputTokens: 2048,
      }
    });
  }

  /**
   * Main Classification Method with User Context
   *
   * This is the entry point for task classification. It takes the user's message
   * and their user ID, loads their profile from the database, and uses all this
   * context to make intelligent routing decisions.
   *
   * @param {string} userMessage - The natural language message from the user
   * @param {string} userId - The MongoDB user ID
   * @param {Object} additionalContext - Any extra context (previous messages, etc.)
   * @returns {Object} Classification result with task type, parameters, and next steps
   */
  async classifyWithUserContext(userMessage, userId, additionalContext = {}) {
    try {
      // Load user profile from database
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      logger.info('Classifying intent for user', {
        userId: user._id,
        email: user.email,
        profileCompleteness: user.profileCompleteness
      });

      // First, classify the basic intent and extract any parameters mentioned
      const classification = await this.classifyIntent(userMessage, {
        ...additionalContext,
        userProfile: this.sanitizeProfileForLLM(user)
      });

      // Now enrich the classification with data from the user's profile
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
      throw new Error(`Failed to classify with user context: ${error.message}`);
    }
  }

  /**
   * Basic Intent Classification using Gemini
   *
   * This uses the LLM to understand what the user wants to do and extract
   * any parameters they mentioned in their message. This is the first pass
   * that doesn't yet consider what's in the database.
   */
async classifyIntent(userMessage, additionalContext = {}) {
    try {
      const prompt = this._buildClassificationPrompt(userMessage, additionalContext);

      logger.info('Sending classification request to Gemini', {
        messageLength: userMessage.length,
        hasUserProfile: !!additionalContext.userProfile,
        userMessage: userMessage.substring(0, 100) // Log first 100 chars for debugging
      });

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      logger.info('Received LLM response', {
        responseLength: text.length,
        responsePreview: text.substring(0, 200)
      });

      const classification = this._parseClassificationResponse(text);

      logger.info('Parsed classification', {
        taskType: classification.taskType,
        confidence: classification.confidence,
        extractedParams: Object.keys(classification.extractedParams || {})
      });

      return classification;

    } catch (error) {
      logger.error('LLM classification failed:', {
        error: error.message,
        stack: error.stack
      });
      throw new Error(`Failed to classify user intent: ${error.message}`);
    }
  }
  /**
   * Enrich Classification with Profile Data
   *
   * This is where the magic happens. After we know what task the user wants to perform,
   * we check their profile in the database to see what information we already have.
   * We automatically fill in profile fields and identify what's still missing.
   */
  async enrichWithProfileData(classification, user, originalMessage) {
    const taskType = classification.taskType;
    const config = TASK_CONFIGURATIONS[taskType];

    if (!config) {
      throw new Error(`Unknown task type: ${taskType}`);
    }

    // Start building the enriched classification
    const enriched = {
      ...classification,
      profileData: {},
      missingFields: [],
      readyToExecute: false
    };

    // Extract profile data that this task needs
    for (const fieldPath of config.profileFields) {
      const value = this._getNestedValue(user, fieldPath);

      if (value) {
        // Store the profile data with a clean key name
        const key = fieldPath.split('.').pop();
        enriched.profileData[key] = value;
        logger.info(`Found ${key} in user profile`);
      } else {
        // This profile field is missing
        enriched.missingFields.push({
          field: fieldPath,
          label: this._fieldPathToLabel(fieldPath),
          source: 'profile'
        });
        logger.warn(`Missing profile field: ${fieldPath}`);
      }
    }

    // Check for special cases like encrypted Aadhaar
    if (taskType === 'digilocker_download' || taskType === 'itr_filing') {
      if (user.governmentIds?.aadhaar?.isStored) {
        try {
          const aadhaar = user.getAadhaar();
          if (aadhaar) {
            enriched.profileData.aadhaar = aadhaar;
          }
        } catch (error) {
          logger.error('Failed to decrypt Aadhaar:', error);
          enriched.missingFields.push({
            field: 'governmentIds.aadhaar',
            label: 'Aadhaar Number',
            source: 'profile'
          });
        }
      }
    }

    // Get primary bank account if needed
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

    // Check which dynamic parameters were provided in the user's message
    // versus which ones are still needed
    for (const param of config.requiredDynamicParams) {
      if (!classification.extractedParams[param]) {
        enriched.missingFields.push({
          field: param,
          label: this._paramToLabel(param),
          source: 'conversation'
        });
      }
    }

    // Determine if we have enough information to execute the task
    enriched.readyToExecute = enriched.missingFields.length === 0;

    // If information is missing, generate an intelligent question
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

  /**
   * Generate Context-Aware Clarification Questions
   *
   * When information is missing, we need to ask the user for it. But we want to be
   * smart about how we ask. Instead of asking for one field at a time, we group
   * related fields. Instead of using technical field names, we use friendly language.
   */
  async _generateClarificationQuestion(missingFields, taskType, originalMessage) {
    // Separate missing fields by source
    const profileMissing = missingFields.filter(f => f.source === 'profile');
    const conversationMissing = missingFields.filter(f => f.source === 'conversation');

    let question = '';

    // If profile data is missing, inform user they need to complete their profile
    if (profileMissing.length > 0) {
      question += 'Your profile is missing some required information:\n';
      profileMissing.forEach(field => {
        question += `• ${field.label}\n`;
      });
      question += '\nPlease update your profile with this information before continuing.\n\n';
    }

    // For conversation data, ask the user to provide it now
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
   * Build Classification Prompt for Gemini
   *
   * This constructs the detailed prompt that instructs Gemini on how to analyze
   * the user's message and return structured data about their intent.
   */
  _buildClassificationPrompt(userMessage, context) {
    const userProfile = context.userProfile || {};

    return `You are an intelligent task classifier for a government services automation system.

Your job is to analyze user requests and determine:
1. What government service task they want to perform
2. What parameters they have mentioned
3. What additional information might be needed

AVAILABLE TASKS:
${Object.entries(TASK_CONFIGURATIONS).map(([key, config]) =>
  `- ${key}: ${config.description}
   Dynamic parameters needed: ${config.requiredDynamicParams.join(', ')}`
).join('\n\n')}

USER PROFILE INFORMATION AVAILABLE:
${Object.keys(userProfile).length > 0 ? JSON.stringify(userProfile, null, 2) : 'No profile information available'}

USER REQUEST: "${userMessage}"

${context.previousTasks ? `PREVIOUS TASKS: ${JSON.stringify(context.previousTasks)}` : ''}

Analyze the request and respond with ONLY valid JSON in this format:
{
  "taskType": "itr_filing|digilocker_download|epfo_balance",
  "confidence": 0.0-1.0,
  "extractedParams": {
    "paramName": "value"
  },
  "reasoning": "Brief explanation of why you classified it this way"
}

PARAMETER EXTRACTION GUIDELINES:
- financialYear: Look for mentions like "FY 2023-24", "last year", "this year"
- income: Extract salary amounts mentioned (convert lakhs to actual numbers)
- deductions: Extract mentions of 80C, 80D, investments, insurance
- documentType: For DigiLocker, extract document names (driving_license, aadhaar_card, pan_card, etc.)
- epfoPassword: Never extract passwords from messages (must be asked separately)

CONFIDENCE SCORING:
- 0.9-1.0: Clear, unambiguous request with specific task mentioned
- 0.7-0.8: Request implies a task but doesn't explicitly name it
- 0.5-0.6: Unclear or ambiguous request
- 0.0-0.4: Cannot determine intent

EXAMPLES:

Input: "I want to file my income tax return for FY 2023-24. My salary is 8 lakhs."
Output: {
  "taskType": "itr_filing",
  "confidence": 0.95,
  "extractedParams": {
    "financialYear": "2023-24",
    "income": "800000"
  },
  "reasoning": "Clear ITR filing request with financial year and income specified"
}

Input: "Download my driving license"
Output: {
  "taskType": "digilocker_download",
  "confidence": 0.9,
  "extractedParams": {
    "documentType": "driving_license"
  },
  "reasoning": "Request to download driving license document from DigiLocker"
}

Input: "Check my PF balance"
Output: {
  "taskType": "epfo_balance",
  "confidence": 0.85,
  "extractedParams": {},
  "reasoning": "Request to check EPFO provident fund balance"
}

IMPORTANT RULES:
1. Respond with ONLY the JSON object, no additional text
2. Always include confidence, taskType, extractedParams, and reasoning
3. Do not invent parameter values - only extract what's explicitly mentioned
4. For numerical values, convert to base units (lakhs to actual numbers)
5. For dates, normalize to standard format (YYYY-YY for financial years)

Now classify the user's request:`;
  }

  /**
   * Parse and Validate LLM Response
   *
   * Gemini returns text that should contain JSON. We need to extract and validate it.
   */
  _parseClassificationResponse(text) {
    try {
      // Try direct JSON parse first
      const parsed = JSON.parse(text);
      return this._validateClassification(parsed);
    } catch (e) {
      // Try extracting JSON from markdown code blocks
      const jsonMatch = text.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[1]);
          return this._validateClassification(parsed);
        } catch (e2) {
          // Fall through
        }
      }

      // Try finding JSON object anywhere in text
      const objectMatch = text.match(/\{[\s\S]*\}/);
      if (objectMatch) {
        try {
          const parsed = JSON.parse(objectMatch[0]);
          return this._validateClassification(parsed);
        } catch (e3) {
          // Fall through
        }
      }

      logger.error('Failed to parse LLM response:', { text });
      throw new Error('Could not parse classification response from LLM');
    }
  }

  /**
   * Validate Classification Structure
   */
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
      obj.confidence = 0.5; // Default confidence
    }

    if (typeof obj.extractedParams !== 'object' || Array.isArray(obj.extractedParams)) {
      obj.extractedParams = {};
    }

    return obj;
  }

  /**
   * Utility Methods
   */

  // Get nested value from object using dot notation path
  _getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  // Convert field path to user-friendly label
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

  // Convert parameter name to user-friendly label
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

  // Sanitize user profile for LLM (remove sensitive data)
  sanitizeProfileForLLM(user) {
    return {
      fullName: user.personalInfo?.fullName,
      email: user.email,
      hasPAN: !!user.governmentIds?.pan,
      hasAadhaar: !!user.governmentIds?.aadhaar?.isStored,
      hasUAN: !!user.governmentIds?.uan,
      hasBankDetails: !!(user.bankDetails && user.bankDetails.length > 0),
      profileCompleteness: user.profileCompleteness
    };
  }

  /**
   * Get Task Configuration
   */
  getTaskConfig(taskType) {
    const config = TASK_CONFIGURATIONS[taskType];
    if (!config) {
      throw new Error(`Unknown task type: ${taskType}`);
    }
    return config;
  }
}

// Export singleton instance
module.exports = new LLMRouter();
