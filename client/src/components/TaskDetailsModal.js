import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, CheckCircle, AlertCircle, Download, 
  FileText, DollarSign, Calendar, User,
  Building, CreditCard, TrendingUp, XCircle
} from 'lucide-react';
import api from '../services/api';

export default function TaskDetailsModal({ task, onClose }) {
  const [captchaSolution, setCaptchaSolution] = useState('');
  const [submittingCaptcha, setSubmittingCaptcha] = useState(false);

  if (!task) return null;

  const handleCaptchaSubmit = async () => {
    if (!captchaSolution.trim()) {
      alert('Please enter the captcha code');
      return;
    }

    setSubmittingCaptcha(true);
    try {
      const inputData = {};
      for (const [key, value] of task.inputData.entries()) {
        inputData[key] = value;
      }

      const response = await api.post('/automation/execute', {
        taskType: task.taskType,
        sessionId: task.result.sessionId,
        captcha: captchaSolution,
        ...inputData
      });

      if (response.data.success) {
        alert('Captcha verified! Results will update shortly.');
        window.location.reload();
      } else {
        alert(response.data.message || 'Failed to verify captcha');
      }
    } catch (error) {
      alert('Error: ' + error.message);
    } finally {
      setSubmittingCaptcha(false);
    }
  };

  // Render ITR Filing Results
  const renderITRResults = () => {
    const result = task.result;

    if (!result || !result.success) {
      return (
        <div className="text-center py-8 text-red-600">
          <XCircle className="w-12 h-12 mx-auto mb-4" />
          <p className="font-semibold">ITR Filing Failed</p>
          <p className="text-sm text-gray-600 mt-2">{result?.message || 'Unknown error'}</p>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {/* Success Header */}
        <div className="bg-green-50 border-2 border-green-200 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
            <div>
              <h3 className="text-xl font-bold text-green-900">ITR Filed Successfully!</h3>
              <p className="text-sm text-green-700 mt-1">
                {new Date(result.filedDate || task.completedAt).toLocaleDateString('en-IN', { 
                  dateStyle: 'long' 
                })}
              </p>
            </div>
          </div>
          
          {result.ackNumber && (
            <div className="bg-white rounded-lg p-4 mt-4">
              <p className="text-sm text-gray-600 mb-1">Acknowledgement Number</p>
              <p className="text-2xl font-mono font-bold text-gray-900">{result.ackNumber}</p>
            </div>
          )}
        </div>

        {/* Filing Details Grid */}
        <div className="grid grid-cols-2 gap-4">
          <InfoCard 
            icon={<Calendar className="w-5 h-5 text-blue-600" />}
            label="Assessment Year"
            value={result.assessmentYear || '-'}
          />
          <InfoCard 
            icon={<FileText className="w-5 h-5 text-purple-600" />}
            label="ITR Type"
            value={result.itrType || 'ITR-1'}
          />
          <InfoCard 
            icon={<DollarSign className="w-5 h-5 text-green-600" />}
            label="Total Income"
            value={result.totalIncome ? `₹${result.totalIncome.toLocaleString('en-IN')}` : '-'}
          />
          <InfoCard 
            icon={<TrendingUp className="w-5 h-5 text-orange-600" />}
            label="Tax Paid"
            value={result.taxPaid ? `₹${result.taxPaid.toLocaleString('en-IN')}` : '-'}
          />
        </div>

        {/* Refund Section */}
        {result.refundAmount && result.refundAmount > 0 && (
          <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-6">
            <div className="flex items-center gap-3">
              <CreditCard className="w-6 h-6 text-blue-600" />
              <div>
                <p className="text-sm text-blue-700 font-medium">Refund Amount</p>
                <p className="text-3xl font-bold text-blue-900">
                  ₹{result.refundAmount.toLocaleString('en-IN')}
                </p>
                <p className="text-sm text-blue-600 mt-1">
                  Will be credited to your bank account
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Documents Section */}
        {result.documents && result.documents.length > 0 && (
          <div className="border-t pt-6">
            <h4 className="font-semibold mb-4 flex items-center gap-2">
              <Download className="w-5 h-5" />
              Available Documents
            </h4>
            <div className="space-y-2">
              {result.documents.map((doc, idx) => (
                <a
                  key={idx}
                  href={doc.url || doc.path}
                  download
                  className="flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-gray-600" />
                    <div>
                      <p className="font-medium text-gray-900">{doc.type || 'Document'}</p>
                      <p className="text-sm text-gray-600">{doc.filename}</p>
                    </div>
                  </div>
                  <Download className="w-5 h-5 text-blue-600" />
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Input Data Summary */}
        <div className="border-t pt-6">
          <h4 className="font-semibold mb-4">Filing Details</h4>
          <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
            {Array.from(task.inputData.entries()).map(([key, value]) => (
              <div key={key} className="flex justify-between">
                <span className="text-gray-600 capitalize">{key.replace(/([A-Z])/g, ' $1')}:</span>
                <span className="font-medium text-gray-900">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // Render VAHAN Results
  const renderVAHANResults = () => {
    const result = task.result;

    // Step 1: Show captcha
    if (result.needsCaptcha && result.captchaImageBase64) {
      return (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-yellow-600">
            <AlertCircle className="w-5 h-5" />
            <p className="font-semibold">Captcha Verification Required</p>
          </div>

          <img 
            src={result.captchaImageBase64} 
            alt="Captcha" 
            className="mx-auto border-2 border-gray-300 rounded-lg"
            style={{ maxWidth: '300px' }}
          />

          <div className="space-y-3">
            <input
              type="text"
              placeholder="Enter captcha code"
              value={captchaSolution}
              onChange={(e) => setCaptchaSolution(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleCaptchaSubmit()}
              className="w-full px-4 py-2 border-2 border-blue-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={submittingCaptcha}
            />
            
            <button
              onClick={handleCaptchaSubmit}
              disabled={submittingCaptcha}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submittingCaptcha ? 'Verifying...' : 'Submit Captcha'}
            </button>
          </div>
        </div>
      );
    }

    // Step 2: Show vehicle data
    if (result.data) {
      const data = result.data;
      return (
        <div className="space-y-6">
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle className="w-5 h-5" />
            <p className="font-semibold">Vehicle Details Retrieved</p>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <DetailItem label="Reg No" value={data.regNo} />
            <DetailItem label="Reg Date" value={data.regDate} />
            <DetailItem label="RTO" value={data.rto} />
            <DetailItem label="Class" value={data.class} />
            <DetailItem label="Fuel" value={data.fuel} />
            <DetailItem label="Model" value={data.model} />
            <DetailItem label="Year" value={data.year} />
            <DetailItem label="Color" value={data.color} />
          </div>

          <div className="border-t pt-4">
            <h4 className="font-semibold mb-3 flex items-center gap-2">
              <User className="w-5 h-5" />
              Owner Details
            </h4>
            <div className="space-y-2 text-sm">
              <DetailItem label="Name" value={data.ownerName} />
              <DetailItem label="Mobile" value={data.mobile} />
              <DetailItem label="Email" value={data.email} />
              <DetailItem label="Address" value={data.address} />
            </div>
          </div>

          <div className="border-t pt-4">
            <h4 className="font-semibold mb-3 flex items-center gap-2">
              <Building className="w-5 h-5" />
              Insurance Details
            </h4>
            <div className="space-y-2 text-sm">
              <DetailItem label="Company" value={data.insCompany} />
              <DetailItem label="Policy No" value={data.policyNo} />
              <DetailItem label="Valid Upto" value={data.insUpto} />
              <DetailItem label="Status" value={data.insStatus} highlight />
            </div>
          </div>
        </div>
      );
    }

    return <p className="text-gray-600">{result.message || 'Task completed successfully'}</p>;
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between z-10">
            <div>
              <h2 className="text-2xl font-bold capitalize">
                {task.taskType?.replace('_', ' ')} Task
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Created: {new Date(task.createdAt).toLocaleString()}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            {task.taskType === 'itr_filing' && renderITRResults()}
            {task.taskType === 'search' && renderVAHANResults()}
            {!['itr_filing', 'search'].includes(task.taskType) && (
              <p className="text-gray-600 text-center py-8">
                {task.result?.message || 'Task details not available'}
              </p>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// Helper Components
const InfoCard = ({ icon, label, value }) => (
  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
    <div className="flex items-center gap-2 mb-2">
      {icon}
      <span className="text-sm text-gray-600">{label}</span>
    </div>
    <p className="text-lg font-bold text-gray-900">{value}</p>
  </div>
);

const DetailItem = ({ label, value, highlight }) => (
  <div className={`flex justify-between py-2 px-3 rounded ${highlight ? 'bg-green-50' : 'bg-gray-50'}`}>
    <span className="font-medium text-gray-700">{label}:</span>
    <span className={highlight ? 'text-green-700 font-semibold' : 'text-gray-900'}>
      {value || '-'}
    </span>
  </div>
);

