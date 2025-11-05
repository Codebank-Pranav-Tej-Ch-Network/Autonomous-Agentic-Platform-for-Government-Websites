/**
 * TaskSelector Component
 *
 * This is the primary interface where users interact with the AI agent.
 * It provides a conversational interface where users can describe what they
 * want to do in natural language, and the system intelligently responds,
 * asks clarifying questions, and eventually creates tasks.
 *
 * The component handles:
 * - Natural language input from users
 * - Displaying LLM-generated clarification questions
 * - Managing conversation context across multiple exchanges
 * - Creating tasks once all information is collected
 * - Providing example prompts to guide users
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Loader, MessageSquare, Sparkles, AlertCircle } from 'lucide-react';
import { taskAPI } from '../services/api';

const EXAMPLE_PROMPTS = {
  itr_filing: [
    "I want to file my income tax return for FY 2023-24",
    "File ITR for last financial year, my salary is 8 lakhs",
    "Help me file my taxes"
  ],
  digilocker_download: [
    "Download my driving license from DigiLocker",
    "I need my PAN card from DigiLocker",
    "Get my Aadhaar card document"
  ],
  epfo_balance: [
    "Check my PF balance",
    "Show me my EPFO passbook",
    "What's my provident fund balance?"
  ]
};

export default function TaskSelector({ onTaskCreated }) {
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversation, setConversation] = useState([]);
  const [conversationContext, setConversationContext] = useState(null);
  const [error, setError] = useState(null);

  /**
   * Handle sending a message to the backend
   *
   * This can be either an initial request or a response to a clarification question.
   */
const handleSendMessage = async (e) => {
  e.preventDefault();
  if (!message.trim()) return;

  const userMessage = message.trim();
  setMessage('');
  setError(null);
  setLoading(true);

  // Add user message to conversation history
  setConversation(prev => [...prev, {
    type: 'user',
    content: userMessage,
    timestamp: new Date()
  }]);

  try {
    let response;

    if (conversationContext?.conversationId) {
      // This is a clarification response
      response = await taskAPI.clarify({
        conversationId: conversationContext.conversationId,
        response: userMessage,
        previousContext: conversationContext
      });
    } else {
      // This is a new task request
      // Ensure we're sending the correct structure
      response = await taskAPI.create({
        message: userMessage,
        conversationContext: conversationContext || null  // Explicitly send null if undefined
      });
    }

      const data = response.data;

      if (data.needsClarification) {
        // LLM needs more information
        setConversation(prev => [...prev, {
          type: 'assistant',
          content: data.question || data.message,
          timestamp: new Date(),
          isQuestion: true
        }]);

        // Store context for next response
        setConversationContext({
          conversationId: data.conversationId,
          taskType: data.taskType,
          originalMessage: conversationContext?.originalMessage || userMessage,
          extractedParams: data.extractedParams || {},
          missingFields: data.missingFields || []
        });

      } else if (data.task) {
        // Task was successfully created
        setConversation(prev => [...prev, {
          type: 'assistant',
          content: `Great! I've created your task and it's being processed. You can track its progress in real-time.`,
          timestamp: new Date(),
          taskCreated: true,
          taskId: data.task.id
        }]);

        // Reset conversation
        setConversationContext(null);

        // Notify parent component
        if (onTaskCreated) {
          onTaskCreated(data.task);
        }
      }

    } catch (err) {
      console.error('Error sending message:', err);
      setError(err.response?.data?.message || 'Failed to process your request. Please try again.');

      setConversation(prev => [...prev, {
        type: 'error',
        content: err.response?.data?.message || 'Something went wrong. Please try again.',
        timestamp: new Date()
      }]);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle clicking an example prompt
   */
  const handleExampleClick = (example) => {
    setMessage(example);
    // Auto-focus the input
    document.getElementById('message-input')?.focus();
  };

  /**
   * Clear conversation and start over
   */
  const handleClearConversation = () => {
    setConversation([]);
    setConversationContext(null);
    setMessage('');
    setError(null);
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white rounded-xl shadow-2xl overflow-hidden border border-gray-200"
      style={{ height: '600px', display: 'flex', flexDirection: 'column' }}
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 p-4 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Sparkles className="w-6 h-6" />
            <div>
              <h2 className="text-xl font-bold">AI Assistant</h2>
              <p className="text-sm opacity-90">Tell me what you'd like to do</p>
            </div>
          </div>
          {conversation.length > 0 && (
            <button
              onClick={handleClearConversation}
              className="text-sm px-3 py-1 bg-white bg-opacity-20 hover:bg-opacity-30 rounded transition-colors"
            >
              Clear Chat
            </button>
          )}
        </div>
      </div>

      {/* Conversation Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
        {conversation.length === 0 ? (
          // Welcome state with examples
          <div className="h-full flex items-center justify-center">
            <div className="text-center max-w-2xl">
              <MessageSquare className="w-16 h-16 text-purple-500 mx-auto mb-4 opacity-50" />
              <h3 className="text-2xl font-bold text-gray-800 mb-2">
                How can I help you today?
              </h3>
              <p className="text-gray-600 mb-6">
                Describe what you'd like to do in natural language, or choose from these examples:
              </p>

              <div className="space-y-3">
                <p className="text-sm font-semibold text-gray-700 text-left">Income Tax Filing:</p>
                {EXAMPLE_PROMPTS.itr_filing.map((example, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleExampleClick(example)}
                    className="w-full text-left bg-white hover:bg-purple-50 border border-gray-200 hover:border-purple-300 rounded-lg p-3 transition-all text-sm text-gray-700 hover:text-purple-700"
                  >
                    💼 {example}
                  </button>
                ))}

                <p className="text-sm font-semibold text-gray-700 text-left mt-4">DigiLocker:</p>
                {EXAMPLE_PROMPTS.digilocker_download.map((example, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleExampleClick(example)}
                    className="w-full text-left bg-white hover:bg-blue-50 border border-gray-200 hover:border-blue-300 rounded-lg p-3 transition-all text-sm text-gray-700 hover:text-blue-700"
                  >
                    📄 {example}
                  </button>
                ))}

                <p className="text-sm font-semibold text-gray-700 text-left mt-4">EPFO Services:</p>
                {EXAMPLE_PROMPTS.epfo_balance.map((example, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleExampleClick(example)}
                    className="w-full text-left bg-white hover:bg-green-50 border border-gray-200 hover:border-green-300 rounded-lg p-3 transition-all text-sm text-gray-700 hover:text-green-700"
                  >
                    💰 {example}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          // Conversation messages
          <AnimatePresence>
            {conversation.map((msg, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg p-4 ${
                    msg.type === 'user'
                      ? 'bg-purple-600 text-white'
                      : msg.type === 'error'
                      ? 'bg-red-100 text-red-800 border border-red-300'
                      : 'bg-white text-gray-800 border border-gray-200 shadow-sm'
                  }`}
                >
                  {msg.type === 'assistant' && msg.isQuestion && (
                    <div className="flex items-center gap-2 mb-2 text-purple-600">
                      <AlertCircle className="w-4 h-4" />
                      <span className="text-xs font-semibold uppercase">Need More Info</span>
                    </div>
                  )}

                  {msg.type === 'assistant' && msg.taskCreated && (
                    <div className="flex items-center gap-2 mb-2 text-green-600">
                      <Sparkles className="w-4 h-4" />
                      <span className="text-xs font-semibold uppercase">Task Created</span>
                    </div>
                  )}

                  <div className="whitespace-pre-wrap">{msg.content}</div>

                  <div className={`text-xs mt-2 ${
                    msg.type === 'user' ? 'text-purple-200' : 'text-gray-400'
                  }`}>
                    {msg.timestamp.toLocaleTimeString()}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}

        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-start"
          >
            <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
              <div className="flex items-center gap-2 text-gray-600">
                <Loader className="w-4 h-4 animate-spin" />
                <span>Thinking...</span>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Input Area */}
      <form onSubmit={handleSendMessage} className="p-4 bg-white border-t border-gray-200">
        {error && (
          <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        <div className="flex gap-2">
          <input
            id="message-input"
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={
              conversationContext?.conversationId
                ? "Type your response..."
                : "Describe what you'd like to do..."
            }
            disabled={loading}
            className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
          />
          <button
            type="submit"
            disabled={loading || !message.trim()}
            className="px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors flex items-center gap-2"
          >
            {loading ? (
              <Loader className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Send className="w-5 h-5" />
                <span>Send</span>
              </>
            )}
          </button>
        </div>
      </form>
    </motion.div>
  );
}
