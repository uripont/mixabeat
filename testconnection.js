

var server = new SillyClient();
server.connect( "ws://172.201.217.153:80", "CHAT5_roomnametest");

//this method is called when the server accepts the connection (no ID yet nor info about the room)
server.on_connect = function(){
  console.log("Connected to server");
};