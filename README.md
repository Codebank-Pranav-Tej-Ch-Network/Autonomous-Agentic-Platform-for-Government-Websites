# 📖 Government-Automate: Complete Developer Documentation

**An Open-Source AI-Powered Unified Platform for Seamless Citizen-Government Interactions**

---

## 🎯 Table of Contents

1. [Project Motivation & Vision](#project-motivation--vision)
2. [Problem Statement](#problem-statement)
3. [Solution Architecture](#solution-architecture)
4. [Technology Stack](#technology-stack-detailed)
5. [System Architecture](#system-architecture)
6. [Directory Structure & Explanation](#directory-structure--explanation)
7. [Installation & Setup](#installation--setup)
8. [API Documentation](#api-documentation-complete)
9. [Database Schema](#database-schema)
10. [Core Functionality](#core-functionality)
11. [Automation Agents](#automation-agents)
12. [Contributing Guide](#contributing-guide)
13. [License & Open Source](#license--open-source)
14. [Authors & Contributors](#authors--contributors)
15. [Troubleshooting & FAQs](#troubleshooting--faqs)
16. [Roadmap & Future Enhancements](#roadmap--future-enhancements)

---

## 🚀 Project Motivation & Vision

### The Why

**The Problem:** Indian citizens face a fragmented, complex digital government landscape. Critical services like income tax filing, vehicle registration, document retrieval, and passport services are scattered across multiple unrelated portals, each with its own:
- Navigation patterns
- Authentication mechanisms
- Technical jargon
- Form layouts and validation rules

This fragmentation creates barriers to access, especially for non-technical users, leading to:
- **Wasted Time:** Citizens spend hours navigating multiple websites
- **High Error Rates:** Complex forms lead to mistakes and rejections
- **Accessibility Issues:** Not user-friendly for elderly or less tech-savvy citizens
- **Information Silos:** No unified dashboard to track all government interactions

### The Vision

**Government-Automate** democratizes access to government services by creating a **single, intelligent, conversational interface** that:

1. **Understands Intent:** Natural language processing to recognize what citizens need
2. **Automates Complexity:** Browser automation handles portal navigation
3. **Provides Real-Time Feedback:** Live progress tracking on all tasks
4. **Ensures Security:** Multi-factor authentication and encrypted communications
5. **Remains Transparent:** Citizens see exactly what automation is doing

### The Impact

In a few years, we envision Government-Automate like architectures becoming the **de facto standard** for citizen-government interactions in India, serving millions of citizens across all states and enabling:
- **50% reduction** in average time to complete government tasks
- **80% reduction** in form submission errors
- **Universal access** regardless of technical literacy
- **Completely transparent** government service automation

---

## 🔍 Problem Statement

### The Current State

Indian government digital services exist in a **fragmented ecosystem**:

```
Citizen ──┬──> Income Tax Portal (Complex UI)
          ├──> VAHAN Portal (Different flow)
          ├──> DigiLocker (Separate auth)
          ├──> Passport Seva (Unique interface)
          ├──> EPFO Portal (Another ecosystem)
          └──> Aadhar Portal (Yet another flow)

Result: Confused citizens, wasted time, high error rates
```

### Key Issues Identified

| Issue | Impact | Severity |
|-------|--------|----------|
| **Portal Fragmentation** | Citizens must navigate multiple websites | CRITICAL |
| **Complex Authentication** | Different login methods across portals | HIGH |
| **Form Complexity** | Multiple validation rules, unclear instructions | HIGH |
| **No Progress Tracking** | Users don't know status of submitted forms | MEDIUM |
| **Poor Mobile Experience** | Many portals not optimized for mobile | MEDIUM |
| **Technical Barriers** | Elderly/non-technical users struggle | CRITICAL |

### The Gov-Automate Solution

Consolidate all services into:
- **One Interface:** Chat-based UI for all interactions
- **One Authentication:** Secure, unified login
- **One Dashboard:** All government tasks in one place
- **One Standard:** Consistent user experience across all services

---

## 💡 Solution Architecture

### High-Level Overview

```
┌──────────────────────────────────────────────────────────────┐
│                    USER INTERACTION LAYER                     │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │        React Frontend (Dashboard & Chat UI)            │ │
│  │  • Task Management  • Profile Management               │ │
│  │  • Real-time Updates • Beautiful Animations            │ │
│  └─────────────────────────────────────────────────────────┘ │
└────────────────────┬─────────────────────────────────────────┘
                     │ WebSocket + HTTP
┌────────────────────▼─────────────────────────────────────────┐
│                    API GATEWAY LAYER                          │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │        Express.js Server (Routing & Middleware)        │ │
│  │  • JWT Authentication  • Input Validation              │ │
│  │  • Error Handling  • CORS Management                   │ │
│  └─────────────────────────────────────────────────────────┘ │
└────────┬─────────────┬──────────────┬────────────┬───────────┘
         │             │              │            │
    ┌────▼────┐  ┌────▼─────┐  ┌────▼────┐  ┌────▼──────┐
    │   AI    │  │   Task   │  │ WebSocket│  │ Database  │
    │ Router  │  │  Queue   │  │  Server  │  │  Manager  │
    │(Gemini) │  │(BullMQ)  │  │(Socket.io│  │(Mongoose) │
    └────┬────┘  └────┬─────┘  └────┬────┘  └────┬──────┘
         │             │              │            │
    ┌────▼─────────────▼──────────────▼────────────▼──┐
    │     AUTOMATION ENGINE & SERVICES LAYER          │
    │  ┌─────────────────────────────────────────────┐│
    │  │  Playwright Browser Automation               ││
    │  │  ├─ Portal Navigation                        ││
    │  │  ├─ Form Filling & Validation                ││
    │  │  ├─ CAPTCHA Recognition                      ││
    │  │  └─ Data Extraction                          ││
    │  └─────────────────────────────────────────────┘│
    │  ┌─────────────────────────────────────────────┐│
    │  │  Decentralized Agents                        ││
    │  │  ├─ ITR Filing Agent                         ││
    │  │  ├─ VAHAN Agent                              ││
    │  │  ├─ DigiLocker Agent                         ││
    │  │  └─ Passport Seva Agent                      ││
    │  └─────────────────────────────────────────────┘│
    └──────────────────────────────────────────────────┘
         │
    ┌────▼──────────────────────────────┐
    │  EXTERNAL GOVERNMENT PORTALS       │
    │  • Income Tax (Real/Mock)          │
    │  • VAHAN (Real/Mock)               │
    │  • DigiLocker (Mock)               │
    │  • Passport Seva (Mock)            │
    └────────────────────────────────────┘
```

### Data Flow Architecture

```
User Request (Chat Message)
        ↓
Parse User Input ────────────────────┐
        ↓                             │
AI Intent Classification             │
(Google Gemini Pro)                  ├──► Task Creation
        ↓                             │
Parameter Extraction                 │
        ↓ ◄─────────────────────────┘
Generate Structured Task
        ↓
Add to Job Queue
(BullMQ + Redis)
        ↓
Automation Agent Processing
        ├─ Playwright Browser Session
        ├─ Navigate Portal
        ├─ Fill Forms
        ├─ Solve CAPTCHA (User Input)
        ├─ Handle OTP (Email)
        └─ Extract Results
        ↓
Result Callback
        ↓
Update Database
        ↓
Send WebSocket Update
        ↓
User Receives Result
(Chat UI)
```

---

## 🛠️ Technology Stack (Detailed)

### Frontend Technologies

| Technology | Version | Purpose | Why Chosen |
|-----------|---------|---------|-----------|
| **React** | 18.2+ | UI Framework | Modern, component-based, excellent ecosystem |
| **Framer Motion** | 10.x | Animations | Smooth, production-grade animations |
| **Socket.io Client** | 4.5+ | Real-time Updates | WebSocket communication with server |
| **Axios** | 1.4+ | HTTP Requests | Simple, promise-based API calls |
| **Lucide React** | 0.x | Icons | Beautiful, minimal icon library |
| **React Context** | Built-in | State Management | Lightweight for app-wide state |

**Frontend Dependencies:**
```json
{
  "react": "^18.2.0",
  "react-dom": "^18.2.0",
  "framer-motion": "^10.16.0",
  "socket.io-client": "^4.5.0",
  "axios": "^1.4.0",
  "lucide-react": "^0.263.0"
}
```

### Backend Technologies

| Technology | Version | Purpose | Why Chosen |
|-----------|---------|---------|-----------|
| **Node.js** | 18.19+ | Runtime | Server-side JavaScript |
| **Express.js** | 4.18+ | Web Framework | Minimal, flexible, well-documented |
| **MongoDB** | 6.0+ | Database | NoSQL, flexible schema, scalable |
| **Mongoose** | 7.x | ODM | Schema validation, middleware support |
| **BullMQ** | 3.x | Job Queue | Redis-backed, reliable task processing |
| **Socket.io** | 4.5+ | Real-time Communication | WebSocket fallbacks, rooms support |
| **Playwright** | 1.x | Browser Automation | Chromium, Firefox, WebKit support |
| **Google Gemini** | API | AI/ML | Intent classification, parameter extraction |
| **JWT** | 9.x | Authentication | Stateless, scalable authentication |
| **Bcrypt** | 5.x | Password Hashing | Industry-standard security |
| **Nodemailer** | 6.x | Email Sending | OTP delivery via SMTP |
| **Winston** | 3.x | Logging | Structured logging, multiple transports |
| **Morgan** | 1.x | HTTP Logging | Request/response logging middleware |
| **Dotenv** | 16.x | Environment Variables | Configuration management |

**Backend Dependencies:**
```json
{
  "express": "^4.18.2",
  "mongoose": "^7.0.0",
  "bullmq": "^3.0.0",
  "socket.io": "^4.5.0",
  "playwright": "^1.40.0",
  "jsonwebtoken": "^9.0.0",
  "bcryptjs": "^2.4.3",
  "nodemailer": "^6.9.0",
  "winston": "^3.8.0",
  "morgan": "^1.10.0",
  "dotenv": "^16.0.0"
}
```

### Infrastructure & DevOps

| Technology | Purpose |
|-----------|---------|
| **MongoDB Atlas** | Cloud database (recommended for production) |
| **Redis** | In-memory store for BullMQ job queue |
| **Docker** | Containerization (future) |
| **GitHub Actions** | CI/CD pipeline (future) |
| **AWS/GCP** | Cloud hosting (future) |

---

## 📁 Directory Structure & Explanation

### Complete Directory Tree

```
govt-automation-agent/
│
├── 📦 PACKAGE FILES
│   ├── package.json                    # Root dependencies
│   ├── package-lock.json               # Locked versions
│   ├── .gitignore                      # Git exclusions
│   ├── .env.example                    # Environment template
│   └── LICENSE                         # MIT License
│
├── 📂 CLIENT (React Frontend)
│   │
│   ├── public/
│   │   ├── index.html                 # Entry HTML
│   │   ├── favicon.ico                # Favicon
│   │   └── manifest.json              # PWA manifest
│   │
│   ├── src/
│   │   ├── index.js                   # React entry point
│   │   ├── index.css                  # Global styles
│   │   ├── App.js                     # Root component
│   │   │
│   │   ├── 📁 components/             # Reusable UI components
│   │   │   ├── Auth.js                # Login & OTP verification (800 lines)
│   │   │   │   └── Features:
│   │   │   │       • Email/Password login
│   │   │   │       • OTP verification
│   │   │   │       • Session management
│   │   │   │
│   │   │   ├── Dashboard.js           # Main dashboard (1200 lines)
│   │   │   │   └── Features:
│   │   │   │       • Task display
│   │   │   │       • Real-time updates
│   │   │   │       • Chat interface
│   │   │   │       • Results panel
│   │   │   │
│   │   │   ├── Taskselector.js        # Service selection (900 lines)
│   │   │   │   └── Features:
│   │   │   │       • Service cards
│   │   │   │       • Parameter input
│   │   │   │       • Task submission
│   │   │   │
│   │   │   ├── ProfileManagement.js   # User profile (800 lines)
│   │   │   │   └── Features:
│   │   │   │       • Profile editing
│   │   │   │       • Settings
│   │   │   │       • History tracking
│   │   │   │
│   │   │   ├── AgentStatus.js         # Agent monitoring (500 lines)
│   │   │   │   └── Features:
│   │   │   │       • Active agents
│   │   │   │       • Status display
│   │   │   │       • Performance metrics
│   │   │   │
│   │   │   ├── ResultsPanel.js        # Results display (400 lines)
│   │   │   │   └── Features:
│   │   │   │       • Result formatting
│   │   │   │       • Data visualization
│   │   │   │       • Download options
│   │   │   │
│   │   │   ├── TaskDetailsModal.js    # Task details popup (300 lines)
│   │   │   │   └── Features:
│   │   │   │       • Full task details
│   │   │   │       • Status timeline
│   │   │   │       • Error messages
│   │   │   │
│   │   │   └── UserInputModal.js      # Input capture (400 lines)
│   │   │       └── Features:
│   │   │           • Form inputs
│   │   │           • Validation
│   │   │           • Submission
│   │   │
│   │   ├── 📁 services/               # API & WebSocket clients
│   │   │   ├── api.js                 # Axios API client (200 lines)
│   │   │   │   └── Methods:
│   │   │   │       • POST /api/v1/tasks/create
│   │   │   │       • GET /api/v1/tasks
│   │   │   │       • GET /api/v1/tasks/:id/status
│   │   │   │       • POST /api/v1/auth/login
│   │   │   │       • POST /api/v1/auth/verify-otp
│   │   │   │
│   │   │   └── websocket.js           # Socket.io client (150 lines)
│   │   │       └── Events:
│   │   │           • task:status
│   │   │           • captcha:required
│   │   │           • otp:required
│   │   │           • task:completed
│   │   │
│   │   ├── 📁 utils/                  # Utility functions
│   │   │   ├── formatters.js          # Data formatting
│   │   │   ├── validators.js          # Input validation
│   │   │   └── helpers.js             # Helper functions
│   │   │
│   │   └── 📁 context/                # React Context
│   │       ├── AuthContext.js         # Authentication state
│   │       ├── TaskContext.js         # Task state
│   │       └── UIContext.js           # UI state
│   │
│   ├── package.json                   # React dependencies
│   ├── package-lock.json              # Locked versions
│   └── .env                           # Frontend env vars
│
├── 📂 SERVER (Node.js Backend)
│   │
│   ├── 📁 automation/                 # Automation scripts
│   │   │
│   │   ├── itrFiling.js               # ITR Filing Automation (1980 lines)
│   │   │   ├── Features:
│   │   │   │   • ITR-1 form filling
│   │   │   │   • E-verification
│   │   │   │   • ITR-V PDF download
│   │   │   │   • Email receipt
│   │   │   │
│   │   │   └── Key Functions:
│   │   │       • navigateToPortal()
│   │   │       • fillITRForm()
│   │   │       • solveOTP()
│   │   │       • extractReceipt()
│   │   │       • downloadPDF()
│   │   │
│   │   ├── searchVehicle.js           # VAHAN Vehicle Search (250 lines)
│   │   │   ├── Features:
│   │   │   │   • Vehicle search
│   │   │   │   • CAPTCHA solving
│   │   │   │   • Data extraction
│   │   │   │
│   │   │   └── Key Functions:
│   │   │       • searchByRegNo()
│   │   │       • solveCaptcha()
│   │   │       • extractVehicleData()
│   │   │
│   │   ├── registerVehicle.js         # VAHAN Registration (280 lines)
│   │   ├── updateContacts.js          # Contact Updates (300 lines)
│   │   ├── transferOwnership.js       # Ownership Transfer (350 lines)
│   │   │
│   │   └── 📁 scripts/                # Testing utilities
│   │       ├── test-itr.js            # Test ITR automation
│   │       ├── test-vahan.js          # Test VAHAN automation
│   │       ├── test-digilocker.js     # Test DigiLocker
│   │       ├── test-passport.js       # Test Passport
│   │       └── test-all.js            # Run all tests
│   │
│   ├── 📁 config/                     # Configuration
│   │   ├── database.js                # MongoDB connection (100 lines)
│   │   ├── db.js                      # DB initialization
│   │   └── constants.js               # Constants & enums
│   │
│   ├── 📁 controllers/                # Express route handlers
│   │   │
│   │   ├── taskController.js          # Task management (600 lines)
│   │   │   └── Functions:
│   │   │       • createTask()         - Create new task
│   │   │       • getTaskStatus()      - Get task status
│   │   │       • listUserTasks()      - List all tasks
│   │   │       • updateTaskStatus()   - Update task
│   │   │       • completeTask()       - Mark complete
│   │   │       • deleteTask()         - Delete task
│   │   │
│   │   ├── authController.js          # Authentication (400 lines)
│   │   │   └── Functions:
│   │   │       • register()           - User registration
│   │   │       • login()              - User login
│   │   │       • verifyOTP()          - OTP verification
│   │   │       • logout()             - User logout
│   │   │       • refreshToken()       - Token refresh
│   │   │       • resetPassword()      - Password reset
│   │   │
│   │   ├── captchaController.js       # CAPTCHA handling (200 lines)
│   │   │   └── Functions:
│   │   │       • uploadCaptcha()      - Save CAPTCHA image
│   │   │       • getCaptcha()         - Retrieve CAPTCHA
│   │   │       • verifyCaptcha()      - Verify solution
│   │   │
│   │   └── vehicleController.js       # Vehicle operations (150 lines)
│   │       └── Functions:
│   │           • searchVehicle()
│   │           • getVehicleDetails()
│   │           • registerVehicle()
│   │
│   ├── 📁 middleware/                 # Express middleware
│   │   │
│   │   ├── auth.js                    # JWT verification (80 lines)
│   │   ├── authMiddleware.js          # Auth guards (100 lines)
│   │   ├── errorHandler.js            # Error handling (150 lines)
│   │   ├── validation.js              # Input validation (200 lines)
│   │   ├── rateLimiter.js             # Rate limiting
│   │   └── cors.js                    # CORS configuration
│   │
│   ├── 📁 models/                     # Mongoose schemas
│   │   │
│   │   ├── User.js                    # User schema (150 lines)
│   │   │   ├── Fields:
│   │   │   │   • email (unique)
│   │   │   │   • password (hashed)
│   │   │   │   • name
│   │   │   │   • phone
│   │   │   │   • otp
│   │   │   │   • otpExpires
│   │   │   │   • lastLogin
│   │   │   │   • createdAt
│   │   │   │
│   │   │   └── Methods:
│   │   │       • comparePassword()
│   │   │       • generateOTP()
│   │   │
│   │   ├── Task.js                    # Task schema (200 lines)
│   │   │   ├── Fields:
│   │   │   │   • userId
│   │   │   │   • taskType (enum)
│   │   │   │   • status (enum)
│   │   │   │   • parameters
│   │   │   │   • result
│   │   │   │   • errors
│   │   │   │   • progress
│   │   │   │   • createdAt
│   │   │   │   • completedAt
│   │   │   │
│   │   │   └── Indexes:
│   │   │       • userId + createdAt
│   │   │       • status
│   │   │
│   │   ├── Vehicle.js                 # Vehicle schema (180 lines)
│   │   │   ├── Fields:
│   │   │   │   • owner (FK to User)
│   │   │   │   • regNo (unique)
│   │   │   │   • regDate
│   │   │   │   • rto
│   │   │   │   • vehicle details...
│   │   │   │   • insurance info
│   │   │   │   • fitness status
│   │   │   │   • PUC status
│   │   │   │   • tax status
│   │   │   │
│   │   │   └── Indexes:
│   │   │       • regNo
│   │   │       • owner
│   │   │
│   │   └── Document.js                # Document schema (150 lines)
│   │       └── Fields:
│   │           • userId
│   │           • documentType
│   │           • filePath
│   │           • uploadDate
│   │
│   ├── 📁 routes/                     # Express routes
│   │   │
│   │   ├── api.js                     # Main API routes (700 lines)
│   │   │   ├── POST /api/v1/tasks/create
│   │   │   ├── GET /api/v1/tasks
│   │   │   ├── GET /api/v1/tasks/:id
│   │   │   ├── GET /api/v1/tasks/:id/status
│   │   │   ├── DELETE /api/v1/tasks/:id
│   │   │   ├── POST /api/v1/tasks/:id/captcha
│   │   │   └── POST /api/v1/tasks/:id/otp
│   │   │
│   │   ├── auth.js                    # Auth routes (200 lines)
│   │   │   ├── POST /api/v1/auth/register
│   │   │   ├── POST /api/v1/auth/login
│   │   │   ├── POST /api/v1/auth/verify-otp
│   │   │   ├── POST /api/v1/auth/logout
│   │   │   └── POST /api/v1/auth/refresh-token
│   │   │
│   │   ├── tasks.js                   # Task routes (200 lines)
│   │   ├── vehicle.js                 # Vehicle routes (150 lines)
│   │   ├── automationRoutes.js        # Automation routes (100 lines)
│   │   ├── results.js                 # Results routes (80 lines)
│   │   └── downloads.js               # Download routes (120 lines)
│   │
│   ├── 📁 services/                   # Core services
│   │   │
│   │   ├── llmRouter.js               # AI Intent Classification (400 lines)
│   │   │   ├── Purpose:
│   │   │   │   • Parse user messages
│   │   │   │   • Classify task type
│   │   │   │   • Extract parameters
│   │   │   │   • Route to correct agent
│   │   │   │
│   │   │   └── Key Functions:
│   │   │       • classifyIntent()
│   │   │       • extractParameters()
│   │   │       • routeTask()
│   │   │
│   │   ├── queueManager.js            # BullMQ Job Queue (300 lines)
│   │   │   ├── Purpose:
│   │   │   │   • Manage job queue
│   │   │   │   • Process tasks async
│   │   │   │   • Retry logic
│   │   │   │   • Persistence
│   │   │   │
│   │   │   └── Key Functions:
│   │   │       • enqueueTask()
│   │   │       • processTask()
│   │   │       • retryFailedTask()
│   │   │       • getQueueStatus()
│   │   │
│   │   ├── websocket.js               # WebSocket Handler (250 lines)
│   │   │   ├── Purpose:
│   │   │   │   • Real-time updates
│   │   │   │   • Event broadcasting
│   │   │   │   • Room management
│   │   │   │
│   │   │   └── Events:
│   │   │       • task:status
│   │   │       • captcha:required
│   │   │       • otp:required
│   │   │       • result:ready
│   │   │
│   │   ├── sendEmail.js               # Email Service (150 lines)
│   │   │   └── Functions:
│   │   │       • sendOTP()
│   │   │       • sendReceipt()
│   │   │       • sendNotification()
│   │   │
│   │   ├── errorTranslator.js         # Error Handler (200 lines)
│   │   │   └── Functions:
│   │   │       • translateError()
│   │   │       • formatErrorMessage()
│   │   │       • getErrorDetails()
│   │   │
│   │   ├── logger.js                  # Logging Service (150 lines)
│   │   │   └── Methods:
│   │   │       • info()
│   │   │       • error()
│   │   │       • warn()
│   │   │       • debug()
│   │   │
│   │   └── cache.js                   # Caching Service (100 lines)
│   │       └── Methods:
│   │           • set()
│   │           • get()
│   │           • delete()
│   │           • clear()
│   │
│   ├── 📁 utils/                      # Utility functions
│   │   ├── logger.js                  # Structured logging
│   │   ├── helpers.js                 # Helper functions
│   │   ├── constants.js               # Constants
│   │   └── validators.js              # Validation helpers
│   │
│   ├── 📁 logs/                       # Application logs
│   │   ├── combined.log               # All logs
│   │   └── error.log                  # Errors only
│   │
│   ├── 📁 temp/                       # Temporary files
│   │   ├── captcha_*.png              # Captured CAPTCHA images
│   │   └── *.log                      # Temporary logs
│   │
│   ├── 📁 uploads/                    # User uploads
│   │   ├── files-*/                   # User files
│   │   ├── downloads/                 # Downloaded documents
│   │   └── screenshots/               # Captured screenshots
│   │
│   ├── server.js                      # Main server file (700 lines)
│   ├── package.json                   # Dependencies
│   ├── package-lock.json              # Locked versions
│   └── .env                           # Environment variables
│
├── 📂 MOCK-PORTALS                    # Mock government portals
│   │
│   ├── 📁 vahan-portal/               # VAHAN Vehicle Portal
│   │   ├── index.html                 # Portal HTML (800 lines)
│   │   ├── scripts.js                 # Portal logic (2000 lines)
│   │   ├── styles.css                 # Portal styles (500 lines)
│   │   └── README.md                  # VAHAN portal docs
│   │
│   ├── 📁 income-tax/                 # Income Tax Portal
│   │   ├── app.js                     # Express server
│   │   ├── package.json               # Dependencies
│   │   │
│   │   ├── 📁 data/
│   │   │   └── testUsers.json         # Mock user data
│   │   │
│   │   ├── 📁 public/
│   │   │   ├── 📁 css/
│   │   │   │   └── styles.css
│   │   │   └── 📁 js/
│   │   │       └── portal.js
│   │   │
│   │   └── 📁 views/                  # EJS templates
│   │       ├── index.ejs              # Home page
│   │       ├── login.ejs              # Login form
│   │       ├── dashboard.ejs          # Dashboard
│   │       ├── itr-form.ejs           # ITR form
│   │       ├── e-file.ejs             # E-filing page
│   │       └── itr-success.ejs        # Success page
│   │
│   ├── 📁 digilocker/                 # DigiLocker Portal (Mock)
│   │   ├── app.js                     # Server
│   │   └── scripts.js                 # Logic
│   │
│   └── 📁 passport-portal/            # Passport Portal (Mock)
│       ├── app.js                     # Server
│       └── scripts.js                 # Logic
│
├── 📂 DOCUMENTATION
│   ├── README.md                      # Main documentation
│   ├── CONTRIBUTING.md                # Contributing guide
│   ├── API.md                         # API documentation
│   ├── ARCHITECTURE.md                # Architecture docs
│   ├── SETUP.md                       # Setup guide
│   └── TROUBLESHOOTING.md             # Troubleshooting guide
│
└── 📄 CONFIG FILES
    ├── .env.example                   # Environment template
    ├── .gitignore                     # Git exclusions
    ├── .eslintrc.js                   # ESLint config
    ├── .prettierrc                    # Prettier config
    └── docker-compose.yml             # Docker setup (future)
```

### Directory Explanation by Component

#### **1. Client Directory (`/client`)**

**Purpose:** React frontend application for user interaction

**Key Components:**
- **Auth.js:** Handles user authentication, login, OTP verification
- **Dashboard.js:** Main dashboard showing all tasks and status
- **Taskselector.js:** Service selection interface with parameter input
- **ProfileManagement.js:** User profile and settings management

**Services:**
- **api.js:** Axios wrapper for all backend API calls
- **websocket.js:** Socket.io client for real-time updates

**Context:**
- **AuthContext:** Global authentication state
- **TaskContext:** Global task state
- **UIContext:** UI-related state (modals, alerts, etc.)

#### **2. Server Directory (`/server`)**

**Purpose:** Node.js backend for API, automation, and data management

**Automation Scripts:**
- **itrFiling.js (1980 lines):** Complete ITR automation logic
- **searchVehicle.js:** VAHAN vehicle search automation
- **registerVehicle.js:** Vehicle registration automation
- **updateContacts.js:** Contact update automation
- **transferOwnership.js:** Ownership transfer automation

**Controllers:**
- **taskController.js:** Task CRUD and management
- **authController.js:** User authentication
- **captchaController.js:** CAPTCHA handling
- **vehicleController.js:** Vehicle operations

**Services:**
- **llmRouter.js:** AI-powered intent classification
- **queueManager.js:** BullMQ job queue management
- **websocket.js:** Real-time communication
- **sendEmail.js:** Email/OTP delivery
- **errorTranslator.js:** Error message translation

#### **3. Mock Portals Directory (`/mock-portals`)**

**Purpose:** Mock implementations of government portals for testing

**Components:**
- **vahan-portal/:** Mock VAHAN vehicle portal with search functionality
- **income-tax/:** Mock income tax portal with ITR forms
- **digilocker/:** Mock DigiLocker document portal
- **passport-portal/:** Mock passport service portal

---

## 🔌 API Documentation (Complete)

### Base URL
```
Production: https://api.gov-automate.in
Development: http://localhost:5000
```

### Authentication

All requests (except `/auth/register` and `/auth/login`) require:
```
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

### Error Response Format

```json
{
  "success": false,
  "message": "Error description",
  "code": "ERROR_CODE",
  "details": {
    "field": "error details"
  }
}
```

### Success Response Format

```json
{
  "success": true,
  "data": { /* response data */ },
  "message": "Success message (optional)"
}
```

### Authentication Endpoints

#### **POST /api/v1/auth/register**

Register a new user

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "name": "John Doe",
  "phone": "9876543210"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "userId": "6546abc123def456",
    "email": "user@example.com",
    "name": "John Doe"
  },
  "message": "Registration successful. OTP sent to email."
}
```

**Validation:**
- Email must be valid format
- Password minimum 8 chars, 1 uppercase, 1 number, 1 special char
- Name minimum 2 characters
- Phone valid Indian number

---

#### **POST /api/v1/auth/login**

Authenticate user

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "userId": "6546abc123def456",
    "email": "user@example.com",
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": "7d"
  },
  "message": "Login successful. OTP sent to email."
}
```

**Errors:**
- `401`: Invalid email or password
- `429`: Too many login attempts

---

#### **POST /api/v1/auth/verify-otp**

Verify OTP and complete authentication

**Request:**
```json
{
  "email": "user@example.com",
  "otp": "123456"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "userId": "6546abc123def456",
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": "7d"
  }
}
```

**Errors:**
- `400`: Invalid or expired OTP
- `404`: Email not found

---

### Task Management Endpoints

#### **POST /api/v1/tasks/create**

Create a new automation task

**Request:**
```json
{
  "message": "File my ITR for FY 2023-24",
  "taskType": "itr_filing",
  "parameters": {
    "pan": "ABCDE1234F",
    "aadhaar": "123456789012",
    "financialYear": "2023-24",
    "incomeData": {
      "salary": 500000,
      "otherIncome": 50000
    }
  }
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "taskId": "task_6546abc123def456",
    "status": "queued",
    "taskType": "itr_filing",
    "createdAt": "2025-11-16T12:30:00Z",
    "estimatedTime": "5-10 minutes"
  }
}
```

**Supported Task Types:**
- `itr_filing` - Income Tax Return filing
- `vehicle_search` - Vehicle registration search
- `vehicle_register` - Vehicle registration
- `document_download` - DigiLocker download
- `passport_status` - Passport inquiry

---

#### **GET /api/v1/tasks**

List all user tasks

**Query Parameters:**
- `limit` (default: 20) - Number of results
- `skip` (default: 0) - Pagination offset
- `status` - Filter by status (queued, processing, completed, failed)
- `taskType` - Filter by task type
- `sortBy` - Sort field (createdAt, completedAt)
- `order` - Sort order (asc, desc)

**Request:**
```
GET /api/v1/tasks?limit=10&status=completed&sortBy=createdAt&order=desc
```

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "taskId": "task_6546abc123def456",
      "taskType": "itr_filing",
      "status": "completed",
      "progress": 100,
      "createdAt": "2025-11-16T12:00:00Z",
      "completedAt": "2025-11-16T12:15:00Z",
      "result": {
        "ackNumber": "ITR123456789",
        "filingStatus": "success",
        "pdfUrl": "/downloads/ITR_ABCDE1234F_timestamp.pdf"
      }
    }
  ],
  "pagination": {
    "total": 45,
    "limit": 10,
    "skip": 0,
    "pages": 5
  }
}
```

---

#### **GET /api/v1/tasks/:taskId/status**

Get real-time task status

**Request:**
```
GET /api/v1/tasks/task_6546abc123def456/status
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "taskId": "task_6546abc123def456",
    "status": "processing",
    "progress": 45,
    "currentStep": "Filling ITR form...",
    "logs": [
      {
        "timestamp": "2025-11-16T12:00:30Z",
        "message": "Portal loaded successfully",
        "level": "info"
      },
      {
        "timestamp": "2025-11-16T12:00:45Z",
        "message": "Authenticated to portal",
        "level": "info"
      }
    ],
    "eta": "2025-11-16T12:15:00Z"
  }
}
```

---

#### **DELETE /api/v1/tasks/:taskId**

Cancel a task

**Request:**
```
DELETE /api/v1/tasks/task_6546abc123def456
```

**Response (200):**
```json
{
  "success": true,
  "message": "Task cancelled successfully"
}
```

---

### Vehicle API Endpoints

#### **GET /api/vehicle/:regNo**

Search vehicle by registration number

**Request:**
```
GET /api/vehicle/DL01AB1234
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "regNo": "DL01AB1234",
    "ownerName": "Rajesh Kumar",
    "model": "SWIFT VXI",
    "year": "2019",
    "color": "White",
    "insStatus": "Valid",
    "pucStatus": "Valid",
    "fitnessStatus": "Valid",
    "regDate": "15/03/2019",
    "rto": "DL-01 (Delhi)",
    "class": "Motor Car",
    "fuel": "Petrol"
  }
}
```

**Response (404):**
```json
{
  "success": false,
  "message": "Vehicle not found"
}
```

---

### WebSocket Events

#### **Connection**
```javascript
const socket = io('http://localhost:5000');

socket.on('connect', () => {
  console.log('Connected to server');
});
```

#### **Listening to Task Updates**
```javascript
// Listen for task status updates
socket.on('task:status', (data) => {
  console.log('Task', data.taskId, 'is now', data.status);
  console.log('Progress:', data.progress, '%');
});

// Listen for CAPTCHA requirement
socket.on('captcha:required', (data) => {
  console.log('CAPTCHA image:', data.imageBase64);
  // Display CAPTCHA to user and get solution
});

// Listen for OTP requirement
socket.on('otp:required', (data) => {
  console.log('OTP sent to', data.email);
  // Prompt user for OTP
});

// Listen for task completion
socket.on('task:completed', (data) => {
  console.log('Task result:', data.result);
});
```

#### **Emitting User Input**
```javascript
// Submit CAPTCHA solution
socket.emit('captcha:solved', {
  taskId: 'task_id',
  solution: 'ABCD12'
});

// Submit OTP
socket.emit('otp:submit', {
  taskId: 'task_id',
  otp: '123456'
});
```

---

## 💾 Database Schema

### User Collection

```javascript
{
  _id: ObjectId,
  email: String (unique, required),
  password: String (hashed, required),
  name: String,
  phone: String,
  otp: String,
  otpExpires: Date,
  lastLogin: Date,
  preferences: {
    emailNotifications: Boolean,
    smsNotifications: Boolean,
    language: String,
    theme: String
  },
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes:**
- `email` (unique)
- `createdAt` (for sorting by registration date)

---

### Task Collection

```javascript
{
  _id: ObjectId,
  userId: ObjectId (FK to User),
  taskType: Enum['itr_filing', 'vehicle_search', ...],
  status: Enum['queued', 'processing', 'completed', 'failed'],
  parameters: {
    // Dynamic based on taskType
    pan: String,
    aadhaar: String,
    regNumber: String,
    ... other params
  },
  result: {
    // Dynamic based on taskType
    success: Boolean,
    data: Object,
    message: String
  },
  progress: Number (0-100),
  logs: [{
    timestamp: Date,
    message: String,
    level: Enum['info', 'warn', 'error']
  }],
  errors: [{
    timestamp: Date,
    code: String,
    message: String,
    details: Object
  }],
  createdAt: Date,
  startedAt: Date,
  completedAt: Date,
  updatedAt: Date
}
```

**Indexes:**
- `userId + createdAt` (for user's task history)
- `status` (for filtering by status)
- `taskType` (for analytics)

---

### Vehicle Collection

```javascript
{
  _id: ObjectId,
  owner: ObjectId (FK to User),
  regNo: String (unique, uppercase),
  regDate: String,
  rto: String,
  class: String,
  fuel: String,
  model: String,
  year: String,
  engine: String,
  chassis: String,
  color: String,
  seating: String,
  insCompany: String,
  policyNo: String,
  insFrom: Date,
  insUpto: Date,
  insStatus: String,
  fitnessUpto: Date,
  fitnessStatus: String,
  pucNo: String,
  pucUpto: Date,
  pucStatus: String,
  taxUpto: Date,
  ownerName: String,
  fatherName: String,
  mobile: String,
  email: String,
  address: String,
  permAddress: String,
  financer: String,
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes:**
- `regNo` (unique, for searches)
- `owner` (for user's vehicles)

---

## 🎯 Core Functionality

### 1. ITR Filing Workflow

```
User Request
    ↓
AI Classification (ITR Filing)
    ↓
Parameter Extraction (PAN, Aadhaar, Income)
    ↓
Queue Task
    ↓
Playwright Agent Processing
    ├─ Load Income Tax Portal
    ├─ Navigate to ITR Section
    ├─ Fill ITR-1 Form
    │   ├─ Personal Details
    │   ├─ Income Details
    │   └─ Verification Details
    ├─ Solve CAPTCHA
    ├─ Handle OTP Verification
    ├─ Submit Form
    └─ Extract Acknowledgment Number
    ↓
Download ITR-V PDF
    ↓
Store in Database
    ↓
Email Receipt to User
    ↓
Return Result to Frontend
```

### 2. Vehicle Search Workflow

```
User Request
    ↓
Parse Vehicle Details (RegNo, State)
    ↓
Queue Task
    ↓
Playwright Agent Processing
    ├─ Load VAHAN Portal
    ├─ Fill Search Form
    ├─ Solve CAPTCHA (interactive)
    ├─ Submit Search
    └─ Extract Vehicle Information
    ↓
Structure Response
    ↓
Return to Frontend
```

### 3. CAPTCHA Handling (Human-in-the-Loop)

```
Automation Encounters CAPTCHA
    ↓
Capture CAPTCHA Image
    ↓
Send to Frontend via WebSocket
    ↓
User Solves CAPTCHA
    ↓
Submit Solution via WebSocket
    ↓
Resume Automation with Solution
    ↓
Continue Portal Interaction
```

### 4. Real-Time Progress Tracking

```
Automation Step Execution
    ↓
Log Step Information
    ↓
Update Task Progress in DB
    ↓
Emit WebSocket Event
    ↓
Frontend Receives Update
    ↓
UI Updates with Progress
```

---

## 👥 Authors 
- **Ch Pranav Tej (CS24B057)** - *Scrum Master, AIML Dev, Full Stack Dev*- [Pranav Tej](https://github.com/Codebank-Pranav-Tej-Ch-Network) - Contributions include Management of All Tasks, Organizing meetings, Planning pipeline, Building of ITRFiling script, Creating Income Tax mock portal and the Decentralized Agentic Platform for Income Tax Website [Link](https://github.com/Codebank-Pranav-Tej-Ch-Network/Autonomous-Agentic-Platform-for-Government-Websites), and final integration of all scripts.
- **M Nikhil (CS24B026)** - *Full Stack Dev, AIML Dev* - [Nikhil](https://github.com/nikhil-muvvala) - Contributions include Planning Pipeline, Building of Vahan portal, Vahan portal automation scripts, and Centralized Agentic Platform for the 3 websites with full on integration. Also wrote the documentation
- **G Siddhardha (CS24B012)** - *Full Stack Dev, AIML Dev* - [Siddhardha](https://github.com/Siddhardha-11) - Contributions include Front end Design, Building of E-ID Portal, E-ID portal automation scripts, and Centralized Agentic Platform for the 3 websites with help in integration.
- **M Vinay Sai (CS24B027)** - *Full Stack Dev, AIML Dev* - [Vinay](https://github.com/VinaySai-GH) - Contributions include building of the Passport Seva portal, Passport Seva portal automation scripts, and help in Centralized Agentic Platform for the 3 websites.
- **S Hemanth (CS24B044)** - *Full Stack Dev, AIML Dev* - [Hemanth](https://github.com/Hemanth-SVS) - Contributions include building of the Passport Seva portal, Backend Design, and help in integration of the final Centralized Agentic Platform for the 3 websites with help in integration. 

### Contributors Welcome!

We encourage contributions from the open-source community. Please see [Contributing Guide](#contributing-guide) below.

### Acknowledgments

- **IIT Tirupati** - Academic institution providing guidance and support

---

## 📄 License & Open Source

### License

**MIT License** - Feel free to use, modify, and distribute

```
MIT License

Copyright (c) 2025 Gov-Automate Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

### Open Source Principles

Government-Automate is committed to:

1. **Transparency:** All code is publicly available and auditable
2. **Accessibility:** Free for individuals and non-profit use
3. **Community-Driven:** Features prioritized based on community feedback
4. **Standards Compliance:** Following industry best practices
5. **Security First:** Regular security audits and vulnerability disclosure

### Contributing Guide

We welcome contributions! Here's how to get started:

#### **1. Fork the Repository**
```bash
git clone https://github.com/yourusername/govt-automation-agent.git
cd govt-automation-agent
```

#### **2. Create a Feature Branch**
```bash
git checkout -b feature/your-feature-name
```

#### **3. Make Your Changes**
- Follow code style guidelines (use ESLint)
- Add comments for complex logic
- Write tests for new features

#### **4. Commit Your Changes**
```bash
git commit -m "feat: Add your feature description"
```

#### **5. Push to Your Fork**
```bash
git push origin feature/your-feature-name
```

#### **6. Open a Pull Request**
- Describe your changes
- Link any related issues
- Ensure CI/CD checks pass

#### **Code Style Guidelines**

- Use ESLint configuration provided
- 2-space indentation
- Use meaningful variable names
- Add JSDoc comments for functions
- Maintain existing code patterns

#### **Testing Requirements**

All PRs should include:
- Unit tests for new functions
- Integration tests where applicable
- Pass existing test suite

```bash
npm test  # Run all tests
npm run lint  # Check code style
```

---

## 🐛 Troubleshooting & FAQs

### Common Issues

#### **MongoDB Connection Refused**

**Error:** `MongooseServerSelectionError: connect ECONNREFUSED 127.0.0.1:27017`

**Solution:**
1. Ensure MongoDB is running: `mongod`
2. Check connection string in `.env`
3. Verify MongoDB service is started: `sudo systemctl start mongod`

---

#### **Port Already in Use**

**Error:** `listen EADDRINUSE :::5000`

**Solution:**
```bash
# Find process using port
lsof -i :5000

# Kill process
kill -9 <PID>

# Or change port in .env
PORT=5001
```

---

#### **Playwright Timeout**

**Error:** `TimeoutError: browser.launch() timed out after 30000ms`

**Solution:**
1. Ensure sufficient system resources
2. Increase timeout in `automation/*.js`: `{ timeout: 60000 }`
3. Check internet connection

---

## 🗺️ Roadmap & Future Enhancements

### Phase 1 (Q4 2025) - Current Focus
- ✅ Income Tax Portal (ITR Filing)
- ✅ VAHAN Portal (Vehicle Search & Registration)
- ✅ DigiLocker Integration
- ✅ Passport Seva Integration
- ✅ WebSocket Real-time Updates
- ✅ CAPTCHA Solving

### Phase 2 (Q1 2026) - Expansion
- [ ] EPFO Portal (Pension Services)
- [ ] Aadhar Management
- [ ] PAN Application
- [ ] GST Portal
- [ ] Mobile App (React Native)

### Phase 3 (Q2 2026) - Enhancement
- [ ] Voice Interface (Speech Recognition)
- [ ] Multi-Language Support (Hindi, Bengali, Tamil, Telugu)
- [ ] Offline Mode with Sync
- [ ] Advanced Analytics Dashboard
- [ ] Machine Learning Recommendations

### Phase 4 (Q3 2026) - Maturity
- [ ] Blockchain Integration (Document Verification)
- [ ] AI-Powered Chatbot (NLP)
- [ ] Regional Portal Support
- [ ] Enterprise API
- [ ] SLA Guarantees

---

## 📞 Support & Community

- **GitHub Issues:** [Report bugs](https://github.com/repo/issues)
- **Discussions:** [Ask questions](https://github.com/repo/discussions)
- **Email:** [Mail Me!](pranavtej.9.1a@gmail.com)

---

**Last Updated:** November 17, 2025  
**Version:** 1.0.0 - Open Source Release  
**License:** MIT  
**Repository:** [github.com/govt-automation](https://github.com/govt-automation)

---

*Gov-Automate: Democratizing Digital Government Services for All Indians*
