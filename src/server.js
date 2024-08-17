const http = require("http");
const WebSocket = require("ws");
const app = require("../app");
const connectDB = require("./database");

connectDB();

const server = http.createServer(app);

server.setTimeout(50000, () => {
  console.log("Request has timed out.");
});

const wss = new WebSocket.Server({ server });
global.wss = wss;

wss.on("connection", function connection(ws, req) {
  console.log("A new WebSocket connection has been established");

  ws.isAuthorized = false;

  ws.on("message", function incoming(message) {
    const parsedMessage = JSON.parse(message);

    if (!ws.isAuthorized && parsedMessage.type === "auth") {
      ws.userId = parsedMessage.userId;
      ws.isAuthorized = true;
      console.log(`WebSocket connection authorized for userId: ${ws.userId}`);
    } else if (ws.isAuthorized) {
      wss.clients.forEach(function each(client) {
        if (
          client.readyState === WebSocket.OPEN &&
          client.isAuthorized &&
          (parsedMessage.message.owner._id === client.userId || parsedMessage.message.receiver._id === client.userId)
        ) {
          client.send(message);
        }
      });
    } else {
      console.error("Unauthorized WebSocket connection attempt");
      ws.close();
    }
  });

  ws.on("close", () => {
    console.log("WebSocket connection closed");
  });
});

server.listen(3000, () => {
  console.log("Server is running on port 3000");
});
