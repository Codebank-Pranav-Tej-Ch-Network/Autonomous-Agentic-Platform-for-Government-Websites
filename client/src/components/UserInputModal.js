/**
 * UserInputModal Component
 *
 * Displays when the automation script needs user input for CAPTCHA or OTP.
 * The backend will emit a WebSocket event requesting input, and this modal
 * will appear to collect it from the user.
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, Send, X } from 'lucide-react';

export default function UserInputModal({ isOpen, inputRequest, onSubmit, onCancel }) {
  const [inputValue, setInputValue] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen || !inputRequest) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    setSubmitting(true);
    try {
      await onSubmit(inputValue.trim());
      setInputValue('');
    } catch (error) {
      console.error('Error submitting input:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const getTitle = () => {
    switch (inputRequest.type) {
      case 'captcha':
        return 'CAPTCHA Required';
      case 'otp':
        return 'Enter OTP';
      case 'manual_verification':
        return 'Manual Verification Required';
      default:
        return 'Input Required';
    }
  };

  const getPlaceholder = () => {
    switch (inputRequest.type) {
      case 'captcha':
        return 'Enter the characters you see';
      case 'otp':
        return 'Enter the OTP sent to your mobile/email';
      default:
        return 'Enter the required information';
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-white rounded-xl shadow-2xl w-full max-w-md"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-4 text-white rounded-t-xl flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-6 h-6" />
              <h3 className="text-lg font-bold">{getTitle()}</h3>
            </div>
            <button
              onClick={onCancel}
              className="p-1 hover:bg-white hover:bg-opacity-20 rounded transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            {/* Display CAPTCHA image if available */}
            {inputRequest.data?.captchaImageUrl && (
              <div className="mb-4 flex justify-center">
                <img
                  src={inputRequest.data.captchaImageUrl}
                  alt="CAPTCHA"
                  className="border-2 border-gray-300 rounded-lg max-w-full h-auto"
                />
              </div>
            )}

            {/* Prompt message */}
            <p className="text-gray-700 mb-4">
              {inputRequest.prompt || 'Please provide the requested information to continue with the automation.'}
            </p>

            {/* Input form */}
            <form onSubmit={handleSubmit}>
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={getPlaceholder()}
                autoFocus
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none text-lg"
                disabled={submitting}
              />

              <div className="flex gap-3 mt-4">
                <button
                  type="submit"
                  disabled={!inputValue.trim() || submitting}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full"></div>
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send className="w-5 h-5" />
                      Submit
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={onCancel}
                  className="px-6 bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-3 rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>

            {/* Helper text */}
            <p className="text-sm text-gray-500 mt-4 text-center">
              The automation will pause until you provide this information.
            </p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
