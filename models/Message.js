const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const messageSchema = new Schema({
  text: {
    type: String,
    required: true,
  },
  owner: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  deletedFrom: [
    {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  ],
  isDeleted: {
    type: Boolean,
    default: false,
  },
});

const Message = mongoose.model("Message", messageSchema);

module.exports = Message;
