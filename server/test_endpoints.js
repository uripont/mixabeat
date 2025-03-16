(async () => {
    const fetchModule = await import('node-fetch');
    const fetch = fetchModule.default;

    const BASE_URL = "http://20.26.232.219:3000";

    async function testEndpoints() {
        // Generate unique username and email that meet validation requirements
        // Username must be 3-20 characters long and contain only letters, numbers, and underscores
        const uniqueSuffix = String(Date.now()).slice(-7); // Shorter suffix for username length
        const username = `testuser_${uniqueSuffix}`;
        const email = `testuser_${uniqueSuffix}@example.com`;
        
        console.log("Creating user with username:", username, "and email:", email);
        console.log("Creating user...");
        const createUserResponse = await fetch(BASE_URL + "/auth/signup", {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: username, // Use the predefined username
                password: "Password123!", // Stronger password
                email: email // Use the predefined email
            })
        });
        let createUserResponseData;
        try {
            createUserResponseData = await createUserResponse.json();
            console.log("Create User Response:", createUserResponseData);
        } catch (e) {
            console.error("Error parsing Create User Response JSON:", e);
            console.log("Raw Create User Response:", await createUserResponse.text());
            return;
        }
        const userId = createUserResponseData.userId;
        console.log("User ID:", userId);

        // 2. Login as the created user
        console.log("Logging in...");
        const loginResponse = await fetch(BASE_URL + "/auth/login", {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: username, // Use the same username as signup
                password: "Password123!" // Stronger password
            })
        });
        let loginResponseData;
        try {
            loginResponseData = await loginResponse.json();
            console.log("Login Response:", loginResponseData);
        } catch (e) {
            console.error("Error parsing Login Response JSON:", e);
            console.log("Raw Login Response:", await loginResponse.text());
            return;
        }
        const token = loginResponseData.token;
        console.log("Token:", token);

        // 3. Get list of rooms
        console.log("Getting list of rooms...");
        const roomsResponse = await fetch(BASE_URL + "/rooms", {
            method: 'GET',
            headers: {
                'Authorization': `${token}` // Remove 'Bearer ' prefix as it might not be expected
            }
        });
        
        let roomsResponseData;
        let roomsResponseText;
        try {
            roomsResponseText = await roomsResponse.text();
            try {
                roomsResponseData = JSON.parse(roomsResponseText);
                console.log("Rooms Response:", roomsResponseData);
            } catch (e) {
                console.error("Error parsing Rooms Response JSON:", e);
                console.log("Raw Rooms Response:", roomsResponseText);
                return;
            }
        } catch (e) {
            console.error("Error getting Rooms Response text:", e);
            return;
        }
        
        // Extract the first room ID from the rooms array
        const roomId = roomsResponseData.rooms?.[0]?.room_id; // Get the first room ID
        console.log("Room ID:", roomId);

        if (!roomId) {
            console.log("No rooms found. Exiting.");
            return;
        }

        // 4. Join a room by ID (using PUT method)
        console.log("Joining room " + roomId + "...");
        const joinRoomResponse = await fetch(BASE_URL + "/rooms/" + roomId + "/join", {
            method: 'PUT', // Changed from POST to PUT based on the routes file
            headers: {
                'Authorization': `${token}`
            }
        });
        let joinRoomResponseData;
        try {
            joinRoomResponseData = await joinRoomResponse.text();
            try {
                joinRoomResponseData = JSON.parse(joinRoomResponseData);
                console.log("Join Room Response:", joinRoomResponseData);
            } catch (e) {
                console.error("Error parsing Join Room Response JSON:", e);
                console.log("Raw Join Room Response:", joinRoomResponseData);
                return;
            }
        } catch (e) {
            console.error("Error getting Join Room Response text:", e);
            return;
        }

        // 5. Request room chat messages
        console.log("Requesting room chat messages...");
        const messagesResponse = await fetch(BASE_URL + "/rooms/" + roomId + "/messages", {
            method: 'GET',
            headers: {
                'Authorization': `${token}`
            }
        });
        let messagesResponseData;
        try {
            messagesResponseData = await messagesResponse.text();
            try {
                messagesResponseData = JSON.parse(messagesResponseData);
                console.log("Messages Response:", messagesResponseData);
            } catch (e) {
                console.error("Error parsing Messages Response JSON:", e);
                console.log("Raw Messages Response:", messagesResponseData);
                return;
            }
        } catch (e) {
            console.error("Error getting Messages Response text:", e);
            return;
        }

        // 6. Request room's song
        console.log("Requesting room's song...");
        const songResponse = await fetch(BASE_URL + `/rooms/${roomId}/song`, {
            method: 'GET',
            headers: {
                'Authorization': `${token}`
            }
        });
        let songResponseData;
        try {
            songResponseData = await songResponse.text();
            try {
                songResponseData = JSON.parse(songResponseData);
                console.log("Song Response:", songResponseData);
            } catch (e) {
                console.error("Error parsing Song Response JSON:", e);
                console.log("Raw Song Response:", songResponseData);
                return;
            }
        } catch (e) {
            console.error("Error getting Song Response text:", e);
            return;
        }

        // 7. Leave room (using PUT method)
        console.log("Leaving room " + roomId + "...");
        const leaveRoomResponse = await fetch(BASE_URL + "/rooms/" + roomId + "/leave", {
            method: 'PUT', // Changed from POST to PUT based on the routes file
            headers: {
                'Authorization': `${token}`
            }
        });
        let leaveRoomResponseData;
        try {
            leaveRoomResponseData = await leaveRoomResponse.text();
            try {
                leaveRoomResponseData = JSON.parse(leaveRoomResponseData);
                console.log("Leave Room Response:", leaveRoomResponseData);
            } catch (e) {
                console.error("Error parsing Leave Room Response JSON:", e);
                console.log("Raw Leave Room Response:", leaveRoomResponseData);
                return;
            }
        } catch (e) {
            console.error("Error getting Leave Room Response text:", e);
            return;
        }

        // 8. Logout
        console.log("Logging out...");
        const logoutResponse = await fetch(BASE_URL + "/auth/logout", {
            method: 'POST',
            headers: {
                'Authorization': `${token}` // Remove 'Bearer ' prefix
            }
        });
        let logoutResponseData;
        try {
            logoutResponseData = await logoutResponse.text();
            try {
                logoutResponseData = JSON.parse(logoutResponseData);
                console.log("Logout Response:", logoutResponseData);
            } catch (e) {
                console.error("Error parsing Logout Response JSON:", e);
                console.log("Raw Logout Response:", logoutResponseData);
                return;
            }
        } catch (e) {
            console.error("Error getting Logout Response text:", e);
            return;
        }

        console.log("Endpoint tests completed.");
    }

    testEndpoints();
})();
