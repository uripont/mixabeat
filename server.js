const express = require('express');
const session = require('express-session');
const app = express();

app.use(express.json());

app.use(session({
    secret: 'mySecret',
    resave: false,
    saveUninitialized: true
}));

// Login route
app.post('/login', (req, res) => {
    

    // You should verify credentials with your database here
    if (req.body.username === 'admin' && req.body.password === '1234') {
        req.session.user = 'admin'; // Store the username in the session
        res.send('Authenticated');
    } else {
        res.send('Incorrect credentials');
    }
});

// Protected route
app.get('/profile', (req, res) => {
    if (req.session.user) {
        res.send(`Welcome, ${req.session.user}`);
    } else {
        res.status(401).send('Not authenticated');
    }
});

app.listen(3000, () => {
    console.log('Server running on port 3000');
});
