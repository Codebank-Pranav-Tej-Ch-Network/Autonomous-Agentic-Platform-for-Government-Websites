// backend-server.js
// Secure backend for Gemini AI automation

const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:8080',
    credentials: true
}));

// Rate limiting to prevent abuse
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// API Key validation middleware
const validateApiKey = (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    const validApiKeys = process.env.VALID_API_KEYS?.split(',') || [];
    
    if (!apiKey || !validApiKeys.includes(apiKey)) {
        return res.status(401).json({ 
            error: 'Unauthorized: Invalid or missing API key' 
        });
    }
    
    next();
};

// Gemini AI API call function
async function callGeminiAI(prompt) {
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    
    if (!GEMINI_API_KEY) {
        throw new Error('Gemini API key not configured on server');
    }

    const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent';
    
    try {
        const fetch = (await import('node-fetch')).default;
        
        const response = await fetch(`${API_URL}?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: prompt }]
                }],
                generationConfig: {
                    temperature: 0.1,
                    maxOutputTokens: 2048
                }
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Gemini API Error: ${errorData.error?.message || response.statusText}`);
        }

        const data = await response.json();
        
        if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
            throw new Error('Invalid response from Gemini AI');
        }
        
        return data.candidates[0].content.parts[0].text;
        
    } catch (error) {
        console.error('Gemini AI Error:', error);
        throw error;
    }
}

// === API ENDPOINTS ===

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        message: 'Passport Automation Backend API',
        timestamp: new Date().toISOString()
    });
});

// Validate and map form data
app.post('/api/validate-data', validateApiKey, async (req, res) => {
    try {
        const { userData } = req.body;
        
        if (!userData) {
            return res.status(400).json({ error: 'User data is required' });
        }

        const prompt = `You are a form-filling assistant for Indian passport applications. Convert the following user data into a structured JSON format.

User Data:
${JSON.stringify(userData, null, 2)}

Return ONLY valid JSON (no markdown, no explanation) with these exact fields:
{
    "firstName": "",
    "lastName": "",
    "dob": "YYYY-MM-DD format",
    "gender": "male/female/other",
    "email": "",
    "mobile": "10 digits only",
    "state": "2-letter state code",
    "address": "",
    "pincode": "6 digits if available"
}

Rules:
- Validate and clean all fields
- Convert state full names to 2-letter codes
- Format date as YYYY-MM-DD
- Remove any non-numeric characters from mobile number`;

        const aiResponse = await callGeminiAI(prompt);
        
        // Extract JSON from response
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('AI did not return valid JSON');
        }
        
        const mappedData = JSON.parse(jsonMatch[0]);
        
        res.json({
            success: true,
            data: mappedData
        });
        
    } catch (error) {
        console.error('Validation error:', error);
        res.status(500).json({ 
            success: false,
            error: error.message 
        });
    }
});

// Get form filling strategy
app.post('/api/get-strategy', validateApiKey, async (req, res) => {
    try {
        const { applicationType, userData } = req.body;
        
        if (!applicationType || !userData) {
            return res.status(400).json({ 
                error: 'Application type and user data are required' 
            });
        }

        const prompt = `You are automating a ${applicationType} passport application form.

User data: ${JSON.stringify(userData)}

Generate a step-by-step form filling strategy. Return ONLY a JSON array (no markdown) with this format:
[
    {"fieldId": "firstName", "value": "John", "description": "Fill applicant's first name"},
    {"fieldId": "dob", "value": "1990-01-01", "description": "Fill date of birth"}
]

Include these fields in order: firstName, lastName, dob, gender, email, mobile, state, address`;

        const aiResponse = await callGeminiAI(prompt);
        
        // Extract JSON array
        const jsonMatch = aiResponse.match(/\[[\s\S]*\]/);
        if (!jsonMatch) {
            throw new Error('AI did not return valid JSON array');
        }
        
        const strategy = JSON.parse(jsonMatch[0]);
        
        res.json({
            success: true,
            strategy: strategy
        });
        
    } catch (error) {
        console.error('Strategy generation error:', error);
        res.status(500).json({ 
            success: false,
            error: error.message 
        });
    }
});

// Validate form data
app.post('/api/validate', validateApiKey, async (req, res) => {
    try {
        const { userData } = req.body;
        
        if (!userData) {
            return res.status(400).json({ error: 'User data is required' });
        }

        const prompt = `Validate this Indian passport application data for errors:

${JSON.stringify(userData, null, 2)}

Check for:
- Name validity (no numbers, special chars)
- Valid date of birth (age 1-100)
- Valid email format
- Valid 10-digit mobile number
- Valid state code

Return ONLY JSON (no markdown):
{
    "valid": true/false,
    "errors": ["error1", "error2"],
    "warnings": ["warning1"]
}`;

        const aiResponse = await callGeminiAI(prompt);
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
        
        if (!jsonMatch) {
            throw new Error('AI did not return valid JSON');
        }
        
        const validation = JSON.parse(jsonMatch[0]);
        
        res.json({
            success: true,
            validation: validation
        });
        
    } catch (error) {
        console.error('Validation error:', error);
        res.status(500).json({ 
            success: false,
            error: error.message 
        });
    }
});

// Get required documents
app.post('/api/required-documents', validateApiKey, async (req, res) => {
    try {
        const { applicationType, userProfile } = req.body;
        
        const prompt = `Application Type: ${applicationType}
User Profile: ${JSON.stringify(userProfile)}

List the required documents for this Indian passport application.
Return as JSON array with document names and reasons.

Format:
[
    {"document": "Aadhaar Card", "reason": "Proof of identity", "mandatory": true},
    {"document": "Birth Certificate", "reason": "Proof of date of birth", "mandatory": true}
]`;

        const aiResponse = await callGeminiAI(prompt);
        const jsonMatch = aiResponse.match(/\[[\s\S]*\]/);
        
        if (!jsonMatch) {
            throw new Error('AI did not return valid JSON');
        }
        
        const documents = JSON.parse(jsonMatch[0]);
        
        res.json({
            success: true,
            documents: documents
        });
        
    } catch (error) {
        console.error('Document check error:', error);
        res.status(500).json({ 
            success: false,
            error: error.message 
        });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ 
        error: 'Internal server error',
        message: err.message 
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════════╗
║   Passport Automation Backend Server          ║
║   Running on: http://localhost:${PORT}        ║
║   Status: ✅ Ready                            ║
╚════════════════════════════════════════════════╝
    `);
    
    if (!process.env.GEMINI_API_KEY) {
        console.warn('⚠️  WARNING: GEMINI_API_KEY not set in environment variables!');
    }
});

module.exports = app;