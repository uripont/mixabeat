const pool = require('../database/db-connection');
const logger = require('../utils/logger');

async function getUsers() {
    return new Promise((resolve, reject) => {
        pool.query('SELECT user_id, username, email, created_at FROM users', (err, rows) => {
            if (err) {
                logger.error('Error executing query:', err);
                reject(new Error('Error fetching users'));
                return;
            }
            logger.info('Got users:', rows);
            resolve(rows);
        });
    });
}

module.exports = {
    getUsers
};
