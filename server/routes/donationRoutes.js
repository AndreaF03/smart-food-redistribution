const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");

const {
  createDonation,
  getDonations,
  getMyDonations,
  deleteDonation
} = require("../controllers/donationController");

const { protect, authorizeRoles } = require("../middleware/authMiddleware");
const upload = require("../middleware/uploadMiddleware");

/* =====================================
   Rate limiter
===================================== */
const createLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30,
  // FIX: Explicitly handle the fallback to avoid the IPv6 warning
  keyGenerator: (req) => {
    return req.user ? req.user.id : req.ip;
  },
  validate: { 
    xForwardedForHeader: false, // Set to true if you are behind a proxy like Nginx/Heroku
    keyGeneratorIpFallback: false // This tells the library you know what you're doing with the IP
  },
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Too many donations created, please try again later"
  }
});

/* =====================================
   Upload Error Handler Middleware
===================================== */
const handleUpload = (req, res, next) => {
  upload.single("image")(req, res, (err) => {
    if (err) {
      return res.status(400).json({
        message: err.code === "LIMIT_FILE_SIZE" 
          ? "Image must be under 5MB" 
          : err.message
      });
    }
    next();
  });
};

/* =====================================
   Routes
===================================== */

// Create Donation (Restaurant only)
router.post(
  "/",
  protect,
  authorizeRoles("restaurant"),
  createLimiter,
  handleUpload,
  createDonation
);

// Get All Available Donations 
// Added 'restaurant' so they can see the public feed too
router.get(
  "/",
  protect,
  authorizeRoles("ngo", "admin", "restaurant"), 
  getDonations
);

// Get My Donations (Restaurant only)
router.get(
  "/my",
  protect,
  authorizeRoles("restaurant"),
  getMyDonations
);

// Delete Donation (Owner Restaurant only)
router.delete(
  "/:id",
  protect,
  authorizeRoles("restaurant"),
  deleteDonation
);

module.exports = router;