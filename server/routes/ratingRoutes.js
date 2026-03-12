const express = require("express");
const router  = express.Router();

const {
  submitRating,
  getNGORatings,
  getMyRatings
} = require("../controllers/ratingController");

const { protect, authorizeRoles } = require("../middleware/authMiddleware");

// Submit a rating — restaurant only
router.post(
  "/",
  protect,
  authorizeRoles("restaurant"),
  submitRating
);

// Get all ratings for a specific NGO
router.get(
  "/ngo/:ngoId",
  protect,
  getNGORatings
);

// Get all ratings this restaurant has submitted
router.get(
  "/my",
  protect,
  authorizeRoles("restaurant"),
  getMyRatings
);

module.exports = router;