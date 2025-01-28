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
  const container = document.createElement('div');
  container.classList.add('user-container');

  const userBtn = document.createElement('button');
  userBtn.classList.add('user-button');
  userBtn.classList.add(`avatar-${user.avatar}`);
  
  const nameLabel = document.createElement('div');
  nameLabel.classList.add('user-name');
  
  // Special handling for current user's button
  if (user.id === myself_as_user?.id) {
    nameLabel.textContent = `${user.username} (You)`;
    userBtn.disabled = true;
  } else {
    nameLabel.textContent = user.username;
    userBtn.addEventListener('click', () => {
      // User object is directly accessible through onlineUsers[index]
      console.log("Clicked user:", onlineUsers[index]);
      switchToPrivateChat(onlineUsers[index]);
    });
  }
  
  container.appendChild(userBtn);
  container.appendChild(nameLabel);
  userList.appendChild(container);
  userList.scrollTop = userList.scrollHeight;
}

function addGeneralChatButton(userList) {
  const generalBtn = document.createElement('button');
  generalBtn.textContent = "General Chat";
  generalBtn.classList.add('user-button', 'general-chat');
  generalBtn.id = 'general-chat-btn';
  generalBtn.addEventListener('click', switchToGeneralChat);
  userList.appendChild(generalBtn);
}

function getChatKey(id1, id2) { // In format "id1-id2"
  return [id1, id2].sort().join('-'); // Sort to ensure same key regardless of order
}

function switchToPrivateChat(user) {
  activeChat = user.id;
  document.getElementById('chat-header').textContent = `Private chat with ${user.username}`;
  document.getElementById('general-chat-btn').classList.remove('active');
  
  // Clear current chat before showing new one
  chatBox.innerHTML = '';
  
  // Initialize or restore private chat history
  const chatKey = getChatKey(myself_as_user.id, user.id);
  if (!chatHistories.private[chatKey]) {
    chatHistories.private[chatKey] = [];
  }
  restoreChat(chatBox, chatHistories.private[chatKey]);
}

function switchToGeneralChat() {
  activeChat = "general";
  document.getElementById('chat-header').textContent = "General Chat";
  document.getElementById('general-chat-btn').classList.add('active');
  chatBox.innerHTML = ''; // Clear chat
  restoreChat(chatBox, chatHistories.general);
}

var chatHistories = {
  general: [],
  private: {}
};
var onlineUsers = [];
var activeChat = "general";
var myself_as_user = null;
var chatBox = null; // chatBox accessible globally

document.addEventListener("DOMContentLoaded", () => {
  const connectBtn = document.getElementById("connect-btn");
  const roomInput = document.getElementById("room");
  const usernameInput = document.getElementById("username");
  chatBox = document.getElementById('chat-box'); // Assign to global variable
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
          
          const avatarId = document.getElementById("avatar").value;
          server.sendMessage(JSON.stringify({
            type: "online",
            username: usernameInput.value,
            id: my_id,
            avatar: avatarId
          }));

          // Update local users history on ready
          myself_as_user = {
            username: usernameInput.value,
            id: my_id,
            avatar: avatarId
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
            text: chatHistories.general // private chat history not sent
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

          // Remove the user that has disconnected from connected list
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
            id: parsed_msg.id,
            avatar: parsed_msg.avatar
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
        else if (parsed_msg.type === "private_message") {
          console.log("Received private message from " + parsed_msg.username + " (ID: " + author_id + "): " + parsed_msg.text);
          
          // Store in private chat history
          const chatKey = getChatKey(myself_as_user.id, author_id);
          if (!chatHistories.private[chatKey]) {
            chatHistories.private[chatKey] = [];
          }
          
          // Update private chat history
          const latest = {
            username: parsed_msg.username,
            text: parsed_msg.text
          };
          chatHistories.private[chatKey].push(latest);

          // Only display if in private chat with sender
          if (activeChat === author_id) {
            appendMessage(parsed_msg.username, parsed_msg.text, chatBox);
          }
        }
        else { // A regular chat message
          console.log("Received message sent by " + parsed_msg.username + " (ID: " + author_id + "): " + parsed_msg.text);
          
          // Update general chat history
          const latest = {
            username: parsed_msg.username,
            text: parsed_msg.text
          };
          chatHistories.general.push(latest);
          
          // Only display if in general chat
          if (activeChat === "general") {
            appendMessage(parsed_msg.username, parsed_msg.text, chatBox);
          }
          console.log("Local chat history updated after receive: " + JSON.stringify(chatHistories.general));
        }
      }
          ges
      //TODO: Add a a way to update avatar (selector to be moved into chat view)
      //(listener on avatar selector, send message to everyone, everyone updates selection)

      sendMessageBtn.addEventListener("click", () => {
        if (!messageInput.value) {
            console.log("Message cannot be empty!");
            return;
        }

        let message;
        const messageText = messageInput.value;
        
        if (activeChat === "general") {
          message = {
            type: "chat_message",
            username: usernameInput.value,
            text: messageText
          };
          server.sendMessage(JSON.stringify(message));
        } else {
          message = {
            type: "private_message",
            username: usernameInput.value,
            text: messageText,
            recipientId: activeChat
          };
          // Private chats: send only to recipient and self
          server.sendMessage(JSON.stringify(message), [activeChat, myself_as_user.id]);
        }
        
        console.log("Message sent by: " + usernameInput.value + ": " + messageText);
        appendMessage(usernameInput.value, messageText, chatBox);

        // Store in appropriate history
        const latest = {
          username: usernameInput.value,
          text: messageText
        };
        
        if (activeChat === "general") {
          chatHistories.general.push(latest);
          console.log("Local chat history updated after send: " + JSON.stringify(chatHistories.general));
        } else {
          const chatKey = getChatKey(myself_as_user.id, activeChat);
          if (!chatHistories.private[chatKey]) {
            chatHistories.private[chatKey] = [];
          }
          chatHistories.private[chatKey].push(latest);
        }

        messageInput.value = ''; // Clear input after sending
      });
  });
});
