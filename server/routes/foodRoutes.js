const express = require("express");
const router = express.Router();
const { createFood } = require("../controllers/foodController");
const { protect } = require("../middleware/authMiddleware");

router.post("/", protect, createFood);

module.exports = router;