function appendMessage(sender, message, chatBox) {
  const msg = document.createElement('div');
  msg.textContent = `${sender}: ${message}`;
  chatBox.appendChild(msg);
  chatBox.scrollTop = chatBox.scrollHeight; 
}

function restoreChat(chatBox, history) {
  if (!history) return;
  for (let i = 0; i < history.length; i++) {
    appendMessage(history[i].username, history[i].text, chatBox);
  }
}

function restoreUsers(userList) {
  // Reset UI list of online users
  while (userList.firstChild){
    userList.removeChild(userList.firstChild)
  }

  // Add back the general chat button first
  addGeneralChatButton(userList);

  // Rebuild UI list of online users
  for (let i = 0; i < onlineUsers.length; i++) {
    appendUser(onlineUsers[i], userList, i);
  }
}

function appendUser(user, userList, index) {
  const userBtn = document.createElement('button');
  userBtn.textContent = user.username;
  userBtn.classList.add('user-button');
  userBtn.addEventListener('click', () => {
    // User object is directly accessible through onlineUsers[index]
    if (user.id !== myself_as_user.id) { // Don't handle clicks on your own button
      console.log("Clicked user:", onlineUsers[index]);
    }
  });
  userList.appendChild(userBtn);
  userList.scrollTop = userList.scrollHeight;
}

function addGeneralChatButton(userList) {
  const generalBtn = document.createElement('button');
  generalBtn.textContent = "General Chat";
  generalBtn.classList.add('user-button', 'general-chat');
  generalBtn.id = 'general-chat-btn';
  userList.appendChild(generalBtn);
}

var chatHistories = {
  general: [],
  private: {}
};
var onlineUsers = [];
var activeChat = "general";
var myself_as_user = null;

document.addEventListener("DOMContentLoaded", () => {
  const connectBtn = document.getElementById("connect-btn");
  const roomInput = document.getElementById("room");
  const usernameInput = document.getElementById("username");
  const chatBox = document.getElementById('chat-box');
  const userList = document.getElementById('user-list');
  const messageInput = document.getElementById("message");
  const sendMessageBtn = document.getElementById("send-message-btn");

  // Add initial general chat button
  addGeneralChatButton(userList);

  connectBtn.addEventListener("click", () => {
      const room = roomInput.value.trim();

      if (!room) {
          alert("Room Name is required!");
          return;
      }

      var server = new SillyClient();
      // For public-facing server
      server.connect( "ws://172.201.217.153:80", `CHAT5_${room}`);

      // For server using VPN
      //server.connect( "ecv-2025.doc.upf.edu/port/55000/ws", `CHAT5_${room}`);

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
          };
          onlineUsers.push(myself_as_user);
          appendUser(myself_as_user, userList, onlineUsers.length - 1);
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
            text: chatHistories.general
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
              console.log(id);
              console.log(i);
              onlineUsers.splice(i,1); // removes 1 element at position i
            }
          }

          console.log(JSON.stringify(onlineUsers));
          restoreUsers(userList);
      };

      server.on_message = (author_id, msg) => {
        const parsed_msg = JSON.parse(msg);

        if (parsed_msg.type === "chat_history") {
          console.log("Received chat history: " + JSON.stringify(parsed_msg.text));
          chatHistories.general = parsed_msg.text;
          restoreChat(chatBox, chatHistories.general);
        }
        else if (parsed_msg.type === "online"){
          
          // Update local users history when receiving "online"
          newly_joined_user = {
            username: parsed_msg.username,
            id: parsed_msg.id
          }
          onlineUsers.push(newly_joined_user);
          appendUser(newly_joined_user, userList, onlineUsers.length - 1);
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
          chatHistories.general.push(latest);
          console.log("Local chat history updated after receive: " + JSON.stringify(chatHistories.general));
        }
      }

      sendMessageBtn.addEventListener("click", () => {
        if (!messageInput.value) {
            console.log("Message cannot be empty!");
            return;
        }

        const message = JSON.stringify({
            type: "chat_message",
            username: usernameInput.value,
            text: messageInput.value
        });
        
        server.sendMessage(message);  
        console.log("Message sent by: " + usernameInput.value + ": " + messageInput.value);
        appendMessage(usernameInput.value, messageInput.value, chatBox);

        // Update your own chat history
        const latest = {
          username: usernameInput.value,
          text: messageInput.value
        };
        chatHistories.general.push(latest);
        console.log("Local chat history updated after receive: " + JSON.stringify(chatHistories.general));

        messageInput.value = ''; // Clear input after sending
      });
  });
});
