const jwt = require("jsonwebtoken");
const User = require("../models/User");

// Helper to generate Token
const signToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, {
    expiresIn: "1d",
  });
};

/* ======================
    REGISTER USER
====================== */
exports.register = async (req, res) => {
  try {
    const { name, email, password, location, role } = req.body;

    // 1. Basic validation
    if (!name || !email || !password || !location) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // 2. Check if user exists
    const userExists = await User.findOne({ email: email.toLowerCase().trim() });
    if (userExists) {
      return res.status(400).json({ message: "User already exists" });
    }

    // 3. Create User 
    // NOTE: Hashing should happen in the User Model, not here, to avoid double-hashing
    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password, // Send plain text; Model will hash it
      location, 
      role: ["restaurant", "ngo"].includes(role) ? role : "ngo"
    });

    const token = signToken(user._id, user.role);

    res.status(201).json({
      message: "User registered successfully",
      token,
      user: { id: user._id, name: user.name, role: user.role }
    });
  } catch (error) {
    console.error("REGISTER ERROR:", error);
    res.status(500).json({ message: error.message });
  }
};

/* ======================
    LOGIN USER
====================== */
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Please provide email and password" });
    }

    // Select password explicitly because it's usually hidden in the schema
    const user = await User.findOne({ email: email.toLowerCase().trim() }).select("+password");

    // Use a method on the User model to compare passwords
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const token = signToken(user._id, user.role);

    res.status(200).json({
      token,
      user: { id: user._id, name: user.name, role: user.role }
    });
  } catch (error) {
    console.error("LOGIN ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

exports.getMe = async (req, res) => {
  res.status(200).json({ user: req.user });
};