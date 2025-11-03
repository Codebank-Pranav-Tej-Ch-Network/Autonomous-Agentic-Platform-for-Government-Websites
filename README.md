# <u> Directory Structure # </u>

govt-automation-agent/
│
├── .env.example                    # Environment variables template
├── .gitignore                      # Git ignore file
├── package.json                    # Root package.json
├── README.md                       # Project documentation
│
├── client/                         # React Frontend
│   ├── package.json
│   ├── public/
│   │   └── index.html
│   ├── src/
│   │   ├── App.js                 # Main app component
│   │   ├── index.js               # Entry point
│   │   ├── components/
│   │   │   ├── Dashboard.js       # Main dashboard
│   │   │   ├── TaskSelector.js    # Task selection UI
│   │   │   ├── AgentStatus.js     # Real-time status display
│   │   │   ├── ResultsPanel.js    # Results display
│   │   │   ├── CaptchaSolver.js   # Manual captcha interface
│   │   │   └── Navbar.js          # Navigation bar
│   │   ├── services/
│   │   │   ├── api.js             # API service layer
│   │   │   └── websocket.js       # WebSocket client
│   │   ├── context/
│   │   │   └── AppContext.js      # Global state management
│   │   ├── utils/
│   │   │   └── helpers.js         # Utility functions
│   │   └── styles/
│   │       └── tailwind.config.js # Tailwind configuration
│   └── .env
│
├── server/                         # Node.js Backend
│   ├── package.json
│   ├── server.js                  # Main server file
│   ├── config/
│   │   ├── database.js            # MongoDB connection
│   │   ├── gemini.js              # Gemini API setup
│   │   └── constants.js           # App constants
│   ├── routes/
│   │   ├── auth.js                # Authentication routes
│   │   ├── tasks.js               # Task management routes
│   │   └── results.js             # Results retrieval routes
│   ├── controllers/
│   │   ├── authController.js      # Auth logic
│   │   ├── taskController.js      # Task handling logic
│   │   └── resultController.js    # Results logic
│   ├── models/
│   │   ├── User.js                # User schema
│   │   ├── Task.js                # Task schema
│   │   ├── Result.js              # Result schema
│   │   └── Session.js             # Session schema
│   ├── services/
│   │   ├── llmRouter.js           # LLM-based task routing
│   │   ├── queueManager.js        # Bull queue management
│   │   └── websocket.js           # WebSocket server
│   ├── middleware/
│   │   ├── auth.js                # JWT verification
│   │   ├── validation.js          # Input validation
│   │   └── errorHandler.js        # Error handling
│   ├── automation/                # Playwright scripts
│   │   ├── scripts/
│   │   │   ├── itrFiling.js       # Income Tax script
│   │   │   ├── digilocker.js      # DigiLocker script
│   │   │   └── epfo.js            # EPFO script
│   │   └── utils/
│   │       ├── browserManager.js  # Browser instance management
│   │       └── helpers.js         # Automation utilities
│   └── .env
│
├── mock-portals/                   # Mock Government Portals
│   ├── package.json
│   ├── income-tax/
│   │   ├── app.js                 # Express app for mock IT portal
│   │   ├── views/                 # EJS templates
│   │   │   ├── login.ejs
│   │   │   ├── dashboard.ejs
│   │   │   ├── itr-form.ejs
│   │   │   └── success.ejs
│   │   ├── public/                # Static assets
│   │   │   ├── css/
│   │   │   └── js/
│   │   └── data/                  # Mock data
│   │       └── testUsers.json
│   ├── digilocker/
│   │   ├── app.js
│   │   ├── views/
│   │   ├── public/
│   │   └── data/
│   └── epfo/
│       ├── app.js
│       ├── views/
│       ├── public/
│       └── data/
│
├── docs/                           # Documentation
│   ├── API.md                     # API documentation
│   ├── SETUP.md                   # Setup instructions
│   ├── DEPLOYMENT.md              # Deployment guide
│   └── ARCHITECTURE.md            # Architecture details
│
└── scripts/                        # Utility scripts
    ├── seed-database.js           # Database seeding
    ├── test-automation.js         # Test automation scripts
    └── generate-mock-data.js      # Mock data generator
