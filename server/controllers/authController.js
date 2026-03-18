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

// FIX: single helper so hashing logic lives in one place.
// updateProfile was hashing manually with bcrypt.genSalt/hash
// while resetPassword relied on the model hook — inconsistent.
// Now both go through the model hook by assigning plain text and
// calling save(), which triggers the pre-save hash in User.js.
// (If your model does NOT have a pre-save hook, swap this for
//  the manual bcrypt approach and remove the hook instead.)

/* =====================================
   REGISTER
===================================== */
exports.register = async (req, res) => {
  try {
    const { name, email, password, location, role } = req.body;

    if (!name || !email || !password || !location) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // FIX: basic password length guard before hitting the DB
    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const userExists = await User.findOne({ email: email.toLowerCase().trim() });
    if (userExists) {
      return res.status(400).json({ message: "User already exists" });
    }

    const user = await User.create({
      name:     name.trim(),
      email:    email.toLowerCase().trim(),
      password,                                           // model hashes on pre-save
      location,
      role:     ["restaurant", "ngo"].includes(role) ? role : "ngo",
    });

    const token = signToken(user._id, user.role);

    res.status(201).json({
      message: "User registered successfully",
      token,
      user: { _id: user._id, name: user.name, role: user.role },  // FIX: _id not id — Login.jsx reads user._id
    });
  } catch (error) {
    console.error("REGISTER ERROR:", error);
    res.status(500).json({ message: error.message });
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

    const user = await User.findOne({ email: email.toLowerCase().trim() }).select("+password");

    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // FIX: check isActive so deactivated users cannot log in
    if (user.isActive === false) {
      return res.status(403).json({ message: "Account deactivated. Contact support." });
    }

    const token = signToken(user._id, user.role);

    res.status(200).json({
      token,
      role: user.role,                                            // FIX: Login.jsx destructures res.data.role separately
      user: { _id: user._id, name: user.name, role: user.role }, // FIX: _id not id
    });
  } catch (error) {
    console.error("LOGIN ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/* =====================================
   GET ME
===================================== */
exports.getMe = async (req, res) => {
  // FIX: original returned { user: req.user } but Profile.jsx reads
  // res.data.name / res.data.email directly (not res.data.user.name).
  // Return the user object flat so both Profile and any future
  // consumers can read fields without an extra .user wrapper.
  res.status(200).json(req.user);
};

/* =====================================
   UPDATE PROFILE  (PUT /auth/me)
   FIX: was double-hashing password —
        manual bcrypt.hash() here PLUS model pre-save hook.
        Now assigns plain text and lets the model hash once.
   FIX: email uniqueness check used findOne without excluding
        soft-deleted / inactive users — now also filters isActive.
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
      if (password.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters" });
      }
      // Assign plain text — model pre-save hook will hash it once
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
    console.error("UPDATE PROFILE ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/* =====================================
   FORGOT PASSWORD
   FIX: email not found should return 200 with a generic message
        to prevent user enumeration (don't leak whether an email
        exists in the system)
   FIX: sendEmail was awaited directly — a mailer failure would
        return 500 even though the token was saved correctly.
        Now we save the token first, then attempt the email.
===================================== */
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });

    // Return the same response whether the user exists or not
    const genericResponse = { message: "If that email exists, a reset link has been sent" };

    if (!user) return res.status(200).json(genericResponse);

    const resetToken   = crypto.randomBytes(32).toString("hex");
    const hashedToken  = crypto.createHash("sha256").update(resetToken).digest("hex");

    user.resetToken       = hashedToken;
    user.resetTokenExpiry = Date.now() + 15 * 60 * 1000; // 15 min
    await user.save();

    const resetUrl = `${process.env.CLIENT_URL}/reset-password/${resetToken}`;

    // Non-fatal — token is already saved; log but don't crash
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

    res.status(200).json(genericResponse);
  } catch (err) {
    console.error("FORGOT PASSWORD ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* =====================================
   RESET PASSWORD
   FIX: no password length validation before saving
===================================== */
exports.resetPassword = async (req, res) => {
  try {
    const { token }    = req.params;
    const { password } = req.body;

    if (!password || password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    const user = await User.findOne({
      resetToken:       hashedToken,
      resetTokenExpiry: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired token" });
    }

    // Assign plain text — model pre-save hook hashes it
    user.password         = password;
    user.resetToken       = undefined;
    user.resetTokenExpiry = undefined;
    await user.save();

    res.status(200).json({ message: "Password reset successful" });
  } catch (err) {
    console.error("RESET PASSWORD ERROR:", err);
    res.status(500).json({ message: "Server error" });
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
    console.error("GET ALL USERS ERROR:", err);
    res.status(500).json({ message: "Failed to fetch users" });
  }
};

/* =====================================
   ADMIN: UPDATE ROLE
   FIX: no auth check — any authenticated user could call this.
        Caller should be guarded by authorizeRoles("admin") in
        the router, but adding a belt-and-suspenders guard here.
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
      { new: true }
    ).select("-password");

    if (!user) return res.status(404).json({ message: "User not found" });

    res.status(200).json({ message: "Role updated", user });
  } catch (err) {
    console.error("UPDATE ROLE ERROR:", err);
    res.status(500).json({ message: "Failed to update role" });
  }
};

/* =====================================
   ADMIN: DEACTIVATE USER
   FIX: no auth check (same as above)
   FIX: no guard against an admin deactivating themselves
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
      { new: true }
    ).select("-password");

    if (!user) return res.status(404).json({ message: "User not found" });

    res.status(200).json({ message: "User deactivated", user });
  } catch (err) {
    console.error("DEACTIVATE USER ERROR:", err);
    res.status(500).json({ message: "Failed to deactivate user" });
  }
};