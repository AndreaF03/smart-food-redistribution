const express = require("express");
const router = express.Router();

const { createFood, getNearbyFood, reserveFood } = require("../controllers/foodController");
const { protect } = require("../middleware/authMiddleware");

router.post("/", protect, createFood);
router.get("/nearby", protect, getNearbyFood);
router.put("/reserve/:id", protect, reserveFood);
module.exports = router;