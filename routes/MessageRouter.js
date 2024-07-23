const express = require("express");
const router = express.Router();
const Message = require("../models/Message");
const User = require("../models/User");
const mongoose = require("mongoose");
const WebSocket = require("ws");

function broadcastMessage(data) {
  global.wss.clients.forEach(function each(client) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
}

router.post("/messages", async (req, res) => {
  try {
    const { text, owner } = req.body;
    const user = await User.findOne({ username: owner });
    if (!user) return res.status(404).json({ message: "User not found" });

    const message = new Message({ text, owner: user._id });
    await message.save();
    const populatedMessage = await message.populate("owner", "username").execPopulate();
    broadcastMessage({ type: "new", message: populatedMessage });
    res.status(201).json(populatedMessage);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.get("/messages", async (req, res) => {
  try {
    const messages = await Message.find().populate("owner", "username");
    res.status(200).json(messages);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post("/messages/deleteFromCurrentUser/:id", async (req, res) => {
  const { userId } = req.body;
  const messageId = req.params.id;

  const messageIdObject = mongoose.Types.ObjectId(messageId);
  const userIdObject = mongoose.Types.ObjectId(userId);

  if (!mongoose.Types.ObjectId.isValid(userIdObject) || !mongoose.Types.ObjectId.isValid(messageIdObject)) {
    return res.status(400).json({ message: "Invalid userId or messageId" });
  }

  try {
    const message = await Message.findByIdAndUpdate(
      messageIdObject,
      { $addToSet: { deletedFrom: userIdObject } },
      { new: true }
    ).populate("owner", "username");

    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }
    broadcastMessage({ type: "deleteone", message });
    res.json(message);
  } catch (error) {
    console.error("Error updating message:", error);
    res.status(500).json({ message: error.message });
  }
});

router.patch("/messages/deleteForEveryone/:id", async (req, res) => {
  try {
    const update = {
      isDeleted: true,
    };
    const message = await Message.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!message) return res.status(404).json({ message: "Message not found" });
    broadcastMessage({ type: "deleteall", id: req.params.id });
    res.json(message);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.patch("/messages/edit/:id", async (req, res) => {
  try {
    const messageId = req.params.id;
    const messageIdObject = mongoose.Types.ObjectId(messageId);
    const update = { text: req.body.text };
    const message = await Message.findByIdAndUpdate(messageIdObject, update, { new: true });
    if (!message) return res.status(404).json({ message: "Message not found" });
    broadcastMessage({ type: "update", message });
    res.json(message);
  } catch (error) {
    console.error("Error updating message:", error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
