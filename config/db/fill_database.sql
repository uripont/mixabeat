USE mixabeat_db;

-- Mock data for users, rooms, sessions, and messages
INSERT INTO users (username, email, password_hash) VALUES
('user1', 'user1@example.com', 'passwordhash1'),
('user2', 'user2@example.com', 'passwordhash2'),
('user3', 'user3@example.com', 'passwordhash3'),
('user4', 'user4@example.com', 'passwordhash4'),
('user5', 'user5@example.com', 'passwordhash5'),
('user6', 'user6@example.com', 'passwordhash6'),
('user7', 'user7@example.com', 'passwordhash7'),
('user8', 'user8@example.com', 'passwordhash8'),
('user9', 'user9@example.com', 'passwordhash9'),
('user10', 'user10@example.com', 'passwordhash10');

INSERT INTO rooms (song_name, created_by, contents) VALUES
('Song 1', 1, '{"tracks": [{"id": 1, "instrument": "drums", "pattern": [1,0,1,0,1,0,1,0]}]}'),
('Song 2', 2, '{"tracks": [{"id": 2, "instrument": "bass", "pattern": [0,1,0,1,0,1,0,1]}]}'),
('Song 3', 3, '{"tracks": [{"id": 3, "instrument": "synth", "pattern": [1,1,0,0,1,1,0,0]}]}'),
('Song 4', 1, '{"tracks": [{"id": 4, "instrument": "guitar", "pattern": [0,0,1,1,0,0,1,1]}]}'),
('Song 5', 2, '{"tracks": [{"id": 5, "instrument": "piano", "pattern": [1,0,0,1,0,1,1,0]}]}');

INSERT INTO sessions (token, user_id, room_id, expires_at) VALUES
('token1', 1, 1, '2025-02-25 00:00:00'),
('token2', 2, 2, '2025-02-25 00:00:00'),
('token3', 3, NULL, '2025-02-25 00:00:00'),
('token4', 4, 3, '2025-02-25 00:00:00'),
('token5', 5, NULL, '2025-02-25 00:00:00');

INSERT INTO messages (room_id, user_id, message_text) VALUES
(1, 1, 'Hello from user 1 in room 1'),
(1, 2, 'Hi user 1, this is user 2!'),
(2, 2, 'Another message from user 2 in room 2'),
(3, 4, 'User 4 says hello in room 3'),
(1, 3, 'User 3 joins the chat in room 1'),
(1, 1, 'More messages from user 1 in room 1'),
(2, 2, 'More messages from user 2 in room 2'),
(3, 4, 'More messages from user 4 in room 3'),
(1, 3, 'More messages from user 3 in room 1'),
(1, 1, 'Even more messages from user 1 in room 1'),
(2, 2, 'Even more messages from user 2 in room 2'),
(3, 4, 'Even more messages from user 4 in room 3'),
(1, 3, 'Even more messages from user 3 in room 1'),
(1, 5, 'User 5 joins room 1'),
(2, 6, 'User 6 joins room 2'),
(3, 7, 'User 7 joins room 3'),
(1, 8, 'User 8 joins room 1'),
(2, 9, 'User 9 joins room 2'),
(3, 10, 'User 10 joins room 3'),
(1, 5, 'Message from user 5'),
(2, 6, 'Message from user 6'),
(3, 7, 'Message from user 7');
