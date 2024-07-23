const express = require("express");
const app = express();
const path = require("path");

app.use(express.json());

app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "home.html"));
});

const userRouter = require("./routes/UserRouter");
app.use("/api", userRouter);

const messageRoutes = require("./routes/MessageRouter");
app.use("/api", messageRoutes);

module.exports = app;
