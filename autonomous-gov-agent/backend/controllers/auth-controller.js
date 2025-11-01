const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

//register controller
//register controller
const registerUser = async (req, res) => {
  try {
    //extract user information from request body
    const { username, email, password, phoneno, gender, address } = req.body;

    //check if the user already exists in the database
    const checkExistingUser = await User.findOne({ email });

    if (checkExistingUser) {
      return res.status(400).json({
        success: false,
        message: "User with this email already exists. Please try another email.",
      });
    }

    //hash user password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    //create a new user and save in your database
    const newlyCreatedUser = new User({
      username,
      email,
      password: hashedPassword,
      phoneno,
      gender,
      address
    });

    await newlyCreatedUser.save();

    // ✅ Generate JWT token after registration
    const accessToken = jwt.sign(
      {
        userId: newlyCreatedUser._id,
        username: newlyCreatedUser.username,
      },
      process.env.JWT_SECRET_KEY,
      { expiresIn: "1d" }
    );

    // ✅ Send token in response
    res.status(201).json({
      success: true,
      message: "User registered successfully!",
      accessToken, // send token
      user: {
        id: newlyCreatedUser._id,
        username: newlyCreatedUser.username,
        email: newlyCreatedUser.email
      }
    });

  } catch (e) {
    console.log(e);
    res.status(500).json({
      success: false,
      message: "Some error occurred! Please try again",
    });
  }
};


//login controller

const loginUser = async (req, res) => {
  try {
    const { username, password } = req.body;

    //find if the current user is exists in database or not
    const user = await User.findOne({ username });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: `User doesn't exists`,
      });
    }
    //if the password is correct or not
    const isPasswordMatch = await bcrypt.compare(password, user.password);

    if (!isPasswordMatch) {
      return res.status(400).json({
        success: false,
        message: "Invalid credentials!",
      });
    }

    //create user token
    const accessToken = jwt.sign(
      {
        userId: user._id,
        username: user.username,
      },
      process.env.JWT_SECRET_KEY,
      {
        expiresIn: "1d",
      }
    );

    res.status(200).json({
      success: true,
      message: "Logged in successful",
      accessToken,
    });
  } catch (e) {
    console.log(e);
    res.status(500).json({
      success: false,
      message: "Some error occured! Please try again",
    });
  }
};

const changePassword = async (req, res) => {
  try {
    const userId = req.userInfo.userId;

    //extract old and new password;
    const { oldPassword, newPassword } = req.body;

    //find the current logged in user
    const user = await User.findById(userId);

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "User not found",
      });
    }

    //check if the old password is correct
    const isPasswordMatch = await bcrypt.compare(oldPassword, user.password);

    if (!isPasswordMatch) {
      return res.status(400).json({
        success: false,
        message: "Old password is not correct! Please try again.",
      });
    }

    //hash the new password here
    const salt = await bcrypt.genSalt(10);
    const newHashedPassword = await bcrypt.hash(newPassword, salt);

    //update user password
    user.password = newHashedPassword;
    await user.save();

    res.status(200).json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (e) {
    console.log(e);
    res.status(500).json({
      success: false,
      message: "Some error occured! Please try again",
    });
  }
};

module.exports = { registerUser, loginUser, changePassword };