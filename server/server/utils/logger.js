const winston = require('winston'); // npm install winston
const path = require('path');
const fs = require('fs');

function ensureLogDirectoryExists(logDir) {
    if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir);
    }
}

function createLogger(logDir) {
    ensureLogDirectoryExists(logDir);

    return winston.createLogger({
        format: winston.format.simple(),
        transports: [
            new winston.transports.Console({
                format: winston.format.combine(
                    winston.format.colorize(),
                    winston.format.simple()
                )
            }),
            new winston.transports.File({
                filename: path.join(logDir, 'server.log')
            })
        ]
    });
}

const logDir = 'log';
const logger = createLogger(logDir);
module.exports = logger;