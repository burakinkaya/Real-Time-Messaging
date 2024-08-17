const express = require("express");
const router = express.Router();
const User = require("../models/User");

router.post("/users", async (req, res) => {
  try {
    const { username, publicKey } = req.body;
    const user = await User.findOne({ username });

    if (user) {
      console.log("User already exists, logging in:", username);
      return res.status(200).json({
        username: user.username,
        _id: user._id,
        message: "User logged in successfully",
      });
    }

    console.log("Registering user with public key:", publicKey);

    const newUser = new User({ username, dhPublicKey: publicKey });
    await newUser.save();

    res.status(201).json({
      username: newUser.username,
      _id: newUser._id,
      message: "User created successfully",
    });
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

router.get("/users/:userId", async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.status(200).json(user);
  } catch (err) {
    console.error("Error fetching user:", err);
    res.status(500).json({ message: "Error fetching user: " + err.message });
  }
});

module.exports = router;
