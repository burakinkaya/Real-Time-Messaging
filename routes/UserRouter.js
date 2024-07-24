const express = require("express");
const router = express.Router();
const User = require("../models/User");

router.post("/users", async (req, res) => {
  try {
    const { username } = req.body;
    const userExists = await User.exists({ username });
    if (userExists) {
      return res.status(409).json({ message: "User already exists" });
    }
    const user = new User({ username });
    await user.save();
    res.status(201).json({ username: user.username, _id: user._id, message: "User created successfully" });
  } catch (err) {
    res.status(500).json({ message: "Error creating user: " + err.message });
  }
});

router.get("/users", async (req, res) => {
  try {
    const users = await User.find({});
    if (!users.length) {
      console.log("No users found");
      return res.status(404).json({ message: "No user is found" });
    }
    res.status(200).json({ data: users, message: "Users fetched successfully" });
  } catch (err) {
    console.error("Error fetching user:", err);
    res.status(500).json({ message: "Error fetching user: " + err.message });
  }
});

module.exports = router;
