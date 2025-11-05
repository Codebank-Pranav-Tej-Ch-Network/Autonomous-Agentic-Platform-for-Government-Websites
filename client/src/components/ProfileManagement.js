/**
 * ProfileManagement Component - Complete Implementation
 * * This provides a modal-based profile management interface with:
 * - View/Edit personal information
 * - Manage government IDs (PAN, Aadhaar, UAN)
 * - Add/Edit bank accounts
 * - Sign out functionality
 * - Account deletion with confirmation
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, User, Mail, Phone, CreditCard, Calendar, MapPin, Building,
  Save, LogOut, Trash2, AlertTriangle, CheckCircle, Eye, EyeOff
} from 'lucide-react';
import { authAPI } from '../services/api';
import { toast } from 'react-toastify';

export default function ProfileManagement({ isOpen, onClose, onLogout, onProfileUpdated }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showAadhaar, setShowAadhaar] = useState(false);

  const [formData, setFormData] = useState({
    personalInfo: {
      fullName: '',
      dateOfBirth: '',
      mobile: '',
      address: {
        line1: '',
        line2: '',
        city: '',
        state: '',
        pincode: ''
      }
    },
    governmentIds: {
      pan: '',
      aadhaar: '',
      uan: ''
    },
    bankDetails: []
  });

  useEffect(() => {
    if (isOpen) {
      loadProfile();
    }
  }, [isOpen]);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const response = await authAPI.getProfile();
      const userData = response.data.data.user;

      setProfile(userData);

      // Populate form with existing data
      setFormData({
        personalInfo: {
          fullName: userData.personalInfo?.fullName || '',
          dateOfBirth: userData.personalInfo?.dateOfBirth
            ? new Date(userData.personalInfo.dateOfBirth).toISOString().split('T')[0]
            : '',
          mobile: userData.personalInfo?.mobile || '',
          address: {
            line1: userData.personalInfo?.address?.line1 || '',
            line2: userData.personalInfo?.address?.line2 || '',
            city: userData.personalInfo?.address?.city || '',
            state: userData.personalInfo?.address?.state || '',
            pincode: userData.personalInfo?.address?.pincode || ''
          }
        },
        governmentIds: {
          pan: userData.governmentIds?.pan || '',
          aadhaar: '', // Never pre-fill Aadhaar for security
          uan: userData.governmentIds?.uan || ''
        },
        bankDetails: userData.bankDetails || []
      });

    } catch (error) {
      console.error('Error loading profile:', error);
      toast.error('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (section, field, value) => {
    if (section === 'address') {
      setFormData(prev => ({
        ...prev,
        personalInfo: {
          ...prev.personalInfo,
          address: {
            ...prev.personalInfo.address,
            [field]: value
          }
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [section]: {
          ...prev[section],
          [field]: value
        }
      }));
    }
  };

  const handleSaveProfile = async () => {
    try {
      setSaving(true);

      const updatePayload = {};

      // Add all personal info fields
      updatePayload['personalInfo.fullName'] = formData.personalInfo.fullName;
      updatePayload['personalInfo.dateOfBirth'] = formData.personalInfo.dateOfBirth;
      updatePayload['personalInfo.mobile'] = formData.personalInfo.mobile;
      updatePayload['personalInfo.address.line1'] = formData.personalInfo.address.line1;
      updatePayload['personalInfo.address.line2'] = formData.personalInfo.address.line2;
      updatePayload['personalInfo.address.city'] = formData.personalInfo.address.city;
      updatePayload['personalInfo.address.state'] = formData.personalInfo.address.state;
      updatePayload['personalInfo.address.pincode'] = formData.personalInfo.address.pincode;

      // Add new Aadhaar (as a STRING) if provided
      if (formData.governmentIds.aadhaar && formData.governmentIds.aadhaar.length === 12) {
        updatePayload['governmentIds.aadhaar'] = formData.governmentIds.aadhaar;
      }

      // --- THIS IS THE FIX ---
      // Compare the current form UAN to the *original* UAN (or an empty string)
      // This prevents sending an empty UAN on every save.
      const originalUan = profile.governmentIds?.uan || '';
      if (formData.governmentIds.uan !== originalUan) {
        updatePayload['governmentIds.uan'] = formData.governmentIds.uan;
      }
      // --- END OF FIX ---

      // Add bank details
      updatePayload['bankDetails'] = formData.bankDetails;

      // Send the clean, flat payload
      await authAPI.updateProfile(updatePayload);

      toast.success('Profile updated successfully!');
      setEditMode(false);

      // Reload profile to show updated data
      await loadProfile();

      // Notify parent component
      if (onProfileUpdated) {
        onProfileUpdated();
      }

    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error(error.response?.data?.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };
  const handleAddBankAccount = () => {
    setFormData(prev => ({
      ...prev,
      bankDetails: [
        ...prev.bankDetails,
        {
          bankName: '',
          accountNumber: '',
          ifscCode: '',
          accountType: 'savings',
          isPrimary: prev.bankDetails.length === 0
        }
      ]
    }));
  };

  const handleRemoveBankAccount = (index) => {
    setFormData(prev => ({
      ...prev,
      bankDetails: prev.bankDetails.filter((_, i) => i !== index)
    }));
  };

  const handleBankDetailChange = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      bankDetails: prev.bankDetails.map((account, i) =>
        i === index ? { ...account, [field]: value } : account
      )
    }));
  };

  const handleSetPrimaryBank = (index) => {
    setFormData(prev => ({
      ...prev,
      bankDetails: prev.bankDetails.map((account, i) => ({
        ...account,
        isPrimary: i === index
      }))
    }));
  };

  const handleSignOut = () => {
    localStorage.removeItem('authToken');
    toast.success('Signed out successfully');
    onClose(); // Close the modal first
    if (onLogout) {
      onLogout();
    }
  };

  const handleDeleteAccount = async () => {
    if (!showDeleteConfirm) {
      setShowDeleteConfirm(true);
      return;
    }

    try {
      // You'll need to implement this endpoint in your backend
      // For now, just sign them out
      toast.info('Account deletion feature coming soon');
      handleSignOut();
    } catch (error) {
      toast.error('Failed to delete account');
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-purple-600 to-blue-600 p-6 text-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <User className="w-8 h-8" />
              <div>
                <h2 className="text-2xl font-bold">Profile Management</h2>
                <p className="text-sm opacity-90">
                  {profile?.profileCompleteness}% Complete
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {loading ? (
            <div className="p-12 text-center text-gray-500">
              <div className="animate-spin w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full mx-auto mb-4"></div>
              <p>Loading profile...</p>
            </div>
          ) : (
            <div className="overflow-y-auto max-h-[calc(90vh-120px)] p-6">
              {/* Action Buttons */}
              <div className="flex gap-3 mb-6">
                {!editMode ? (
                  <button
                    onClick={() => setEditMode(true)}
                    className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                  >
                    Edit Profile
                  </button>
                ) : (
                  <>
                    <button
                      onClick={handleSaveProfile}
                      disabled={saving}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {saving ? (
                        <>
                          <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4" />
                          Save Changes
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setEditMode(false);
                        loadProfile();
                      }}
                      className="px-6 bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-2 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                  </>
                )}
              </div>

              {/* Personal Information Section */}
              <div className="bg-gray-50 rounded-lg p-6 mb-6">
                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <User className="w-5 h-5 text-purple-600" />
                  Personal Information
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={formData.personalInfo.fullName}
                      onChange={(e) => handleInputChange('personalInfo', 'fullName', e.target.value)}
                      disabled={!editMode}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 disabled:bg-gray-100"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Date of Birth
                    </label>
                    <input
                      type="date"
                      value={formData.personalInfo.dateOfBirth}
                      onChange={(e) => handleInputChange('personalInfo', 'dateOfBirth', e.target.value)}
                      disabled={!editMode}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 disabled:bg-gray-100"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="email"
                        value={profile?.email || ''}
                        disabled
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg bg-gray-100"
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Mobile Number
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="tel"
                        value={formData.personalInfo.mobile}
                        onChange={(e) => handleInputChange('personalInfo', 'mobile', e.target.value)}
                        disabled={!editMode}
                        pattern="[0-9]{10}"
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 disabled:bg-gray-100"
                      />
                    </div>
                  </div>
                </div>

                {/* Address */}
                <div className="mt-4">
                  <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    Address
                  </h4>
                  <div className="grid grid-cols-1 gap-3">
                    <input
                      type="text"
                      placeholder="Address Line 1"
                      value={formData.personalInfo.address.line1}
                      onChange={(e) => handleInputChange('address', 'line1', e.target.value)}
                      disabled={!editMode}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 disabled:bg-gray-100"
                    />
                    <input
                      type="text"
                      placeholder="Address Line 2 (Optional)"
                      value={formData.personalInfo.address.line2}
                      onChange={(e) => handleInputChange('address', 'line2', e.target.value)}
                      disabled={!editMode}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 disabled:bg-gray-100"
                    />
                    <div className="grid grid-cols-3 gap-3">
                      <input
                        type="text"
                        placeholder="City"
                        value={formData.personalInfo.address.city}
                        onChange={(e) => handleInputChange('address', 'city', e.target.value)}
                        disabled={!editMode}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 disabled:bg-gray-100"
                      />
                      <input
                        type="text"
                        placeholder="State"
                        value={formData.personalInfo.address.state}
                        onChange={(e) => handleInputChange('address', 'state', e.target.value)}
                        disabled={!editMode}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 disabled:bg-gray-100"
                      />
                      <input
                        type="text"
                        placeholder="Pincode"
                        value={formData.personalInfo.address.pincode}
                        onChange={(e) => handleInputChange('address', 'pincode', e.target.value)}
                        disabled={!editMode}
                        maxLength={6}
                        pattern="[0-9]{6}"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 disabled:bg-gray-100"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Government IDs Section */}
              <div className="bg-gray-50 rounded-lg p-6 mb-6">
                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-purple-600" />
                  Government IDs
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      PAN Number
                    </label>
                    <input
                      type="text"
                      value={formData.governmentIds.pan}
                      disabled
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 uppercase"
                    />
                    <p className="text-xs text-gray-500 mt-1">PAN cannot be changed</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center justify-between">
                      <span>Aadhaar Number</span>
                      {profile?.governmentIds?.hasAadhaar && (
                        <span className="text-xs text-green-600 flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" />
                          Stored Securely
                        </span>
                      )}
                    </label>
                    <div className="relative">
                      <input
                        type={showAadhaar ? "text" : "password"}
                        value={formData.governmentIds.aadhaar}
                        onChange={(e) => handleInputChange('governmentIds', 'aadhaar', e.target.value)}
                        disabled={!editMode}
                        maxLength={12}
                        pattern="[0-D]{12}"
                        placeholder={profile?.governmentIds?.hasAadhaar ? "••••••••••••" : "Enter 12-digit Aadhaar"}
                        className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 disabled:bg-gray-100"
                      />
                      {editMode && (
                        <button
                          type="button"
                          onClick={() => setShowAadhaar(!showAadhaar)}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          {showAadhaar ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Stored encrypted. Leave blank if you don't want to update.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      UAN (Universal Account Number)
                    </label>
                    <input
                      type="text"
                      value={formData.governmentIds.uan}
                      onChange={(e) => handleInputChange('governmentIds', 'uan', e.target.value)}
                      disabled={!editMode}
                      maxLength={12}
                      pattern="[0-9]{12}"
                      placeholder="12-digit UAN for EPFO"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 disabled:bg-gray-100"
                    />
                  </div>
                </div>
              </div>

              {/* Bank Details Section */}
              <div className="bg-gray-50 rounded-lg p-6 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                    <Building className="w-5 h-5 text-purple-600" />
                    Bank Accounts
                  </h3>
                  {editMode && (
                    <button
                      onClick={handleAddBankAccount}
                      className="text-sm bg-purple-100 text-purple-700 hover:bg-purple-200 px-3 py-1 rounded-lg transition-colors"
                    >
                      + Add Bank Account
                    </button>
                  )}
                </div>

                {formData.bankDetails.length === 0 ? (
                  <p className="text-gray-500 text-center py-6">No bank accounts added yet</p>
                ) : (
                  <div className="space-y-4">
                    {formData.bankDetails.map((account, index) => (
                      <div key={index} className="bg-white border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            {account.isPrimary && (
                              <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">
                                Primary
                              </span>
                            )}
                          </div>
                          {editMode && (
                            <div className="flex gap-2">
                              {!account.isPrimary && (
                                <button
                                  onClick={() => handleSetPrimaryBank(index)}
                                  className="text-xs text-purple-600 hover:text-purple-700"
                                >
                                  Set as Primary
                                </button>
                              )}
                              <button
                                onClick={() => handleRemoveBankAccount(index)}
                                className="text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <input
                            type="text"
                            placeholder="Bank Name"
                            value={account.bankName}
                            onChange={(e) => handleBankDetailChange(index, 'bankName', e.target.value)}
                            disabled={!editMode}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 disabled:bg-gray-100"
                          />
                          <input
                            type="text"
                            placeholder="Account Number"
                            value={account.accountNumber}
                            onChange={(e) => handleBankDetailChange(index, 'accountNumber', e.target.value)}
                            disabled={!editMode}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 disabled:bg-gray-100"
                          />
                          <input
                            type="text"
                            placeholder="IFSC Code"
                            value={account.ifscCode}
                            onChange={(e) => handleBankDetailChange(index, 'ifscCode', e.target.value.toUpperCase())}
                            disabled={!editMode}
                            maxLength={11}
                            pattern="[A-Z]{4}0[A-Z0-9]{6}"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 disabled:bg-gray-100 uppercase"
                          />
                          <select
                            value={account.accountType}
                            onChange={(e) => handleBankDetailChange(index, 'accountType', e.target.value)}
                            disabled={!editMode}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 disabled:bg-gray-100"
                          >
                            <option value="savings">Savings Account</option>
                            <option value="current">Current Account</option>
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Danger Zone */}
              <div className="bg-red-50 border border-red-200 rounded-lg p-6">
                <h3 className="text-lg font-bold text-red-800 mb-4 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  Danger Zone
                </h3>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-800">Sign Out</p>
                      <p className="text-sm text-gray-600">Sign out from this device</p>
                    </div>
                    <button
                      onClick={handleSignOut}
                      className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign Out
                    </button>
                  </div>

                  <div className="border-t border-red-200 pt-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-red-800">Delete Account</p>
                        <p className="text-sm text-red-600">Permanently delete your account and all data</p>
                      </div>
                      <button
                        onClick={handleDeleteAccount}
                        className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
                          showDeleteConfirm
                            ? 'bg-red-600 hover:bg-red-700 text-white'
                            : 'bg-red-100 hover:bg-red-200 text-red-700'
                        }`}
                      >
                        <Trash2 className="w-4 h-4" />
                        {showDeleteConfirm ? 'Confirm Delete' : 'Delete Account'}
                      </button>
                    </div>
                    {showDeleteConfirm && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="mt-3 p-3 bg-red-100 rounded-lg"
                      >
                        <p className="text-sm text-red-800 font-medium">
                          ⚠️ Are you absolutely sure? This action cannot be undone.
                        </p>
                        <div className="flex gap-2 mt-3">
                          <button
                            onClick={handleDeleteAccount}
                            className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded text-sm font-medium"
                          >
                            Yes, Delete Everything
                          </button>
                          <button
                            onClick={() => setShowDeleteConfirm(false)}
                            className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 py-2 rounded text-sm font-medium"
                          >
                            Cancel
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
