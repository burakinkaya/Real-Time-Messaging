const express = require("express");
const router = express.Router();
const User = require("../models/User");

router.post("/users", async (req, res) => {
  try {
    let { username } = req.body;
    let user = await User.findOne({ username });
    if (!user) {
      user = new User({ username });
      await user.save();
    }
    res.status(200).json({ username: user.username, _id: user._id });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.get("/users", async (req, res) => {
  try {
    const users = await User.find({});
    if (!users.length) {
      console.log("No users found");
      return res.status(404).json({ message: "No users found" });
    }

    res.status(200).json(users);
  } catch (err) {
    console.error("Error fetching users:", err);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
