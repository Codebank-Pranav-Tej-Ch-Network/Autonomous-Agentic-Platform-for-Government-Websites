const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
    },
    phoneno: {
      type: Number,
      required : true,
    },
    gender: {
        type :String,
        required : true,
    },
    address: {
        type:String,
        required : true,
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", UserSchema);