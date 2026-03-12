const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");
const { ipKeyGenerator } = require("express-rate-limit");

const upload = require("../middleware/uploadMiddleware");

const {
  createFood,
  getNearbyFood,
  reserveFood,
  markPicked,
  markDelivered,
  getNGODashboard,
  getRestaurantDashboard,
  getAdminAnalytics,
  deleteFood
} = require("../controllers/foodController");

const { protect, authorizeRoles } = require("../middleware/authMiddleware");


/* =====================================
   Rate limiter for food creation
===================================== */
const createLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  keyGenerator: (req) => req.user?.id || ipKeyGenerator(req),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Too many food listings created, please try again later"
  }
});


/* =====================================
   Action limiter (reserve/pick/deliver)
===================================== */
const actionLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 20,
  keyGenerator: (req) => req.user?.id || ipKeyGenerator(req),
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many actions, please slow down" }
});


/* =====================================
   Read limiter (analytics/dashboard)
===================================== */
const readLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 30,
  keyGenerator: (req) => req.user?.id || ipKeyGenerator(req),
  standardHeaders: true,
  legacyHeaders: false
});


/* =====================================
   Multer Upload Error Handler
===================================== */
const handleUpload = (req, res, next) => {
  upload.single("image")(req, res, (err) => {

    if (err) {
      return res.status(400).json({
        message:
          err.code === "LIMIT_FILE_SIZE"
            ? "Image must be under 5MB"
            : err.message
      });
    }

    next();
  });
};


/* =====================================
   Create Food (Restaurant only)
===================================== */
router.post(
  "/",
  protect,
  authorizeRoles("restaurant"),
  createLimiter,
  handleUpload,
  createFood
);


/* =====================================
   Static routes FIRST
===================================== */

router.get(
  "/nearby",
  protect,
  authorizeRoles("ngo"),
  readLimiter,
  getNearbyFood
);

router.get(
  "/ngo/dashboard",
  protect,
  authorizeRoles("ngo"),
  readLimiter,
  getNGODashboard
);

router.get(
  "/restaurant/dashboard",
  protect,
  authorizeRoles("restaurant"),
  readLimiter,
  getRestaurantDashboard
);

router.get(
  "/admin/analytics",
  protect,
  authorizeRoles("admin"),
  readLimiter,
  getAdminAnalytics
);


/* =====================================
   Food Actions
===================================== */

router.patch(
  "/reserve/:id",
  protect,
  authorizeRoles("ngo"),
  actionLimiter,
  reserveFood
);

router.patch(
  "/pick/:id",
  protect,
  authorizeRoles("restaurant"),
  actionLimiter,
  markPicked
);

router.patch(
  "/deliver/:id",
  protect,
  authorizeRoles("ngo"),
  actionLimiter,
  markDelivered
);


/* =====================================
   Delete Food Listing
===================================== */
router.delete(
  "/:id",
  protect,
  authorizeRoles("restaurant"),
  deleteFood
);

module.exports = router;