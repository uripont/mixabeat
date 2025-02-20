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
    
    //userBtn.disabled = true;
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
  const container = document.createElement('div');
  container.classList.add('user-container');

  const generalBtn = document.createElement('button');
  generalBtn.classList.add('user-button', 'general-chat');
  generalBtn.id = 'general-chat-btn';
  generalBtn.addEventListener('click', switchToGeneralChat);
  
  const nameLabel = document.createElement('div');
  nameLabel.classList.add('user-name');
  nameLabel.textContent = "All";
  
  container.appendChild(generalBtn);
  container.appendChild(nameLabel);
  userList.appendChild(container);
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
var generalChatResponsible = null; // Tracks which user is responsible for general chat
var waitingForResponsible = false; // Flag to track if we're waiting for responsible user
var RESPONSIBILITY_TIMEOUT = 3000; // Time to wait for responsible before assuming empty room
const assignedTracks = {};

function findNextResponsible() {
  if (onlineUsers.length === 0) return null;
  // Sort by join time and get earliest joined user
  return onlineUsers.sort((a, b) => a.joinTime - b.joinTime)[0];
}

function setGeneralChatResponsible(userId, server) {
  generalChatResponsible = userId;
  
  if (myself_as_user?.id === userId) {
    console.log('[GENERAL] Now responsible for chat history');
  }
  
  console.log('[GENERAL] Broadcasting new responsible:', userId);
  server.sendMessage(JSON.stringify({
    type: "responsible_status",
    responsibleId: userId,
    timestamp: Date.now() // Include timestamp for synchronization
  }));
}

document.addEventListener("DOMContentLoaded", () => {
  const connectBtn = document.getElementById("connect-btn");
  const roomInput = document.getElementById("room");
  const usernameInput = document.getElementById("username");
  chatBox = document.getElementById('chat-box'); // Assign to global variable
  const userList = document.getElementById('user-list');
  const messageInput = document.getElementById("message");
  const sendMessageBtn = document.getElementById("send-message-btn");
  const emojiBtn = document.getElementById("emoji-btn");

  


  // Handle emoji click, adding the emoji to the message input
  emojiBtn.addEventListener("click", (event) => {
    if (event.target.classList.contains('emoji')) {
      const emoji = event.target.getAttribute("data-emoji");
      messageInput.value += emoji;
      event.stopPropagation();
    }
  });


  // Add initial general chat button
  addGeneralChatButton(userList);

  connectBtn.addEventListener("click", () => {
      const room = roomInput.value.trim();
      const roomName = document.getElementById('room').value;
      const username = document.getElementById('username').value;

      // Check if room and username are provided
      if (roomName && username) {
          // Hide the login screen
          document.getElementById('login-screen').style.display = 'none';
          document.getElementById('chat-screen').style.display = 'block';
          document.getElementById('left-container').style.display = 'block';
      } else {
          alert('Please provide both Room Name and Username.');
          return;
      }

      var server = new SillyClient();
      // For public-facing server
      server.connect( "ws://172.201.217.153:80", `CHAT5_${room}`);

      // For server using VPN
      //server.connect( "ecv-2025.doc.upf.edu/port/55000/ws", `CHAT5_${room}`);

      server.on_ready = (my_id) => {
          console.log("Connected to server with ID: " + my_id);
          waitingForResponsible = true;
          
          const avatarId = document.getElementById("avatar").value;
          const joinTime = Date.now();
          
          server.sendMessage(JSON.stringify({
            type: "online",
            username: usernameInput.value,
            id: my_id,
            avatar: avatarId,
            joinTime: joinTime
          }));

          // Update local users history on ready
          myself_as_user = {
            username: usernameInput.value,
            id: my_id,
            avatar: avatarId,
            joinTime: joinTime
          };
          onlineUsers.push(myself_as_user);
          appendUser(myself_as_user, userList, onlineUsers.length - 1);

          // Wait for responsible user to contact us
          setTimeout(() => {
            if (waitingForResponsible) {
              // Only become responsible if we're the first user
              const nextResponsible = findNextResponsible();
              if (nextResponsible && nextResponsible.id === my_id) {
                console.log('[GENERAL] No response from responsible, taking responsibility as earliest user');
                setGeneralChatResponsible(my_id, server);
              }
              waitingForResponsible = false;
            }
          }, RESPONSIBILITY_TIMEOUT);

          // Setup avatar change handler
          const changeAvatarSelect = document.getElementById("change-avatar");
          changeAvatarSelect.value = avatarId; // Set initial value
          changeAvatarSelect.addEventListener("change", () => {
            const newAvatarId = changeAvatarSelect.value;
            myself_as_user.avatar = newAvatarId;
            
            // Send to everyone in the room (yet new message type)
            server.sendMessage(JSON.stringify({
              type: "avatar_update",
              userId: myself_as_user.id,
              newAvatar: newAvatarId
            }));
            // Refresh display
            restoreUsers(userList);
          }); 
          
          const canvas = document.getElementById('timeline-canvas');
          const ctx = canvas.getContext('2d');

          // Set the canvas dimensions
          canvas.width = 50000; // Adjust as needed
          canvas.height = 1000; // Adjust as needed
          const trackHeight = 200;

          // Define the colors for each track
          const trackColors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEEAD', '#F42F2F', '#00D0C2', '#F17000', '#00C066', '#EEBF00', '#00A7CD', '#888888'];
          
          // Draw each track with a different color
          trackColors.forEach((color, index) => {
            ctx.fillStyle = color;
            ctx.fillRect(0, index * trackHeight, canvas.width, trackHeight);
        
            if (index < trackColors.length - 1) {
              ctx.strokeStyle = '#000000'; // Line color
              ctx.lineWidth = 2; // Line width
              ctx.beginPath();
              ctx.moveTo(0, (index + 1) * trackHeight);
              ctx.lineTo(canvas.width, (index + 1) * trackHeight);
              ctx.stroke();
            }
          });

          canvas.addEventListener('click', (event) => {
            const rect = canvas.getBoundingClientRect();
            const scaleY = canvas.height / rect.height; // Calculate the scale factor
            const y = (event.clientY - rect.top) * scaleY;
            const trackIndex = Math.floor(y / trackHeight);

    
            // Replace 'userId' with the actual user ID
            if (assignedTracks[trackIndex]) {
              alert('This track is already assigned to another user.');
              return;
            }
    
            // Assign the track to the user
            assignedTracks[trackIndex] = myself_as_user.id;
    
            // Paint all tracks grey
            for (let i = 0; i < trackColors.length; i++) {
              ctx.fillStyle = '#808080'; // Grey color
              ctx.fillRect(0, i * trackHeight, canvas.width, trackHeight);
            }
    
            // Highlight the selected track in pink
            ctx.fillStyle = '#FFC0CB'; // Pink color
            ctx.fillRect(0, trackIndex * trackHeight, canvas.width, trackHeight);
    
            // Redraw the lines between tracks
            for (let i = 0; i < trackColors.length - 1; i++) {
              ctx.strokeStyle = '#000000'; // Line color
              ctx.lineWidth = 2; // Line width
              ctx.beginPath();
              ctx.moveTo(0, (i + 1) * trackHeight);
              ctx.lineTo(canvas.width, (i + 1) * trackHeight);
              ctx.stroke();
            }
          });

          

      };
    
      server.on_room_info = (info) => {
        console.log(info);
      }
      
      server.on_user_connected = id => {
          console.log(`[GENERAL] User connected:`, id);

          // Only the responsible user sends data to new users
          if (myself_as_user?.id === generalChatResponsible) {
            console.log('[GENERAL] Sending data to new user:', id);
            // Send messages only to the new user
            server.sendMessage(JSON.stringify({
              type: "chat_history",
              text: chatHistories.general,
              timestamp: Date.now()
            }), [id]);

            server.sendMessage(JSON.stringify({
              type: "online_users",
              text: onlineUsers,
              timestamp: Date.now()
            }), [id]);

            server.sendMessage(JSON.stringify({
              type: "responsible_status",
              responsibleId: generalChatResponsible,
              timestamp: Date.now()
            }), [id]);
          }
      };

      server.on_user_disconnected = id => {
          console.log(`[GENERAL] User disconnected:`, id);

          // Remove the user that has disconnected from connected list
          let wasResponsible = id === generalChatResponsible;
          for (let i = 0; i < onlineUsers.length; i++){
            if (onlineUsers[i].id == id){
              onlineUsers.splice(i,1); // removes 1 element at position i
              break;
            }
          }

          restoreUsers(userList);

          // After removing user, if they were responsible, assign new responsible
          if (wasResponsible && onlineUsers.length > 0) {
            console.log('[GENERAL] Responsible user disconnected');
            const nextResponsible = findNextResponsible();
            if (nextResponsible) {
              console.log('[GENERAL] Assigning new responsible based on join time:', nextResponsible.id);
              setGeneralChatResponsible(nextResponsible.id, server);
            }
          }
      };

      server.on_message = (author_id, msg) => {
        const parsed_msg = JSON.parse(msg);

        if (parsed_msg.type === "chat_history") {
          console.log('[GENERAL] Received chat history');
          chatHistories.general = parsed_msg.text;
          restoreChat(chatBox, chatHistories.general);
        }
        else if (parsed_msg.type === "online"){
          // Update local users history when receiving "online"
          newly_joined_user = {
            username: parsed_msg.username,
            id: parsed_msg.id,
            avatar: parsed_msg.avatar,
            joinTime: parsed_msg.joinTime
          }
          onlineUsers.push(newly_joined_user);
          appendUser(newly_joined_user, userList, onlineUsers.length - 1);
        }
        else if (parsed_msg.type === "online_users"){
          console.log('[GENERAL] Received online users list');
          
          // Push each online user into array
          for (let i = 0; i < parsed_msg.text.length; i++) {
            onlineUsers.push(parsed_msg.text[i]);
          }

          restoreUsers(userList);
        }
        else if (parsed_msg.type === "responsible_status") {
          console.log('[GENERAL] New responsible user:', parsed_msg.responsibleId);
          generalChatResponsible = parsed_msg.responsibleId;
          waitingForResponsible = false; // We got our answer about who's responsible
        }
        else if (parsed_msg.type === "avatar_update") {
          // Find and update user's avatar
          const userToUpdate = onlineUsers.find(u => u.id === parsed_msg.userId);
          if (userToUpdate) {
            userToUpdate.avatar = parsed_msg.newAvatar;
            restoreUsers(userList);
          }
        }
        else if (parsed_msg.type === "private_message") {
          console.log("Private message from", parsed_msg.username);
          
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
          console.log("Message from", parsed_msg.username);
          
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
        }
      }

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
        
        console.log("Message sent by", usernameInput.value);
        appendMessage(usernameInput.value, messageText, chatBox);

        // Store in appropriate history
        const latest = {
          username: usernameInput.value,
          text: messageText
        };
        
        if (activeChat === "general") {
          chatHistories.general.push(latest);
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

