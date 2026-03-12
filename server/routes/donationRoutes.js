const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");
const multer = require("multer");

const {
  createDonation,
  getDonations,
  getMyDonations,
  deleteDonation
} = require("../controllers/donationController");

const { protect, authorizeRoles } = require("../middleware/authMiddleware");

/* =====================================
   Multer Config (Image Upload)
===================================== */

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  }
});

const upload = multer({ storage });

/* =====================================
   Rate limiter
===================================== */

const createLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: {
    message: "Too many donations created from this IP, please try again later"
  }
});

/* =====================================
   Create Donation (Restaurant only)
===================================== */

router.post(
  "/",
  createLimiter,
  protect,
  authorizeRoles("restaurant"),
  upload.single("image"), // ✅ IMPORTANT FIX
  createDonation
);

/* =====================================
   Get All Donations (NGO + Admin)
===================================== */

router.get(
  "/",
  protect,
  authorizeRoles("ngo", "admin"),
  getDonations
);

/* =====================================
   Get My Donations (Restaurant only)
===================================== */

router.get(
  "/my",
  protect,
  authorizeRoles("restaurant"),
  getMyDonations
);

/* =====================================
   Delete Donation (Restaurant only)
===================================== */

router.delete(
  "/:id",
  protect,
  authorizeRoles("restaurant"),
  deleteDonation
);

module.exports = router;