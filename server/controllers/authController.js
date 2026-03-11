const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

/* ======================
   REGISTER USER
====================== */

exports.register = async (req, res) => {
  try {
    const { name, email, password, location, role } = req.body;

    // Input validation
    if (!name || !email || !password || !location) {
      return res.status(400).json({
        message: "All fields are required"
      });
    }

    // Validate location structure
    if (
      !location.coordinates ||
      !Array.isArray(location.coordinates) ||
      location.coordinates.length !== 2
    ) {
      return res.status(400).json({
        message: "Invalid location format. Expected { type: 'Point', coordinates: [lng, lat] }"
      });
    }

    const userExists = await User.findOne({ email });

    if (userExists) {
      return res.status(400).json({
        message: "User already exists"
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Only allow restaurant or ngo — never admin from client
    const allowedRoles = ["restaurant", "ngo"];
    const assignedRole = allowedRoles.includes(role) ? role : "ngo";

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      location,
      role: assignedRole
    });

    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET is not defined in environment variables");
    }

    const token = jwt.sign(
      {
        id: user._id,
        role: user.role
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "1d"
      }
    );

    res.status(201).json({
      message: "User registered successfully",
      token,
      role: user.role
    });

  } catch (error) {
    console.error("REGISTER ERROR:", error);
    res.status(500).json({
      message: error.message
    });
  }
};


/* ======================
   LOGIN USER
====================== */

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Input validation
    if (!email || !password) {
      return res.status(400).json({
        message: "All fields are required"
      });
    }

    const user = await User.findOne({ email }).select("+password");

    // Use same message for both "not found" and "wrong password"
    // to prevent email enumeration
    if (!user) {
      return res.status(401).json({
        message: "Invalid email or password"
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({
        message: "Invalid email or password"
      });
    }

    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET is not defined in environment variables");
    }

    const token = jwt.sign(
      {
        id: user._id,
        role: user.role
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "1d"
      }
    );

    res.status(200).json({
      token,
      role: user.role
    });

  } catch (error) {
    console.error("LOGIN ERROR:", error);
    res.status(500).json({
      message: error.message
    });
  }
};