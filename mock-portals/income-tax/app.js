/**
 * Mock Income Tax Portal Server
 * 
 * This Express server simulates the Indian Income Tax Department's e-filing portal.
 * It provides realistic pages and workflows for testing automation scripts without
 * touching the actual government website.
 * 
 * The server maintains session state to track logged-in users as they navigate
 * through the multi-step ITR filing process, just like the real portal does.
 */

const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 4001;
const PDFDocument = require('pdfkit');
// Configure Express middleware
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Session configuration for maintaining user login state
app.use(session({
  secret: 'income-tax-portal-secret-key-2024',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: false,  // Set to true in production with HTTPS
    maxAge: 24 * 60 * 60 * 1000  // 24 hours
  }
}));

// Load test users from data file
let testUsers;
try {
  const usersPath = path.join(__dirname, 'data', 'testUsers.json');
  testUsers = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
} catch (error) {
  // If file doesn't exist, use hardcoded test data
  testUsers = {
    'ABCDE1234F': {
      pan: 'ABCDE1234F',
      password: 'TestPassword123',
      name: 'Test User',
      email: 'test@example.com',
      mobile: '9876543210',
      dateOfBirth: '1990-01-01'
    },
    'XYZAB5678C': {
      pan: 'XYZAB5678C',
      password: 'Demo@1234',
      name: 'Demo User',
      email: 'demo@example.com',
      mobile: '9876543211',
      dateOfBirth: '1985-05-15'
    }
  };
}

// Middleware to check if user is authenticated
function requireAuth(req, res, next) {
  if (req.session && req.session.user) {
    next();
  } else {
    res.redirect('/login');
  }
}

// Homepage route
app.get('/', (req, res) => {
  res.render('index', {
    title: 'Income Tax Department - e-Filing Portal',
    user: req.session.user || null
  });
});

// Login page
app.get('/login', (req, res) => {
  if (req.session.user) {
    return res.redirect('/dashboard');
  }
  res.render('login', {
    title: 'Login - Income Tax e-Filing',
    error: null
  });
});

// Handle login submission
app.post('/login', (req, res) => {
  const { pan, password, captcha } = req.body;
  
  // Simple validation
  if (!pan || !password || !captcha) {
    return res.render('login', {
      title: 'Login - Income Tax e-Filing',
      error: 'All fields are required'
    });
  }
  
  // Mock CAPTCHA validation - in testing, we accept 'MOCK' as valid
  if (captcha !== 'MOCK' && captcha !== '12345') {
    return res.render('login', {
      title: 'Login - Income Tax e-Filing',
      error: 'Invalid CAPTCHA. Please try again.'
    });
  }
  
  // Validate user credentials
  const user = testUsers[pan.toUpperCase()];
  if (!user || user.password !== password) {
    return res.render('login', {
      title: 'Login - Income Tax e-Filing',
      error: 'Invalid PAN or Password. Please check your credentials.'
    });
  }
  
  // Set session
  req.session.user = {
    pan: user.pan,
    name: user.name,
    email: user.email,
    mobile: user.mobile,
    loginTime: new Date()
  };
  
  res.redirect('/dashboard');
});

// Dashboard - shown after successful login
app.get('/dashboard', requireAuth, (req, res) => {
  res.render('dashboard', {
    title: 'Dashboard - Income Tax e-Filing',
    user: req.session.user
  });
});

// e-File menu page
app.get('/e-file', requireAuth, (req, res) => {
  res.render('e-file', {
    title: 'e-File - Income Tax Returns',
    user: req.session.user
  });
});

// ITR Selection page - direct access route for automation
app.get('/itr-selection', requireAuth, (req, res) => {
  res.render('itr-selection', {
    title: 'File Income Tax Return',
    user: req.session.user
  });
});

// ITR form selection and initialization
app.get('/file-itr', requireAuth, (req, res) => {
  res.render('itr-selection', {
    title: 'File Income Tax Return',
    user: req.session.user
  });
});

// ITR form page - the actual form filling page
app.post('/itr-form', requireAuth, (req, res) => {
  const { assessmentYear, itrType } = req.body;
  
  if (!assessmentYear || !itrType) {
    return res.redirect('/file-itr');
  }
  
  // Store form data in session
  req.session.itrData = {
    assessmentYear,
    itrType,
    startTime: new Date()
  };
  
  res.render('itr-form', {
    title: `ITR Form ${itrType} - AY ${assessmentYear}`,
    user: req.session.user,
    assessmentYear,
    itrType
  });
});
// Handle ITR form submission
app.post('/itr-submit', requireAuth, (req, res) => {
  const formData = req.body;
  
  // Generate acknowledgement number
  const timestamp = Date.now();
  const ackNumber = `ITR${timestamp}${Math.floor(Math.random() * 1000)}`;
  
  // Store submission data in session WITH filed data
  req.session.acknowledgement = {
    number: ackNumber,
    data: formData,
    timestamp: new Date(),
    assessmentYear: req.session.itrData?.assessmentYear || '2024-25',
    itrType: req.session.itrData?.itrType || 'ITR1',
    // ✅ ADD THIS SECTION - Extract user's filed data
    filedData: {
      salaryIncome: formData.salaryIncome,
      deductions: formData.deductions || formData.deduction80C,
      bankName: formData.bankName,
      accountNumber: formData.accountNumber,
      ifscCode: formData.ifscCode
    }
  };
  
  res.render('itr-success', {
    title: 'ITR Filed Successfully',
    user: req.session.user,
    acknowledgement: req.session.acknowledgement
  });
});

app.get('/mock-download-itr-v', (req, res) => {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename=ITR-V_Mock.pdf');
  res.send(Buffer.from('Mock ITR-V PDF Content'));
});

// Dynamic PDF generation route
app.get('/download-itr-v', (req, res) => {
  if (!req.session.acknowledgement) {
    return res.status(404).send('No ITR filing found in session');
  }

  const ack = req.session.acknowledgement;
  const user = req.session.user;
  
  // Create PDF
  const doc = new PDFDocument({ margin: 50 });
  
  // Set response headers
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=ITR-V_${ack.number}.pdf`);
  
  // Pipe PDF to response
  doc.pipe(res);
  
  // Add content
  doc.fontSize(20).text('INCOME TAX DEPARTMENT', { align: 'center' });
  doc.fontSize(16).text('ITR-V Acknowledgement', { align: 'center' });
  doc.moveDown();
  
  // Add border
  doc.rect(50, doc.y, 500, 350).stroke();
  doc.moveDown(0.5);
  
  // Acknowledgement details
  doc.fontSize(14).text(`Acknowledgement Number: ${ack.number}`, { bold: true });
  doc.moveDown(0.5);
  doc.fontSize(12).text(`PAN: ${user.pan}`);
  doc.text(`Name: ${user.name}`);
  doc.text(`Assessment Year: ${ack.assessmentYear}`);
  doc.text(`ITR Form: ${ack.itrType}`);
  doc.text(`Filing Date: ${ack.timestamp.toLocaleDateString('en-IN')}`);
  doc.moveDown();
  
  // Filed data
  doc.fontSize(14).text('Filed Information:', { underline: true });
  doc.moveDown(0.3);
  doc.fontSize(11);
  
  if (ack.filedData) {
    doc.text(`Salary Income: ₹${ack.filedData.salaryIncome?.toLocaleString('en-IN') || 'N/A'}`);
    doc.text(`Deductions: ₹${ack.filedData.deductions?.toLocaleString('en-IN') || 'N/A'}`);
    doc.text(`Bank Name: ${ack.filedData.bankName || 'N/A'}`);
    doc.text(`Account Number: ${ack.filedData.accountNumber || 'N/A'}`);
    doc.text(`IFSC Code: ${ack.filedData.ifscCode || 'N/A'}`);
  }
  
  doc.moveDown();
  doc.fontSize(10).text('This is a system generated acknowledgement.', { align: 'center', italics: true });
  doc.text('Please verify your return within 120 days.', { align: 'center', italics: true });
  
  // Footer
  doc.fontSize(8).text(`Generated on: ${new Date().toLocaleString('en-IN')}`, 50, 700, { align: 'center' });
  
  // Finalize PDF
  doc.end();
});
// Logout
app.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Error destroying session:', err);
    }
    res.redirect('/');
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).render('error', {
    title: 'Page Not Found',
    user: req.session.user || null,
    errorCode: 404,
    errorMessage: 'The page you are looking for does not exist.'
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).render('error', {
    title: 'Server Error',
    user: req.session.user || null,
    errorCode: 500,
    errorMessage: 'An internal server error occurred. Please try again later.'
  });
});

// Start server
app.listen(PORT, () => {
  console.log('═'.repeat(70));
  console.log('  INCOME TAX DEPARTMENT - MOCK E-FILING PORTAL');
  console.log('═'.repeat(70));
  console.log(`  Server running at: http://localhost:${PORT}`);
  console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`  Started at: ${new Date().toLocaleString('en-IN')}`);
  console.log('═'.repeat(70));
  console.log('\n  Test Credentials:');
  Object.values(testUsers).forEach(user => {
    console.log(`    PAN: ${user.pan} | Password: ${user.password}`);
  });
  console.log('\n  CAPTCHA: Use "MOCK" for testing');
  console.log('═'.repeat(70));
});
