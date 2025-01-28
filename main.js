function appendMessage(sender, message, chatBox) {
  const msg = document.createElement('div');
  msg.textContent = `${sender}: ${message}`;
  chatBox.appendChild(msg);
  chatBox.scrollTop = chatBox.scrollHeight; 
}

function restoreChat(chatBox) {
  for (let i = 0; i < chatHistory.length; i++) {
    appendMessage(chatHistory[i].username, chatHistory[i].text, chatBox);
  }
}

function restoreUsers(userList) {
  // Reset UI list of online users
  while (userList.firstChild){
    userList.removeChild(userList.firstChild)
  }

  // Rebuild UI list of online users
  for (let i = 0; i < onlineUsers.length; i++) {
    appendUser(onlineUsers[i].username, userList);
  }
}

function appendUser(username, userList) {
  const users = document.createElement('div'); // `user` is being redeclared here, which overwrites the parameter.
  users.textContent = username;
  userList.appendChild(users);
  userList.scrollTop = userList.scrollHeight; // `chatBox` is undefined here.
}

var chatHistory = [];
var onlineUsers = [];

document.addEventListener("DOMContentLoaded", () => {
  const connectBtn = document.getElementById("connect-btn");
  const roomInput = document.getElementById("room");
  const usernameInput = document.getElementById("username");
  const chatBox = document.getElementById('chat-box');
  const userList = document.getElementById('user-list');
  const messageInput = document.getElementById("message");
  const sendMessageBtn = document.getElementById("send-message-btn");
  const emojiBtn = document.getElementById("emoji-btn");
  const emojiPicker = document.getElementById("emoji-picker");

  emojiBtn.addEventListener("click", () => {
    emojiPicker.style.display = emojiPicker.style.display === 'none' ? 'block' : 'none';
  });

  // Handle emoji click, adding the emoji to the message input
  emojiPicker.addEventListener("click", (event) => {
    if (event.target.classList.contains('emoji')) {
      const emoji = event.target.getAttribute("data-emoji");
      messageInput.value += emoji;
      emojiPicker.style.display = 'none'; // Hide the picker after selecting emoji
    }
  });


  connectBtn.addEventListener("click", () => {
      const room = roomInput.value.trim();

      
      const roomName = document.getElementById('room').value;
      const username = document.getElementById('username').value;

      // Check if room and username are provided
      if (roomName && username) {
          // Hide the login screen
          document.getElementById('login-screen').style.display = 'none';
          
          document.getElementById('chat-screen').style.display = 'block';
          

          // You can add more logic here to connect to the chat room and update user list, etc.
      } else {
          alert('Please provide both Room Name and Username.');
      }

      var server = new SillyClient();
      server.connect( "ws://172.201.217.153:80", `CHAT5_${room}`);

      server.on_ready = (my_id) => {
          console.log("Connected to server with ID: " + my_id);
          
          server.sendMessage(JSON.stringify({
            type: "online",
            username: usernameInput.value,
            id: my_id
          }));

          // Update local users history on ready
          myself_as_user = {
            username: usernameInput.value,
            id: my_id
          }
          onlineUsers.push(myself_as_user);
          appendUser(usernameInput.value, userList);
      };
    
      server.on_room_info = (info) => {
        console.log(info);
      }
      
      server.on_user_connected = id => {
          console.log(`User connected: ${id}`);

          // Make all conected users send to him the room's chat history
          //TODO: Make only 1 user (oldest/newest) send the chat history (track who should send it)
          server.sendMessage(JSON.stringify({
            type: "chat_history",
            text: chatHistory
          }));

          //TODO: Make only 1 user (oldest/newest) send the online users (track who should send it)
          server.sendMessage(JSON.stringify({
            type: "online_users",
            text: onlineUsers
          }));
      };

      server.on_user_disconnected = id => {
          console.log(`User disconnected: ${id}`);
          console.log("Before loop: " + JSON.stringify(onlineUsers));


          //TODO: remove the user that has disconnected from connected list
          for (let i = 0; i < onlineUsers.length; i++){
            if (onlineUsers[i].id == id){
              console.log (id);
              console.log(i);
              onlineUsers.splice(i,1); // removes 1 element at position i
            }
          }

          console.log(JSON.stringify(onlineUsers));
          restoreUsers(userList);
          
      };

      server.on_message = (author_id, msg) => {
        parsed_msg = JSON.parse(msg);

        // Distinguish between chat history message and regular message
        if (parsed_msg.type === "chat_history") {
          console.log("Received chat history: " + JSON.stringify(parsed_msg.text));
          chatHistory = parsed_msg.text;
          restoreChat(chatBox);
        }
        else if (parsed_msg.type === "online"){

          // Update local users history when receiving "online"
          newly_joined_user = {
            username: parsed_msg.username,
            id: parsed_msg.id
          }
          onlineUsers.push(newly_joined_user);
          appendUser(parsed_msg.username, userList);
        }
        else if (parsed_msg.type === "online_users"){
          console.log("Received users: " + JSON.stringify(parsed_msg.text));

          // Push each online user into array
          for (let i = 0; i < parsed_msg.text.length; i++) {
            onlineUsers.push(parsed_msg.text[i]);
          }
          console.log(JSON.stringify(onlineUsers));

          restoreUsers(userList);
        }
        
        else { // A regular chat message
          console.log("Received message sent by " + parsed_msg.username + " (ID: " + author_id + "): " + parsed_msg.text);
          appendMessage(parsed_msg.username, parsed_msg.text, chatBox);

          // Update local chat history on receive
          const latest = {
            username: parsed_msg.username,
            text: parsed_msg.text
          };
          chatHistory.push(latest);
          console.log("Local chat history updated after receive: " + JSON.stringify(chatHistory));
        }
      }

      document.addEventListener("click", (event) => {
        if (!emojiPicker.contains(event.target) && event.target !== emojiBtn) {
          emojiPicker.style.display = 'none';
        }
      });


      sendMessageBtn.addEventListener("click", () => {
        // Construct the message as a JSON using the text on the input field + the username
        const message = JSON.stringify({
            type: "chat_message",
            username: usernameInput.value,
            text: messageInput.value
        });
        
        if (message) {
            server.sendMessage(message);  
            console.log("Message sent by: " + usernameInput.value + ": " + messageInput.value);
            appendMessage(usernameInput.value, messageInput.value, chatBox);
            
            // Update your own chat history
            const latest = {
              username: usernameInput.value,
              text: messageInput.value
            };
            chatHistory.push(latest);
            console.log("Local chat history updated after receive: " + JSON.stringify(chatHistory));
        } else {
            console.log("Message cannot be empty!");
        }
      });

  });
});