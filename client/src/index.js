/**
 * React Application Entry Point
 * 
 * This is the very first JavaScript file that runs when your app loads.
 * Its job is simple but crucial: take your React components and attach
 * them to the HTML page.
 * 
 * WHAT HAPPENS WHEN THIS FILE RUNS:
 * 1. Import React and ReactDOM libraries
 * 2. Import your main App component
 * 3. Find the div with id="root" in index.html
 * 4. Tell React to render your App component inside that div
 * 5. React takes over and manages everything from there
 * 
 * Think of this as the ignition key that starts your React engine.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Optional: Import global CSS if you have any
// import './index.css';

/**
 * Create a "root" - this is the mounting point for your React app.
 * We're using the newer createRoot API (React 18+) instead of the
 * older ReactDOM.render() method.
 * 
 * document.getElementById('root') finds the div in index.html
 */
const root = ReactDOM.createRoot(document.getElementById('root'));

/**
 * Render your app!
 * 
 * React.StrictMode is a development tool that:
 * - Warns about deprecated React features
 * - Detects unexpected side effects
 * - Helps you write better React code
 * 
 * It doesn't affect production builds and doesn't render anything visible.
 * It's like having a helpful code reviewer watching over your shoulder.
 */
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

/**
 * Optional: Performance monitoring
 * 
 * If you want to measure performance in your app, you can use the
 * reportWebVitals function. This is useful for understanding how
 * fast your app loads and responds to user interactions.
 * 
 * Uncomment this if you set up web vitals:
 */
// import reportWebVitals from './reportWebVitals';
// reportWebVitals(console.log);
