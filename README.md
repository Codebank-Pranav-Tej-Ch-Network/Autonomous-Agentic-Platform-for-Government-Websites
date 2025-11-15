# <u>Directory Structure: govt-automation-agent</u>
```markdown
govt-automation-agent/
.
├── client
│   ├── package-lock.json
│   ├── package.json
│   ├── public
│   │   ├── index.html
│   │   └── manifest.json
│   └── src
│       ├── App.js
│       ├── components
│       │   ├── AgentStatus.js
│       │   ├── Auth.js
│       │   ├── Dashboard.js
│       │   ├── ProfileManagement.js
│       │   ├── ResultsPanel.js
│       │   ├── Taskselector.js
│       │   ├── UserInputModal.js

│       ├── context
│       ├── index.js
│       ├── services
│       │   ├── api.js
│       │   └── websocket.js
│       └── utils
├── docs
├── main.tex
├── mock-portals
│   ├── digilocker
│   │   ├── data
│   │   ├── public
│   │   └── views
│   ├── epfo
│   │   ├── data
│   │   ├── public
│   │   └── views
│   └── income-tax
│       ├── app.js
│       ├── data
│       │   └── testUsers.json
│       ├── package-lock.json
│       ├── package.json
│       ├── public
│       │   ├── css
│       │   │   └── styles.css
│       │   └── js
│       └── views
│           ├── dashboard.ejs
│           ├── e-file.ejs
│           ├── error.ejs
│           ├── index.ejs
│           ├── itr-form.ejs
│           ├── itr-selection.ejs
│           ├── itr-success.ejs
│           ├── login.ejs
│           └── partials
│               ├── footer.ejs
│               └── header.ejs
├── package-lock.json
├── package.json
├── scripts
└── server
    ├── automation
    │   └── scripts
    │       ├── digilocker.js
    │       ├── epfo.js
    │       ├── itrFiling.js
    │       ├── test-all.js
    │       ├── test-digilocker.js
    │       ├── test-epfo.js
    │       └── test-itr.js
    ├── config
    │   └── database.js
    ├── controllers
    │   ├── authController.js
   
    │   └── taskController.js
    ├── logs
    │   ├── combined.log
    │   └── error.log
    ├── middleware
    │   ├── auth.js
    │   ├── errorHandler.js
    │   └── validation.js
    ├── models
    │   ├── Task.js
    │   ├── User.js
    ├── package-lock.json
    ├── package.json
    ├── routes
    │   ├── \
    │   ├── auth.js
    │   ├── downloads.js
    │   ├── results.js
    │   └── tasks.js
    ├── server.js
    ├── services
    │   ├── '
    │   ├── errorTranslator.js
    │   ├── llmRouter.js
    
    │   ├── queueManager.js
    │   └── websocket.js
    ├── temp
    ├── uploads
    │   ├── downloads
    │   │   ├── ITR_ABCDE1234F_1762145111217.txt
    │   │   └── ITR_ABCDE1234F_1762145185288.txt
    │   ├── files-1763150972963-868155125.png
    │   └── screenshots
    └── utils
        ├── logger.js
        └── server
            └── logs
