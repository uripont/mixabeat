function appendMessage(sender, message, chatBox) {
  const msg = document.createElement('div');
  msg.textContent = `${sender}: ${message}`;
  chatBox.appendChild(msg);
  chatBox.scrollTop = chatBox.scrollHeight; 
}

var chatHistory = [];

function restoreChat(chatBox) {
  for (let i = 0; i < chatHistory.length; i++) {
    appendMessage(chatHistory[i].username, chatHistory[i].text, chatBox);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const connectBtn = document.getElementById("connect-btn");
  const roomInput = document.getElementById("room");
  const usernameInput = document.getElementById("username");
  const chatBox = document.getElementById('chat-box');
  const messageInput = document.getElementById("message");
  const sendMessageBtn = document.getElementById("send-message-btn");


  connectBtn.addEventListener("click", () => {
      const room = roomInput.value.trim();

      if (!room) {
          alert("Room Name is required!");
          return;
      }

      var server = new SillyClient();
      server.connect( "ws://172.201.217.153:80", `CHAT5_${room}`);

      server.on_ready = (my_id) => {
          console.log("Connected to server with ID: " + my_id);
      };
    
      server.on_room_info = (info) => {
        console.log(info);
      }
      
      server.on_user_connected = id => {
          console.log(`User connected: ${id}`);

          // Make all conected users send to him the room's chat history
          server.sendMessage(JSON.stringify({
            type: "chat_history",
            text: chatHistory
          }));
      };

      server.on_user_disconnected = id => {
          console.log(`User disconnected: ${id}`);
      };

      server.on_message = (author_id, msg) => {
        parsed_msg = JSON.parse(msg);

        // Distinguish between chat history message and regular message
        if (parsed_msg.type === "chat_history") {
          console.log("Received chat history: " + JSON.stringify(parsed_msg.text));
          chatHistory = parsed_msg.text;

          restoreChat(chatBox);
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
