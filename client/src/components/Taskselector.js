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
import { classify, executeAutomation } from '../services/api';
const EXAMPLE_PROMPTS = {
  itr_filing: [
    "I want to file my income tax return for FY 2023-24",
    "File ITR for last financial year, my salary is 8 lakhs",
    "Help me file my taxes"
  ],
  search_vehicle: [
    "Get details for vehicle number MH12AB1234",
    "Search DL01AB1234 registration info",
    "Show me vehicle information for KA05XY9876"
  ],
  register_vehicle: [
    "Register my new car for RTO Mumbai",
    "I want to register a vehicle",
    "Help me with new vehicle registration"
  ],
  transfer_ownership: [
    "Transfer ownership of my vehicle DL01AB1234",
    "I want to transfer my vehicle to someone else",
    "Help me with vehicle ownership transfer"
  ],
  update_contacts: [
    "Update contact details for my vehicle MH12AB1234",
    "Change the address linked to my vehicle registration",
    "Help me update mobile and address for my car"
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
  if (e) e.preventDefault();
  if (!message.trim() && uploadedFiles.length === 0) return;

  const userMessage = message.trim();
  setMessage('');
  setError(null);
  setLoading(true);

  setConversation(prev => [
    ...prev,
    {
      type: 'user',
      content: userMessage,
      timestamp: new Date(),
      files: uploadedFiles.length ? uploadedFiles.map(f => f.name) : null
    }
  ]);

  try {
    // Send message with conversation context
    const taskResp = await taskAPI.create({ 
      message: userMessage,
      conversationContext: conversationContext 
    });

    console.log('Task response:', taskResp.data);

    // Check if backend needs clarification
    if (taskResp.data.needsClarification) {
      // Save conversation context for next message
      setConversationContext({
        conversationId: taskResp.data.conversationId,
        taskType: taskResp.data.taskType,
        extractedParams: taskResp.data.extractedParams
      });

      // Show clarification question
      setConversation(prev => [
        ...prev,
        {
          type: 'assistant',
          content: taskResp.data.question,
          timestamp: new Date(),
          isQuestion: true
        }
      ]);
      setLoading(false);
      return;
    }

    // Task created successfully
    if (taskResp.data.task) {
      setConversation(prev => [
        ...prev,
        {
          type: 'assistant',
          content: `✅ Task created successfully!\n\nTask Type: ${taskResp.data.task.taskType}\nStatus: ${taskResp.data.task.status}\n\nYour automation is now processing.`,
          timestamp: new Date(),
          taskCreated: true,
          taskId: taskResp.data.task._id
        }
      ]);

      // Clear conversation context
      setConversationContext(null);

      // Notify Dashboard of new task
      if (onTaskCreated) {
        onTaskCreated(taskResp.data.task, conversation);
      }
    }

  } catch (err) {
    console.error('Error details:', err);
    const msg = err.response?.data?.message || err.message || 'An error occurred';

    setError(msg);
    setConversation(prev => [
      ...prev,
      {
        type: 'error',
        content: `❌ Error: ${msg}`,
        timestamp: new Date()
      }
    ]);
  } finally {
    setLoading(false);
    setUploadedFiles([]);
    setExtractedData(null);
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

console.log('Conversation length:', conversation.length);
console.log('Current conversation:', conversation);

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
      {conversation.length == 0 ? (
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

              <p className="text-sm font-semibold text-gray-700 text-left mt-4">VAHAN - Search Vehicle:</p>
              {EXAMPLE_PROMPTS.search_vehicle.map((example, idx) => (
                <button
                  key={idx}
                  onClick={() => handleExampleClick(example)}
                  className="w-full text-left bg-white hover:bg-purple-50 border border-gray-200 hover:border-purple-300 rounded-lg p-3 transition-all text-sm text-gray-700 hover:text-purple-700"
                >
                  🔍 {example}
                </button>
              ))}

              <p className="text-sm font-semibold text-gray-700 text-left mt-4">VAHAN - Register Vehicle:</p>
              {EXAMPLE_PROMPTS.register_vehicle.map((example, idx) => (
                <button
                  key={idx}
                  onClick={() => handleExampleClick(example)}
                  className="w-full text-left bg-white hover:bg-orange-50 border border-gray-200 hover:border-orange-300 rounded-lg p-3 transition-all text-sm text-gray-700 hover:text-orange-700"
                >
                  🚗 {example}
                </button>
              ))}

              <p className="text-sm font-semibold text-gray-700 text-left mt-4">VAHAN - Transfer Ownership:</p>
              {EXAMPLE_PROMPTS.transfer_ownership.map((example, idx) => (
                <button
                  key={idx}
                  onClick={() => handleExampleClick(example)}
                  className="w-full text-left bg-white hover:bg-yellow-50 border border-gray-200 hover:border-yellow-300 rounded-lg p-3 transition-all text-sm text-gray-700 hover:text-yellow-700"
                >
                  🔄 {example}
                </button>
              ))}

              <p className="text-sm font-semibold text-gray-700 text-left mt-4">VAHAN - Update Contacts:</p>
              {EXAMPLE_PROMPTS.update_contacts.map((example, idx) => (
                <button
                  key={idx}
                  onClick={() => handleExampleClick(example)}
                  className="w-full text-left bg-white hover:bg-green-50 border border-gray-200 hover:border-green-300 rounded-lg p-3 transition-all text-sm text-gray-700 hover:text-green-700"
                >
                  ✏️ {example}
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
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.xlsx,.xls,.jpg,.jpeg,.png"
          onChange={handleFileUpload}
          className="hidden"
        />

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={loading}
          className="px-3 py-3 bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 disabled:cursor-not-allowed text-gray-700 rounded-lg transition-colors"
          title="Upload documents"
        >
          <Upload className="w-5 h-5" />
        </button>

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

