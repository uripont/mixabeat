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

// Log any pool errors
pool.on('error', (err) => {
    logger.error('Unexpected database pool error:', err);
});

pool.getConnection((err, connection) => {
    if (err) {
        logger.error(`Error connecting to database at ${config.host}:${config.port}:`, err);
        return;
    }
    logger.info(`Connected to database ${config.database} at ${config.host}:${config.port}`);
    connection.release();
});

// Log pool status periodically
setInterval(() => {
    const status = pool.pool ? {
        all: pool.pool._allConnections.length,
        acquired: pool.pool._acquiringConnections.length,
        free: pool.pool._freeConnections.length
    } : {};
    logger.info('Database pool status:', status);
}, 300000); // 5 minutes

module.exports = pool;
