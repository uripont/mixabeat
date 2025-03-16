-- Drop and recreate the database for a clean setup
DROP DATABASE IF EXISTS mixabeat_db;
CREATE DATABASE mixabeat_db;
USE mixabeat_db;

-- Setup MySQL root user for both local and remote access
-- Create root@'%' if it doesn't exist (for remote access)
CREATE USER IF NOT EXISTS 'root'@'%';
-- Set authentication method and password for both root users
ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY 'your_root_password';
ALTER USER 'root'@'%' IDENTIFIED WITH mysql_native_password BY 'your_root_password';
-- Grant full privileges to root
GRANT ALL PRIVILEGES ON *.* TO 'root'@'%' WITH GRANT OPTION;

-- Create serverUser with restricted privileges
-- This user will only have access through localhost for security
CREATE USER IF NOT EXISTS 'serverUser'@'localhost' IDENTIFIED WITH mysql_native_password BY 'server_password';

-- Grant specific privileges to serverUser
-- SELECT: Read records
-- INSERT: Create new records
-- UPDATE: Modify existing records
-- DELETE: Remove records (needed for user management, room cleanup)
GRANT SELECT, INSERT, UPDATE, DELETE ON mixabeat_db.* TO 'serverUser'@'localhost';

-- Apply all privilege changes
FLUSH PRIVILEGES;

-- Create users table
CREATE TABLE users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) COMMENT 'Stores user account information';

-- Create simple sessions table (manual management instead of librart)
CREATE TABLE sessions (
    token VARCHAR(64) PRIMARY KEY,
    user_id INT NOT NULL,
    room_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(user_id)
        ON DELETE CASCADE,
    FOREIGN KEY (room_id) REFERENCES rooms(room_id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
) COMMENT 'Stores active user sessions and their current room';

-- Create rooms table with JSON column
CREATE TABLE rooms (
    room_id INT AUTO_INCREMENT PRIMARY KEY,
    song_name VARCHAR(100) NOT NULL,
    created_by INT,
    contents JSON COMMENT 'Stores data regarding different tracks and their sounds',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(user_id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
) COMMENT 'Stores music room information';

-- Create messages table
CREATE TABLE messages (
    message_id INT AUTO_INCREMENT PRIMARY KEY,
    room_id INT,
    user_id INT,
    message_text TEXT NOT NULL,
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (room_id) REFERENCES rooms(room_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(user_id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
) COMMENT 'Stores chat messages for rooms';

-- Verify setup
SELECT 'Database setup completed successfully' as 'Status';
SELECT user, host FROM mysql.user;
