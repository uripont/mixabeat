function appendMessage(sender, message, chatBox) {
  const msg = document.createElement('div');
  msg.textContent = `${sender}: ${message}`;
  chatBox.appendChild(msg);
  chatBox.scrollTop = chatBox.scrollHeight; 
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
      };

      server.on_user_disconnected = id => {
          console.log(`User disconnected: ${id}`);
      };

      server.on_message = (author_id, msg) => {
        msg = JSON.parse(msg);
        console.log("Received message sent by: " + msg.username + " (ID: " + author_id + "): " + msg.text);
        appendMessage(msg.username, msg.text, chatBox);
      }


      sendMessageBtn.addEventListener("click", () => {
        //Construct the message as a JSON using the text on the input field + the username
        const message = JSON.stringify({
            username: usernameInput.value,
            text: messageInput.value
        });
        
        if (message) {
            server.sendMessage(message);  
            console.log("Message sent by: " + usernameInput.value + ": " + messageInput.value);
            appendMessage(usernameInput.value, messageInput.value, chatBox);
        } else {
            console.log("Message cannot be empty!");
        }
      });

  });
});
