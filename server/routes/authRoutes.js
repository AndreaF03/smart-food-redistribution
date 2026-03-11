const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");

const { register, login } = require("../controllers/authController");



// Rate limiter — max 10 attempts per 15 minutes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    message: "Too many attempts from this IP, please try again later"
  }
});

router.post("/register", authLimiter, register);
router.post("/login", authLimiter, login);

module.exports = router;