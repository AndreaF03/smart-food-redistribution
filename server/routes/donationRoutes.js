const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");
const { ipKeyGenerator } = require("express-rate-limit");

const {
  createDonation,
  getDonations,
  getMyDonations,
  deleteDonation
} = require("../controllers/donationController");

const { protect, authorizeRoles } = require("../middleware/authMiddleware");
const upload = require("../middleware/uploadMiddleware");


/* =====================================
   Rate limiter (per authenticated user)
===================================== */

const createLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30,
  keyGenerator: (req) => req.user?.id || ipKeyGenerator(req),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Too many donations created, please try again later"
  }
});


/* =====================================
   Upload Error Handler
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
   Create Donation (Restaurant only)
===================================== */

router.post(
  "/",
  protect,
  authorizeRoles("restaurant"),
  createLimiter,
  handleUpload,
  createDonation
);


/* =====================================
   Get All Available Donations
   (NGO + Admin)
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