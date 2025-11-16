/**
 * LLM Router - NODE 18 COMPATIBLE VERSION
 * 
 * Uses @google/generative-ai (works with Node 18+)
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const logger = require('../utils/logger');
const User = require('../models/User');

// Validate API key
if (!process.env.GEMINI_API_KEY) {
  logger.error('CRITICAL: GEMINI_API_KEY not found!');
  throw new Error('GEMINI_API_KEY is required');
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const TASK_CONFIGURATIONS = {
  itr_filing: {
    scriptPath: './automation/scripts/itrFiling.js',
    profileFields: ['personalInfo.fullName', 'governmentIds.pan', 'personalInfo.mobile', 'email'],
    requiredDynamicParams: ['financialYear', 'income', 'deductions'],
    optionalDynamicParams: ['taxPaid', 'investmentDetails'],
    description: 'File Income Tax Return',
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
    description: 'Check EPFO balance',
    estimatedDuration: 180000
  },
  search: {
    description: 'Search vehicle details',
    profileFields: [],
    requiredDynamicParams: ['regNo', 'state'],
    optionalDynamicParams: [],
    estimatedDuration: 120000
  },
  register: {
    description: 'Register a new vehicle',
    profileFields: ['email'],
    requiredDynamicParams: [],
    optionalDynamicParams: [],
    estimatedDuration: 180000
  },
  transfer: {
    description: 'Transfer vehicle ownership',
    profileFields: ['email'],
    requiredDynamicParams: ['regNo', 'state'],
    optionalDynamicParams: [],
    estimatedDuration: 240000
  },
  update: {
    description: 'Update vehicle contact details',
    profileFields: ['email'],
    requiredDynamicParams: ['regNo', 'state'],
    optionalDynamicParams: [],
    estimatedDuration: 120000
  }
};

class LLMRouter {
  constructor() {
    // Use gemini-1.5-flash (available and free)
    this.model = genAI.getGenerativeModel({ 
	    model: 'gemini-flash-latest',
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 1024,
      }
    });
    this.maxRetries = 3;
    logger.info('✅ LLM Router initialized with gemini-2.0-flash-exp (Node 18 compatible)');
  }

  async classifyWithUserContext(userMessage, userId, additionalContext = {}) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      logger.info('🤖 LLM classification starting', {
        userId: user._id.toString(),
        messageLength: userMessage.length
      });

      let classification;
      let lastError;
      
      for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
        try {
          logger.info(`Attempt ${attempt}/${this.maxRetries}`);
          
          classification = await this.classifyIntent(userMessage, {
            ...additionalContext,
            userProfile: this.sanitizeProfileForLLM(user)
          });
          
          logger.info('✅ Classification successful!');
          break;
          
        } catch (error) {
          lastError = error;
          logger.error(`❌ Attempt ${attempt} failed:`, error.message);
          
          if (attempt < this.maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }
      }

      if (!classification) {
        throw lastError || new Error('Classification failed');
      }

      const enrichedClassification = await this.enrichWithProfileData(
        classification,
        user,
        userMessage
      );

      logger.info('✅ Complete', {
        taskType: enrichedClassification.taskType,
        confidence: enrichedClassification.confidence,
        ready: enrichedClassification.readyToExecute
      });

      return enrichedClassification;

    } catch (error) {
      logger.error('❌ LLM error:', error);
      throw new Error(`Failed to classify: ${error.message}`);
    }
  }

  async classifyIntent(userMessage, additionalContext = {}) {
    try {
      const prompt = this._buildPrompt(userMessage, additionalContext);
      
      logger.info('📤 Calling Gemini API...');

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      logger.info('📥 Response received', { length: text.length });

      const classification = this._parseResponse(text);
      
      return classification;

    } catch (error) {
      logger.error('Gemini API error:', error);
      throw error;
     }
  }

_buildPrompt(userMessage, context) {
  const userProfile = context.userProfile || {};
  const previousParams = context.previousExtractedParams || {};

  let contextStr = '';
  if (Object.keys(previousParams).length > 0) {
    contextStr = `\nPREVIOUSLY EXTRACTED: ${JSON.stringify(previousParams)}`;
  }

  return `You are a task classifier for Indian government services and VAHAN vehicle portal. Respond with JSON ONLY.

TASKS:
1. itr_filing - File Income Tax Return
   Required params: financialYear, income, deductions
   Optional: taxPaid, investmentDetails

2. digilocker_download - Download DigiLocker documents
   Required params: documentType

3. epfo_balance - Check EPF balance
   Required params: epfoPassword

4. search - Search vehicle details
   Required params: regNo, state

5. register - Register a new vehicle
   Required params: email

6. transfer - Transfer vehicle ownership
   Required params: regNo, state, email

7. update - Update vehicle contact details
   Required params: regNo, state, email

Examples:

User: "search DL01AB1234 in DL"
AI: {
  "taskType": "search",
  "regNo": "DL01AB1234",
  "state": "DL"
}

User: "register a new vehicle"
AI: {
  "taskType": "register"
}

User: "transfer ownership of MH01XY5678 in MH"
AI: {
  "taskType": "transfer",
  "regNo": "MH01XY5678",
  "state": "MH"
}

User: "update my contacts for KA05AB1234"
AI: {
  "taskType": "update",
  "regNo": "KA05AB1234"
}

USER: "${userMessage}"${contextStr}

PROFILE:
- PAN: ${userProfile.hasPAN ? 'Yes' : 'No'}
- Aadhaar: ${userProfile.hasAadhaar ? 'Yes' : 'No'}
- UAN: ${userProfile.hasUAN ? 'Yes' : 'No'}

INSTRUCTIONS:
1. Identify task type
2. Extract ALL mentioned parameters from user message
3. Merge with previously extracted params
4. Check what's still missing

Respond with JSON:
{
  "taskType": "itr_filing",
  "confidence": 0.95,
  "extractedParams": {
    "financialYear": "2023-24",
    "income": "850000",
    "deductions": "150000",
    "taxPaid": "40000"
  },
  "reasoning": "Extracted all params from user message"
}`;
}

_parseResponse(text) {
  try {
    // ✅ NEW: Log raw response for debugging
    console.log('📄 Raw LLM response (first 500 chars):');
    console.log(text.substring(0, 500));
    console.log('---');
    
    let cleanText = text.trim();
    
    // Remove markdown code blocks
    cleanText = cleanText.replace(/``````\n?/g, '');
    
    // Remove any text before first {
    const firstBrace = cleanText.indexOf('{');
    if (firstBrace > 0) {
      console.log(`Removing ${firstBrace} chars before first {`);
      cleanText = cleanText.substring(firstBrace);
    }
    
    // Remove any text after last }
    const lastBrace = cleanText.lastIndexOf('}');
    if (lastBrace > 0 && lastBrace < cleanText.length - 1) {
      console.log(`Removing ${cleanText.length - lastBrace - 1} chars after last }`);
      cleanText = cleanText.substring(0, lastBrace + 1);
    }
    
    console.log('🔧 Cleaned JSON (first 300 chars):');
    console.log(cleanText.substring(0, 300));
    
    const parsed = JSON.parse(cleanText);
    console.log('✅ JSON parsed successfully');
    return this._validateClassification(parsed);
    
  } catch (e) {
    console.error('❌ Direct parse failed, trying regex extraction...');
    
    // Try extracting JSON with regex
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        console.log('Found JSON with regex, attempting parse...');
        const parsed = JSON.parse(jsonMatch[0]);
        console.log('✅ Regex extraction successful');
        return this._validateClassification(parsed);
      } catch (e2) {
        console.error('❌ Regex extraction also failed');
      }
    }
    
    // Last resort: try to find any JSON-like structure
    const possibleJSON = text.match(/\{[^{}]*"taskType"[^{}]*\}/);
    if (possibleJSON) {
      try {
        console.log('Trying minimal JSON extraction...');
        const parsed = JSON.parse(possibleJSON[0]);
        console.log('✅ Minimal extraction successful');
        return this._validateClassification(parsed);
      } catch (e3) {
        console.error('❌ All parsing attempts failed');
      }
    }
    
    console.error('❌ COMPLETE RAW RESPONSE:');
    console.error(text);
    throw new Error('Could not parse response');
  }
}

_validateClassification(obj) {
  const validTasks = Object.keys(TASK_CONFIGURATIONS);
  if (!obj.taskType || !validTasks.includes(obj.taskType)) {
    throw new Error(`Invalid task: ${obj.taskType}`);
  }
  if (typeof obj.confidence !== 'number') obj.confidence = 0.5;
  if (!obj.extractedParams) obj.extractedParams = {};
  return obj;
}
  async enrichWithProfileData(classification, user) {
    const config = TASK_CONFIGURATIONS[classification.taskType];

    const enriched = {
      ...classification,
      profileData: {},
      missingFields: [],
      readyToExecute: false
    };

    // Check profile fields
    for (const fieldPath of config.profileFields) {
      const value = this._getNestedValue(user, fieldPath);
      
      if (value) {
        const key = fieldPath.split('.').pop();
        enriched.profileData[key] = value;
      } else {
        enriched.missingFields.push({
          field: fieldPath,
          label: this._fieldToLabel(fieldPath),
          source: 'profile'
        });
      }
    }

    // Add Aadhaar if needed
    if (['digilocker_download', 'itr_filing'].includes(classification.taskType)) {
      if (user.governmentIds?.aadhaar) {
        enriched.profileData.aadhaar = user.governmentIds.aadhaar;
      }
    }

    // Add bank for ITR
    if (classification.taskType === 'itr_filing') {
      const bank = user.getPrimaryBankAccount();
      if (bank) {
        enriched.profileData.bankName = bank.bankName;
        enriched.profileData.accountNumber = bank.accountNumber;
        enriched.profileData.ifscCode = bank.ifscCode;
      }
    }

    // Check required params
for (const param of config.requiredDynamicParams) {
    if (!classification.extractedParams[param]) {
      enriched.missingFields.push({
        field: param,
        label: this._paramToLabel(param),
        source: 'conversation'
      });
    } else {
      console.log(`✅ Found ${param}:`, classification.extractedParams[param]);  // Debug log
    }
  }

  enriched.readyToExecute = enriched.missingFields.length === 0;

  if (!enriched.readyToExecute) {
    enriched.clarificationNeeded = true;
    enriched.clarificationQuestion = this._buildQuestion(enriched.missingFields);
  }

  return enriched;
}

  _buildQuestion(missingFields) {
    const profile = missingFields.filter(f => f.source === 'profile');
    const conversation = missingFields.filter(f => f.source === 'conversation');

    let q = '';
    if (profile.length > 0) {
      q += '⚠️ Update your profile with:\n';
      profile.forEach(f => q += `  • ${f.label}\n`);
      q += '\n';
    }
    if (conversation.length > 0) {
      q += 'I need:\n';
      conversation.forEach(f => q += `  • ${f.label}\n`);
    }
    return q;
  }

  _getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  _fieldToLabel(fieldPath) {
    const labels = {
      'personalInfo.fullName': 'Full Name',
      'personalInfo.mobile': 'Mobile Number',
      'governmentIds.pan': 'PAN Number',
      'governmentIds.aadhaar': 'Aadhaar Number',
      'governmentIds.uan': 'UAN Number'
    };
    return labels[fieldPath] || fieldPath;
  }

   _paramToLabel(param) {
  const labels = {
    financialYear: 'Financial Year (e.g., 2023-24)',
    income: 'Total Annual Income',
    deductions: 'Tax Deductions',
    documentType: 'Document Type',
    epfoPassword: 'EPFO Password',
    regNo: 'Vehicle Registration Number',
    state: 'State Code (e.g., DL, MH, KA)'
  };
  return labels[param] || param;
}

  sanitizeProfileForLLM(user) {
    return {
      fullName: user.personalInfo?.fullName,
      hasPAN: !!user.governmentIds?.pan,
      hasAadhaar: !!user.governmentIds?.aadhaar,
      hasUAN: !!user.governmentIds?.uan,
      profileCompleteness: user.profileCompleteness
    };
  }

  getTaskConfig(taskType) {
    return TASK_CONFIGURATIONS[taskType];
  }
}

module.exports = new LLMRouter();

