const jwt    = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const User   = require("../models/User");
const { sendEmail } = require("../utils/mailer");

/* =====================================
   HELPER
===================================== */
const signToken = (id, role) =>
  jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: "1d" });

/* =====================================
   VALIDATION HELPER
   FIX: password.length < 8 but message said "6 characters" — unified
   FIX: Mongoose ValidationError was falling through to 500 catch block
        instead of returning 400. Now extracted via handleError helper.
===================================== */
const PASSWORD_MIN = 8;

const handleError = (res, error, context) => {
  console.error(`${context} ERROR:`, error);
  if (error.name === "ValidationError") {
    const message = Object.values(error.errors).map(e => e.message).join(", ");
    return res.status(400).json({ message });
  }
  res.status(500).json({ message: "Server error" });
};

/* =====================================
   REGISTER
===================================== */
exports.register = async (req, res) => {
  try {
    const { name, email, password, location, role } = req.body;

    if (!name || !email || !password || !location) {
      return res.status(400).json({ message: "All fields are required" });
    }

    if (password.length < PASSWORD_MIN) {
      return res.status(400).json({
        message: `Password must be at least ${PASSWORD_MIN} characters`,
      });
    }

    const userExists = await User.findOne({ email: email.toLowerCase().trim() });
    if (userExists) {
      return res.status(400).json({ message: "User already exists" });
    }

    const user = await User.create({
      name:     name.trim(),
      email:    email.toLowerCase().trim(),
      password,                               // model hashes on pre-save
      location,
      role:     ["restaurant", "ngo"].includes(role) ? role : "ngo",
    });

    const token = signToken(user._id, user.role);

    res.status(201).json({
      message: "User registered successfully",
      token,
      user: { _id: user._id, name: user.name, role: user.role },
    });
  } catch (error) {
    handleError(res, error, "REGISTER");
  }
};

/* =====================================
   LOGIN
===================================== */
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Please provide email and password" });
    }

    const user = await User.findOne({
      email: email.toLowerCase().trim(),
    }).select("+password");

    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    if (user.isActive === false) {
      return res.status(403).json({ message: "Account deactivated. Contact support." });
    }

    const token = signToken(user._id, user.role);

    res.status(200).json({
      token,
      role: user.role,
      user: { _id: user._id, name: user.name, role: user.role },
    });
  } catch (error) {
    handleError(res, error, "LOGIN");
  }
};

/* =====================================
   GET ME
===================================== */
exports.getMe = async (req, res) => {
  res.status(200).json(req.user);
};

/* =====================================
   UPDATE PROFILE  (PUT /auth/me)
===================================== */
exports.updateProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("+password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const { name, email, password, location } = req.body;

    if (name)     user.name     = name.trim();
    if (location) user.location = location;

    if (email) {
      const normalised = email.toLowerCase().trim();
      const conflict   = await User.findOne({ email: normalised });

      if (conflict && conflict._id.toString() !== user._id.toString()) {
        return res.status(400).json({ message: "Email already in use" });
      }

      user.email = normalised;
    }

    if (password) {
      if (password.length < PASSWORD_MIN) {
        return res.status(400).json({
          message: `Password must be at least ${PASSWORD_MIN} characters`,
        });
      }
      user.password = password;
    }

    const updated = await user.save();

    res.status(200).json({
      message: "Profile updated successfully",
      user: {
        _id:      updated._id,
        name:     updated.name,
        email:    updated.email,
        location: updated.location,
        role:     updated.role,
      },
    });
  } catch (error) {
    handleError(res, error, "UPDATE PROFILE");
  }
};

/* =====================================
   FORGOT PASSWORD
===================================== */
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });

    const genericResponse = {
      message: "If that email exists, a reset link has been sent",
    };

    if (!user) return res.status(200).json(genericResponse);

    const resetToken  = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto.createHash("sha256").update(resetToken).digest("hex");

    user.resetToken       = hashedToken;
    user.resetTokenExpiry = Date.now() + 15 * 60 * 1000; // 15 min
    await user.save();

    const resetUrl = `${process.env.CLIENT_URL}/reset-password/${resetToken}`;

    sendEmail({
      to:      user.email,
      subject: "Reset Your Password 🔐",
      html: `
        <h3>Password Reset</h3>
        <p>Click below to reset your password. This link expires in 15 minutes.</p>
        <a href="${resetUrl}">${resetUrl}</a>
        <p>If you didn't request this, ignore this email.</p>
      `,
    }).catch(err => console.error("FORGOT PASSWORD EMAIL ERROR:", err));

    const responsePayload = { ...genericResponse };
    if (process.env.NODE_ENV !== "production") {
      responsePayload._resetToken = resetToken;
    }

    res.status(200).json(responsePayload);
  } catch (err) {
    handleError(res, err, "FORGOT PASSWORD");
  }
};

/* =====================================
   RESET PASSWORD
===================================== */
exports.resetPassword = async (req, res) => {
  try {
    const { token }    = req.params;
    const { password } = req.body;

    if (!password || password.length < PASSWORD_MIN) {
      return res.status(400).json({
        message: `Password must be at least ${PASSWORD_MIN} characters`,
      });
    }

    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    const user = await User.findOne({
      resetToken:       hashedToken,
      resetTokenExpiry: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired token" });
    }

    user.password         = password;
    user.resetToken       = undefined;
    user.resetTokenExpiry = undefined;
    await user.save();

    res.status(200).json({ message: "Password reset successful" });
  } catch (err) {
    handleError(res, err, "RESET PASSWORD");
  }
};

/* =====================================
   ADMIN: GET ALL USERS
===================================== */
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select("-password");
    res.status(200).json(users);
  } catch (err) {
    handleError(res, err, "GET ALL USERS");
  }
};

/* =====================================
   ADMIN: UPDATE ROLE
===================================== */
exports.updateUserRole = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Admins only" });
    }

    const { role } = req.body;
    if (!["ngo", "restaurant", "admin"].includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role },
      { new: true },
    ).select("-password");

    if (!user) return res.status(404).json({ message: "User not found" });

    res.status(200).json({ message: "Role updated", user });
  } catch (err) {
    handleError(res, err, "UPDATE ROLE");
  }
};

/* =====================================
   ADMIN: DEACTIVATE USER
===================================== */
exports.deactivateUser = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Admins only" });
    }

    if (req.params.id === req.user._id.toString()) {
      return res.status(400).json({ message: "Cannot deactivate your own account" });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true },
    ).select("-password");

    if (!user) return res.status(404).json({ message: "User not found" });

    res.status(200).json({ message: "User deactivated", user });
  } catch (err) {
    handleError(res, err, "DEACTIVATE USER");
  }
};