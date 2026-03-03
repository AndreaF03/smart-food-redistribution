const express = require("express");
const router = express.Router();
const { 
  createFood, 
  getNearbyFood, 
  reserveFood,
  markPicked,
  markDelivered
} = require("../controllers/foodController");
const { protect } = require("../middleware/authMiddleware");

router.post("/", protect, createFood);
router.get("/nearby", protect, getNearbyFood);
router.put("/reserve/:id", protect, reserveFood);
router.put("/pick/:id", protect, markPicked);
router.put("/deliver/:id", protect, markDelivered);
module.exports = router;