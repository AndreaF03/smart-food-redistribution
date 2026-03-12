const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

/* ======================
   REGISTER USER
====================== */

exports.register = async (req, res) => {
  try {

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ message: "Server configuration error" });
    }

    const name = req.body.name?.trim();
    const email = req.body.email?.trim().toLowerCase();
    const password = req.body.password;
    const location = req.body.location;
    const role = req.body.role;

    // Input validation
    if (!name || !email || !password || !location) {
      return res.status(400).json({
        message: "All fields are required"
      });
    }

    // Password validation BEFORE hashing
    if (password.length < 8) {
      return res.status(400).json({
        message: "Password must be at least 8 characters"
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

    // Validate coordinate range
    const [lng, lat] = location.coordinates;

    if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
      return res.status(400).json({
        message: "Invalid coordinates. Longitude must be -180 to 180, latitude -90 to 90"
      });
    }

    const userExists = await User.findOne({ email });

    if (userExists) {
      return res.status(400).json({
        message: "User already exists"
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

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
      role: user.role,
      user: {
        _id: user._id,
        name: user.name,
        role: user.role
      }
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

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ message: "Server configuration error" });
    }

    const email = req.body.email?.trim().toLowerCase();
    const password = req.body.password;

    // Input validation
    if (!email || !password) {
      return res.status(400).json({
        message: "All fields are required"
      });
    }

    const user = await User.findOne({ email }).select("+password");

    // Prevent email enumeration
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
      role: user.role,
      user: {
        _id: user._id,
        name: user.name,
        role: user.role
      }
    });

  } catch (error) {
    console.error("LOGIN ERROR:", error);
    res.status(500).json({
      message: error.message
    });
  }
};
exports.getMe = async (req, res) => {
  try {

    res.status(200).json({
      user: req.user
    });

  } catch (error) {
    console.error("GET ME ERROR:", error);

    res.status(500).json({
      message: "Server error"
    });
  }
};