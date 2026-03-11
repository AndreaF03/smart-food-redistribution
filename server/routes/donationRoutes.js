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




// Rate limiter for donation creation
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