const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");
const upload = require("../middleware/uploadMiddleware");
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

const { protect, authorizeRoles } = require("../middleware/authMiddleware");

/* =====================================
   Rate limiter for food creation
===================================== */
const createLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: {
    message: "Too many food listings created from this IP, please try again later"
  }
});

/* =====================================
   Create Food (Restaurant only)
===================================== */
router.post(
  "/",
  createLimiter,
  protect,
  authorizeRoles("restaurant"),
  upload.single("image"),
  createFood
);

/* =====================================
   Get Nearby Food (NGO only)
===================================== */
router.get(
  "/nearby",
  protect,
  authorizeRoles("ngo"),
  getNearbyFood
);

/* =====================================
   Reserve Food (NGO only)
===================================== */
router.patch(
  "/reserve/:id",
  protect,
  authorizeRoles("ngo"),
  reserveFood
);

/* =====================================
   Confirm Pickup (Restaurant only)
   Restaurant confirms NGO picked food
===================================== */
router.patch(
  "/pick/:id",
  protect,
  authorizeRoles("restaurant"),
  markPicked
);

/* =====================================
   Mark Delivered (NGO only)
===================================== */
router.patch(
  "/deliver/:id",
  protect,
  authorizeRoles("ngo"),
  markDelivered
);

/* =====================================
   NGO Dashboard (NGO only)
===================================== */
router.get(
  "/ngo/dashboard",
  protect,
  authorizeRoles("ngo"),
  getNGODashboard
);

/* =====================================
   Restaurant Dashboard (Restaurant only)
===================================== */
router.get(
  "/restaurant/dashboard",
  protect,
  authorizeRoles("restaurant"),
  getRestaurantDashboard
);

/* =====================================
   Admin Analytics (Admin only)
===================================== */
router.get(
  "/admin/analytics",
  protect,
  authorizeRoles("admin"),
  getAdminAnalytics
);

module.exports = router;