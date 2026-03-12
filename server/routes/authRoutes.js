const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");

const { register, login, getMe } = require("../controllers/authController");
const { protect } = require("../middleware/authMiddleware");


const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many login attempts, please try again later" }
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many accounts created from this IP, please try again later" }
});

router.post("/register", registerLimiter, register);
router.post("/login", loginLimiter, login);

router.get("/me", protect, getMe);

module.exports = router;