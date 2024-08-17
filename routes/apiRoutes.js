const express = require("express");
const router = express.Router();

const userRouter = require("./UserRouter");
const messageRouter = require("./MessageRouter");

console.log("API Routes loaded");

router.use("/", userRouter);
router.use("/", messageRouter);

module.exports = router;
