const http = require("http");
const WebSocket = require("ws");
const app = require("../app");
const connectDB = require("./database");

connectDB();

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
global.wss = wss;
wss.on("connection", function connection(ws, req) {
  console.log("A new WebSocket connection has been established");
  ws.on("message", function incoming(message) {
    wss.clients.forEach(function each(client) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  });

  ws.on("close", () => {
    console.log("WebSocket connection closed");
  });
});

server.listen(3000, () => {
  console.log("Server is running on port 3000");
});
