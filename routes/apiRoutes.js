const express = require("express");
const router = express.Router();

const userRouter = require("./UserRouter");
const messageRouter = require("./MessageRouter");

router.use("/users", userRouter);

router.use("/messages", messageRouter);

module.exports = router;
