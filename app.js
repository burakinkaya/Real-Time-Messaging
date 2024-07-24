const express = require("express");
const app = express();
const path = require("path");
const apiRoutes = require("./routes/apiRoutes");

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "home.html"));
});

app.use("/api", apiRoutes);

module.exports = app;
