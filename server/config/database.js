const mysql = require('mysql2'); // npm install mysql2
const logger = require('../utils/logger');

const config = {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE
};

const pool = mysql.createPool(config);
pool.getConnection((err, connection) => {
    if (err) {
        logger.error('Error connecting to database:', err);
        return;
    }
    logger.info('Connected to database');
    connection.release();
});

module.exports = pool;
