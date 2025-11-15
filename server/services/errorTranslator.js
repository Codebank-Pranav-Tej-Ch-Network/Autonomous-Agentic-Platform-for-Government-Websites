const { GoogleGenerativeAI } = require('@google/generative-ai');
const logger = require('../utils/logger');

class ErrorTranslator {
  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  }

  async translateError(technicalError, context = {}) {
    try {
      const prompt = `
You are a helpful assistant explaining technical errors to non-technical users.

Technical Error:
${technicalError}

Context:
- Task Type: ${context.taskType || 'Unknown'}
- Step: ${context.step || 'Unknown'}
- User Action: ${context.userAction || 'Filing tax return'}

Generate a user-friendly error message that:
1. Explains what went wrong in simple terms
2. Suggests what the user should do next
3. Is empathetic and reassuring
4. Avoids technical jargon
5. Is concise (max 2-3 sentences)

Return ONLY the friendly message, nothing else.

Examples:
Technical: "page.selectOption: Timeout 60000ms exceeded"
Friendly: "We couldn't select your ITR form type on the income tax portal. The website might be slow right now. Please try again in a few minutes."

Technical: "Navigation error: net::ERR_CONNECTION_REFUSED"
Friendly: "We couldn't connect to the income tax website. Please check your internet connection and try again."

Technical: "Form filling failed: page.fill: Element is not editable"
Friendly: "Some form fields couldn't be filled automatically. This might happen if you've already filed your ITR for this year. Please verify your filing status."
`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const friendlyMessage = response.text().trim();

      logger.info(`Translated error: "${technicalError}" → "${friendlyMessage}"`);
      return friendlyMessage;

    } catch (error) {
      logger.error('Error translation failed:', error.message);
      // Fallback to simple translation
      return this.getFallbackMessage(technicalError, context);
    }
  }

  getFallbackMessage(error, context) {
    const errorString = error.toString().toLowerCase();

    // Common patterns
    if (errorString.includes('timeout')) {
      return `The ${context.taskType || 'process'} is taking longer than expected. The government portal might be slow. Please try again.`;
    }
    
    if (errorString.includes('connection') || errorString.includes('network')) {
      return 'We couldn\'t connect to the government portal. Please check your internet connection and try again.';
    }
    
    if (errorString.includes('not found') || errorString.includes('404')) {
      return 'The requested page on the government portal couldn\'t be found. The portal might be under maintenance.';
    }
    
    if (errorString.includes('login') || errorString.includes('authentication')) {
      return 'We couldn\'t log in with your credentials. Please verify your PAN and password are correct.';
    }
    
    if (errorString.includes('session') || errorString.includes('expired')) {
      return 'Your session has expired. Please try filing again.';
    }

    // Generic fallback
    return `We encountered an issue while processing your request. Our team has been notified. Please try again or contact support if the problem persists.`;
  }

  // Quick sync fallback for immediate responses
  getQuickFallback(error) {
    return 'Something went wrong while processing your request. Please try again.';
  }
}

module.exports = new ErrorTranslator();

