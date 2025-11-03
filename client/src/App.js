/**
 * Main App Component with Authentication Flow
 */

import React, { useState, useEffect } from 'react';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Dashboard from './components/Dashboard';
import Auth from './components/Auth';
import { authAPI } from './services/api';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuthentication();
  }, []);

  const checkAuthentication = async () => {
    const token = localStorage.getItem('authToken');
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      await authAPI.getProfile();
      setIsAuthenticated(true);
    } catch (error) {
      localStorage.removeItem('authToken');
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

  const handleAuthenticated = () => {
    setIsAuthenticated(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 to-blue-900 flex items-center justify-center">
        <div className="text-white text-2xl">Loading...</div>
      </div>
    );
  }

  return (
    <>
      {isAuthenticated ? (
        <Dashboard />
      ) : (
        <Auth onAuthenticated={handleAuthenticated} />
      )}
      <ToastContainer
        position="top-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
      />
    </>
  );
}

export default App;
