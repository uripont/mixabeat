

var server = new SillyClient();
server.connect( "ws://172.201.217.153:80", "CHAT5_roomnametest");

//this method is called when the server accepts the connection (no ID yet nor info about the room)
server.on_connect = function(){
  console.log("Connecting to server");
};

server.on_ready = ( my_id ) =>
  {
    console.log("Connected to server with ID: " + my_id);
  }

console.log("testconnection.js loaded");