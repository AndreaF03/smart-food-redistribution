const express = require("express");
const router = express.Router();

const { createFood, getNearbyFood } = require("../controllers/foodController");
const { protect } = require("../middleware/authMiddleware");

router.post("/", protect, createFood);
router.get("/nearby", protect, getNearbyFood);

module.exports = router;