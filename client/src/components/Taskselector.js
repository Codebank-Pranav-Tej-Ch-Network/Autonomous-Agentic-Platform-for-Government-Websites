/**
 * TaskSelector Component - COMPLETE FINAL VERSION
 *
 * ALL FIXES INCLUDED:
 * - Multi-line textarea input ✅
 * - File upload support (PDF, Excel, Images) ✅
 * - Increased timeout to 60s for LLM processing ✅
 * - Custom data input table ✅
 * - Better error handling ✅
 * - Retry mechanism ✅
 */

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send, Loader, MessageSquare, Sparkles, AlertCircle, RefreshCw,
  Upload, X, FileText, Table as TableIcon, Image as ImageIcon
} from 'lucide-react';
import { taskAPI } from '../services/api';
import { toast } from 'react-toastify';

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
  const [retryCount, setRetryCount] = useState(0);

  // File upload states
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [extractedData, setExtractedData] = useState(null);
  const [showDataTable, setShowDataTable] = useState(false);
  const [tableData, setTableData] = useState({
    salary: '',
    deductions: '',
    otherIncome: '',
    taxPaid: ''
  });

  const textareaRef = useRef(null);
  const conversationEndRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [message]);

  useEffect(() => {
    conversationEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation]);

  /**
   * FIXED: Handle file upload and extraction
   */
  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);

    if (files.length === 0) return;

    // Validate file types
    const validTypes = [
      'application/pdf',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'image/jpeg',
      'image/png',
      'image/jpg'
    ];

    const invalidFiles = files.filter(f => !validTypes.includes(f.type));
    if (invalidFiles.length > 0) {
      toast.error('Please upload only PDF, Excel, or image files');
      return;
    }

    // Validate file size (max 10MB per file)
    const oversizedFiles = files.filter(f => f.size > 10 * 1024 * 1024);
    if (oversizedFiles.length > 0) {
      toast.error('Files must be under 10MB each');
      return;
    }

    setUploadedFiles(prev => [...prev, ...files]);
    toast.success(`${files.length} file(s) uploaded successfully`);

    // Extract data from files using AI
    await extractDataFromFiles(files);
  };

  /**
   * Extract structured data from uploaded files using Gemini Vision/Document AI
   */
  const extractDataFromFiles = async (files) => {
    try {
      toast.info('Analyzing your documents...');

      const formData = new FormData();
      files.forEach(file => formData.append('files', file));

      // Call backend API to extract data using Gemini
      const response = await taskAPI.extractDataFromFiles(formData);

      const extracted = response.data.extractedData;
      setExtractedData(extracted);

      // Pre-fill table data with extracted values
      if (extracted) {
        setTableData({
          salary: extracted.salary || '',
          deductions: extracted.deductions || '',
          otherIncome: extracted.otherIncome || '',
          taxPaid: extracted.taxPaid || ''
        });
      }

      toast.success('Data extracted from documents!');

      // Add to conversation
      setConversation(prev => [...prev, {
        type: 'assistant',
        content: `I've analyzed your documents and extracted the following information:\n\n${
          Object.entries(extracted)
            .filter(([_, value]) => value)
            .map(([key, value]) => `• ${key}: ${value}`)
            .join('\n')
        }\n\nYou can review and edit this data below before submitting.`,
        timestamp: new Date(),
        hasExtractedData: true
      }]);

      setShowDataTable(true);

    } catch (error) {
      console.error('Error extracting data:', error);
      toast.error('Failed to extract data from files. Please enter manually.');
      setShowDataTable(true); // Still show table for manual entry
    }
  };

  /**
   * Remove uploaded file
   */
  const removeFile = (index) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  /**
   * Handle table data input
   */
  const handleTableInput = (field, value) => {
    setTableData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  /**
   * Submit table data as clarification response
   */
  const handleSubmitTableData = async () => {
    const dataString = Object.entries(tableData)
      .filter(([_, value]) => value)
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ');

    if (!dataString) {
      toast.error('Please enter at least one field');
      return;
    }

    setMessage(dataString);
    await handleSendMessage({ preventDefault: () => {} });
    setShowDataTable(false);
  };

  /**
   * FIXED: Handle sending message with increased timeout
   */
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!message.trim() && uploadedFiles.length === 0) return;

    const userMessage = message.trim();
    setMessage('');
    setError(null);
    setLoading(true);

    setConversation(prev => [...prev, {
      type: 'user',
      content: userMessage,
      timestamp: new Date(),
      files: uploadedFiles.length > 0 ? uploadedFiles.map(f => f.name) : null
    }]);

    try {
      let response;

      // CRITICAL FIX: Increased timeout to 60 seconds
      const timeoutConfig = { timeout: 60000 }; // 60 seconds

      if (conversationContext?.conversationId) {
        console.log('Sending clarification response');
        response = await taskAPI.clarify({
          conversationId: conversationContext.conversationId,
          response: userMessage,
          previousContext: conversationContext,
          uploadedFiles: uploadedFiles.map(f => f.name)
        }, timeoutConfig);
      } else {
        console.log('Sending new task request');
        response = await taskAPI.create({
          message: userMessage,
          conversationContext: null,
          uploadedFiles: uploadedFiles.map(f => f.name),
          extractedData: extractedData
        }, timeoutConfig);
      }

      const data = response.data;

      if (!data || typeof data !== 'object') {
        throw new Error('Invalid response from server');
      }

      if (data.needsClarification) {
        const lastAssistantMsg = conversation
          .filter(msg => msg.type === 'assistant' && msg.isQuestion)
          .slice(-1)[0];

        if (lastAssistantMsg && lastAssistantMsg.content === data.question) {
          setRetryCount(prev => prev + 1);

          if (retryCount >= 2) {
            throw new Error('Unable to understand your request after multiple attempts. Please provide more specific information or use the data input table.');
          }
        } else {
          setRetryCount(0);
        }

        // Check if this is a financial data request
        const needsFinancialData = data.missingFields?.some(f =>
          ['income', 'salary', 'deductions', 'taxPaid'].includes(f.field)
        );

        setConversation(prev => [...prev, {
          type: 'assistant',
          content: data.question || data.message,
          timestamp: new Date(),
          isQuestion: true,
          needsFinancialData
        }]);

        setConversationContext({
          conversationId: data.conversationId,
          taskType: data.taskType,
          originalMessage: conversationContext?.originalMessage || userMessage,
          extractedParams: data.extractedParams || {},
          missingFields: data.missingFields || []
        });

        // Show data input options for financial data
        if (needsFinancialData) {
          setConversation(prev => [...prev, {
            type: 'assistant',
            content: 'You can provide this information by:\n1. Uploading your salary slip, Form 16, or tax documents\n2. Using the data entry table below\n3. Simply typing the information in your message',
            timestamp: new Date(),
            showInputOptions: true
          }]);
        }

      } else if (data.task) {
        setConversation(prev => [...prev, {
          type: 'assistant',
          content: `Great! I've created your ${data.task.taskType?.replace('_', ' ')} task and it's being processed. You can track its progress in real-time.`,
          timestamp: new Date(),
          taskCreated: true,
          taskId: data.task.id
        }]);

        setConversationContext(null);
        setRetryCount(0);
        setUploadedFiles([]);
        setExtractedData(null);

        if (onTaskCreated) {
          onTaskCreated(data.task);
        }

        toast.success('Task created successfully!');
      }

    } catch (err) {
      console.error('Error sending message:', err);

      let errorMessage = 'Something went wrong. Please try again.';

      if (err.code === 'ECONNABORTED' || err.message.includes('timeout')) {
        errorMessage = 'The request is taking longer than expected. The AI is processing your request in the background. You can check the task status in a moment.';
      } else if (err.response?.status === 429) {
        errorMessage = 'Too many requests. Please wait a moment and try again.';
      } else if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err.message) {
        errorMessage = err.message;
      }

      setError(errorMessage);

      setConversation(prev => [...prev, {
        type: 'error',
        content: errorMessage,
        timestamp: new Date()
      }]);

      toast.error(errorMessage);

      if (retryCount >= 2) {
        handleClearConversation();
        toast.info('Conversation reset. Please start over with a clearer request.');
      }

    } finally {
      setLoading(false);
    }
  };

  const handleExampleClick = (example) => {
    setMessage(example);
    textareaRef.current?.focus();
  };

  const handleClearConversation = () => {
    setConversation([]);
    setConversationContext(null);
    setMessage('');
    setError(null);
    setRetryCount(0);
    setUploadedFiles([]);
    setExtractedData(null);
    setShowDataTable(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e);
    }
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
              className="text-sm px-3 py-1 bg-white bg-opacity-20 hover:bg-opacity-30 rounded transition-colors flex items-center gap-1"
            >
              <RefreshCw className="w-4 h-4" />
              Clear Chat
            </button>
          )}
        </div>
      </div>

      {/* Conversation Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
        {conversation.length === 0 ? (
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
          <>
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

                    {msg.files && msg.files.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-purple-400">
                        <p className="text-xs opacity-75">Attached: {msg.files.join(', ')}</p>
                      </div>
                    )}

                    {msg.showInputOptions && (
                      <div className="mt-3 space-y-2">
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="w-full bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-2 rounded text-sm flex items-center justify-center gap-2 transition-colors"
                        >
                          <Upload className="w-4 h-4" />
                          Upload Documents
                        </button>
                        <button
                          onClick={() => setShowDataTable(true)}
                          className="w-full bg-green-50 hover:bg-green-100 text-green-700 px-3 py-2 rounded text-sm flex items-center justify-center gap-2 transition-colors"
                        >
                          <TableIcon className="w-4 h-4" />
                          Use Data Entry Table
                        </button>
                      </div>
                    )}

                    <div className={`text-xs mt-2 ${
                      msg.type === 'user' ? 'text-purple-200' : 'text-gray-400'
                    }`}>
                      {msg.timestamp.toLocaleTimeString()}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {loading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex justify-start"
              >
                <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                  <div className="flex items-center gap-2 text-gray-600">
                    <Loader className="w-4 h-4 animate-spin" />
                    <span>Processing... This may take up to 60 seconds</span>
                  </div>
                </div>
              </motion.div>
            )}

            <div ref={conversationEndRef} />
          </>
        )}
      </div>

      {/* Data Entry Table Modal */}
      <AnimatePresence>
        {showDataTable && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-10"
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="bg-white rounded-xl p-6 max-w-md w-full"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-800">Enter Financial Data</h3>
                <button
                  onClick={() => setShowDataTable(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Annual Salary (₹)
                  </label>
                  <input
                    type="number"
                    value={tableData.salary}
                    onChange={(e) => handleTableInput('salary', e.target.value)}
                    placeholder="e.g., 800000"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tax Deductions (₹)
                  </label>
                  <input
                    type="number"
                    value={tableData.deductions}
                    onChange={(e) => handleTableInput('deductions', e.target.value)}
                    placeholder="e.g., 150000 (80C, 80D, etc.)"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Other Income (₹) - Optional
                  </label>
                  <input
                    type="number"
                    value={tableData.otherIncome}
                    onChange={(e) => handleTableInput('otherIncome', e.target.value)}
                    placeholder="e.g., 50000"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tax Already Paid (₹) - Optional
                  </label>
                  <input
                    type="number"
                    value={tableData.taxPaid}
                    onChange={(e) => handleTableInput('taxPaid', e.target.value)}
                    placeholder="e.g., 25000"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              <div className="flex gap-2 mt-6">
                <button
                  onClick={handleSubmitTableData}
                  className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 rounded-lg transition-colors"
                >
                  Submit Data
                </button>
                <button
                  onClick={() => setShowDataTable(false)}
                  className="px-6 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-2 rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input Area */}
      <form onSubmit={handleSendMessage} className="p-4 bg-white border-t border-gray-200">
        {error && (
          <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-start gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Uploaded Files Display */}
        {uploadedFiles.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {uploadedFiles.map((file, idx) => (
              <div key={idx} className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-1 text-sm">
                {file.type.includes('image') ? <ImageIcon className="w-4 h-4 text-blue-600" /> : <FileText className="w-4 h-4 text-blue-600" />}
                <span className="text-blue-800">{file.name}</span>
                <button
                  type="button"
                  onClick={() => removeFile(idx)}
                  className="text-blue-600 hover:text-blue-800"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2 items-end">
          {/* Hidden File Input */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.xlsx,.xls,.jpg,.jpeg,.png"
            onChange={handleFileUpload}
            className="hidden"
          />

          {/* Upload Button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
            className="px-3 py-3 bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 disabled:cursor-not-allowed text-gray-700 rounded-lg transition-colors"
            title="Upload documents"
          >
            <Upload className="w-5 h-5" />
          </button>

          {/* Data Table Button */}
          <button
            type="button"
            onClick={() => setShowDataTable(true)}
            disabled={loading}
            className="px-3 py-3 bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 disabled:cursor-not-allowed text-gray-700 rounded-lg transition-colors"
            title="Enter data manually"
          >
            <TableIcon className="w-5 h-5" />
          </button>

          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                conversationContext?.conversationId
                  ? "Type your response... (Shift+Enter for new line)"
                  : "Describe what you'd like to do... (Shift+Enter for new line)"
              }
              disabled={loading}
              rows={1}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed resize-none overflow-hidden"
              style={{
                minHeight: '48px',
                maxHeight: '150px'
              }}
            />
            <div className="absolute bottom-2 right-2 text-xs text-gray-400">
              Press Enter to send
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || (!message.trim() && uploadedFiles.length === 0)}
            className="px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors flex items-center gap-2 h-12"
          >
            {loading ? (
              <Loader className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Send className="w-5 h-5" />
                <span className="hidden sm:inline">Send</span>
              </>
            )}
          </button>
        </div>
      </form>
    </motion.div>
  );
}
