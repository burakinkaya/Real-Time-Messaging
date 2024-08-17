const express = require("express");
const router = express.Router();
const Message = require("../models/Message");
const User = require("../models/User");
const mongoose = require("mongoose");
const WebSocket = require("ws");

function broadcastMessage(data) {
  global.wss.clients.forEach(function each(client) {
    if (client.readyState === WebSocket.OPEN && client.isAuthorized) {
      const currentUserId = client.userId;

      if (
        data.message.owner._id.toString() === currentUserId ||
        data.message.receiver._id.toString() === currentUserId
      ) {
        client.send(JSON.stringify(data));
      }
    }
  });
}

router.post("/messages", async (req, res) => {
  try {
    const { text, owner, receiver } = req.body;
    const senderUser = await User.findById(owner);
    const receiverUser = await User.findById(receiver);

    if (!senderUser || !receiverUser) {
      return res.status(404).json({ message: "User not found" });
    }

    const message = new Message({
      text: text,
      owner: mongoose.Types.ObjectId(senderUser._id),
      receiver: mongoose.Types.ObjectId(receiverUser._id),
    });

    await message.save();

    const populatedMessage = await message
      .populate("owner", "username dhPublicKey")
      .populate("receiver", "username dhPublicKey")
      .execPopulate();

    broadcastMessage({
      type: "new",
      message: populatedMessage,
    });

    res.status(201).json({
      message: "Message sent successfully",
      data: populatedMessage,
    });
  } catch (error) {
    console.error("Error during message processing:", error);
    res.status(500).json({ message: "Error sending message: " + error.message });
  }
});

router.get("/messages/private/:userId/:chatUserId", async (req, res) => {
  try {
    const { userId, chatUserId } = req.params;

    const messages = await Message.find({
      $or: [
        { owner: mongoose.Types.ObjectId(userId), receiver: mongoose.Types.ObjectId(chatUserId) },
        { owner: mongoose.Types.ObjectId(chatUserId), receiver: mongoose.Types.ObjectId(userId) },
      ],
    })
      .populate("owner", "username dhPublicKey")
      .populate("receiver", "username dhPublicKey");

    res.status(200).json(messages);
  } catch (err) {
    res.status(500).json({ message: "Error fetching private messages: " + err.message });
  }
});

router.post("/messages/deleteFromCurrentUser/:id", async (req, res) => {
  const { userId } = req.body;
  const messageId = req.params.id;
  const messageIdObject = mongoose.Types.ObjectId(messageId);
  const userIdObject = mongoose.Types.ObjectId(userId);

  if (!mongoose.Types.ObjectId.isValid(userIdObject) || !mongoose.Types.ObjectId.isValid(messageIdObject)) {
    return res.status(422).json({ message: "Invalid userId or messageId" });
  }

  try {
    const message = await Message.findByIdAndUpdate(
      messageIdObject,
      { $addToSet: { deletedFrom: userIdObject } },
      { new: true }
    )
      .populate("owner", "username")
      .populate("receiver", "username");

    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }
    broadcastMessage({ type: "deleteone", message });
    res.json({ message: "Message is deleted for current user", data: message });
  } catch (error) {
    console.error("Error updating message:", error);
    res.status(500).json({ message: "Error deleting message: " + error.message });
  }
});

router.patch("/messages/deleteForEveryone/:id", async (req, res) => {
  try {
    // console.log("Request to delete for everyone received, messageId:", req.params.id);

    const update = {
      isDeleted: true,
    };

    const message = await Message.findByIdAndUpdate(req.params.id, update, { new: true }).populate(
      "owner receiver",
      "username dhPublicKey"
    );

    if (!message) {
      console.error("Message not found:", req.params.id);
      return res.status(404).json({ message: "Message not found" });
    }

    // console.log("Message marked as deleted for everyone, broadcasting...");

    broadcastMessage({ type: "deleteall", message: message });

    // console.log("Broadcast completed, responding to client...");

    res.json({ message: "Message is deleted for all users", data: message });
  } catch (error) {
    console.error("Error occurred while deleting for everyone:", error);
    res.status(500).json({ message: error.message });
  }
});

router.patch("/messages/edit/:id", async (req, res) => {
  try {
    const messageId = req.params.id;
    const { text } = req.body;

    const updatedMessage = await Message.findByIdAndUpdate(messageId, { text: text }, { new: true }).populate(
      "owner receiver",
      "username dhPublicKey"
    );

    if (!updatedMessage) {
      return res.status(404).json({ message: "Message not found" });
    }

    broadcastMessage({
      type: "update",
      message: updatedMessage,
    });

    res.json({ message: "Message is updated", data: updatedMessage });
  } catch (error) {
    console.error("Error updating message:", error);
    res.status(500).json({ message: error.message });
  }
});

router.get("/messages/chats", async (req, res) => {
  try {
    const currentUserId = req.query.userId;

    const chats = await Message.aggregate([
      {
        $match: {
          $or: [
            { owner: mongoose.Types.ObjectId(currentUserId) },
            { receiver: mongoose.Types.ObjectId(currentUserId) },
          ],
        },
      },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: {
            members: {
              $cond: {
                if: { $lt: ["$owner", "$receiver"] },
                then: ["$owner", "$receiver"],
                else: ["$receiver", "$owner"],
              },
            },
          },
          lastMessage: { $first: "$$ROOT" },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "lastMessage.owner",
          foreignField: "_id",
          as: "ownerDetails",
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "lastMessage.receiver",
          foreignField: "_id",
          as: "receiverDetails",
        },
      },
    ]);

    res.status(200).json({ data: chats });
  } catch (err) {
    console.error("Error fetching chats:", err);
    res.status(500).json({ message: "Error fetching chats: " + err.message });
  }
});

module.exports = router;
