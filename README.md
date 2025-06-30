
```plaintext
mixabeat/
├── server/       # Backend: Node.js application
│   ├── database/
│   ├── middleware/
│   ├── routes/
│   ├── services/
│   ├── sounds/
│   ├── utils/
│   └── websocket/
└── src/          # Frontend: Web application (HTML, CSS, JavaScript)
    ├── auth/
    ├── landing/
    ├── room/
    ├── search/
    └── utils/
```

## Full functionality walkthrough



## Test it yourself

Part of the *fun* of this project was to stick to barebones technologies, and perform all steps of development as manual as possible. For the deployment story this was the same: we used a simple VM on a cloud provider, installed dependencies manually, and deployed the application by SSH-ing into the VM to transfer the files. This means there is no straightforward way to test the application without going through the same steps, and we haven't wasted time to automate the deployment process. This project was meant to be a learning experience that we want to share, not a production-ready application.
