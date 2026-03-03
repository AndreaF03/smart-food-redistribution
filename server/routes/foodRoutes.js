const express = require("express");
const router = express.Router();
const { 
  createFood, 
  getNearbyFood, 
  reserveFood,
  markPicked,
  markDelivered,
  getNGODashboard,
  getRestaurantDashboard,
getAdminAnalytics
} = require("../controllers/foodController");
const { protect } = require("../middleware/authMiddleware");

router.post("/", protect, createFood);
router.get("/nearby", protect, getNearbyFood);
router.put("/reserve/:id", protect, reserveFood);
router.put("/pick/:id", protect, markPicked);
router.put("/deliver/:id", protect, markDelivered);
router.get("/ngo/dashboard", protect, getNGODashboard);
router.get("/restaurant/dashboard", protect, getRestaurantDashboard);
router.get("/admin/analytics", protect, getAdminAnalytics);
module.exports = router;