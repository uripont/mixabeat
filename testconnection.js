function onMessageReceivedCallback (author_id, msg){
    console.log("Received message sent by: " + author_id + ": " + msg);
  }

document.addEventListener("DOMContentLoaded", () => {
  const connectBtn = document.getElementById("connect-btn");
  const roomInput = document.getElementById("room");
  const usernameInput = document.getElementById("username");

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

      server.on_message = onMessageReceivedCallback;



      sendMessageBtn.addEventListener("click", () => {
        const message = messageInput.value.trim();
        
        if (message) {
            server.sendMessage(message);  
            console.log("Message sent: " + message);
            //messageInput.value = "";  

        
        } else {
            console.log("Message cannot be empty!");
        }
      });

  });
});
