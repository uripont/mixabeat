const express = require('express');
//const session = require('express-session');
const mysql = require('mysql');
const bcrypt = require('bcrypt');
const app = express();

app.use(express.json());

// Database configuration
require('dotenv').config();
const config = {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
};

// Create connection
const connection = mysql.createConnection(config);

// Connect to the database
connection.connect((err) => {
    if (err) {
        console.error('Error connecting to database:', err);
        return;
    }
    console.log('Connected to database');
});

// Login route
app.get('/login', (req, res) => {
    res.send('Has hit the endpoint on VM');

    /* // You should verify credentials with your database here
    if (req.body.username === 'admin' && req.body.password === '1234') {
        req.session.user = 'admin'; // Store the username in the session
        res.send('Authenticated');
    } else {
        res.send('Incorrect credentials');
    } */
});

app.get('/getUsers', (req, res) => {
    console.log('Getting users');
    connection.query('SELECT * FROM testtable', (err, rows) => {
        if (err) {
            console.error('Error executing test query', err);
            return;
        }
        console.log('Got users:', rows);
        res.send(rows);
    });
});

const saltRounds = 10;

app.post('/signUp', (req, res) => {
    const { username, email, password } = req.body;
    
    if (!username || !email || !password) {
        return res.status(400).send('All fields are required');
    }

    bcrypt.hash(password, saltRounds, (err, hashedPassword) => {
        if (err) {
            console.error('Error hashing password:', err);
            res.status(500).send('Error creating user');
            return;
        }

        connection.query(
            'INSERT INTO testtable (name, email, password) VALUES (?, ?, ?)',
            [username, email, hashedPassword],
            (err, rows) => {
                if (err) {
                    console.error('Error executing query:', err);
                    res.status(500).send('Error creating user');
                    return;
                }
                console.log('Added user:', rows);
                res.status(201).send({ message: 'User created successfully', userId: rows.insertId });
            }
        );
    });
});

/* // Protected route
app.get('/profile', (req, res) => {
    if (req.session.user) {
        res.send(`Welcome, ${req.session.user}`);
    } else {
        res.status(401).send('Not authenticated');
    }
}); */

app.listen(3000, () => {
    console.log('Server running on port 3000');
});