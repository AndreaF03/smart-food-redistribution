const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");
const { ipKeyGenerator } = require("express-rate-limit");

const {
  submitRating,
  getNGORatings,
  getMyRatings,
  deleteRating,
  getNGOLeaderboard
} = require("../controllers/ratingController");

const { protect, authorizeRoles } = require("../middleware/authMiddleware");


/* =====================================
   Rate limiter for rating submissions
===================================== */

const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  keyGenerator: (req) => req.user?.id || ipKeyGenerator(req),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Too many rating submissions, please slow down"
  }
});


/* =====================================
   Rate limiter for reading ratings
===================================== */

const readLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 30,
  keyGenerator: (req) => req.user?.id || ipKeyGenerator(req),
  standardHeaders: true,
  legacyHeaders: false
});


/* =====================================
   Submit Rating (Restaurant only)
===================================== */

router.post(
  "/",
  protect,
  authorizeRoles("restaurant"),
  rateLimiter,
  submitRating
);


/* =====================================
   Static routes FIRST
===================================== */

router.get(
  "/my",
  protect,
  authorizeRoles("restaurant"),
  readLimiter,
  getMyRatings
);
router.get(
  "/leaderboard",
  protect,
  authorizeRoles("admin"),
  readLimiter,
  getNGOLeaderboard
);


/* =====================================
   Dynamic routes LAST
===================================== */

router.get(
  "/ngo/:ngoId",
  protect,
  readLimiter,
  getNGORatings
);


/* =====================================
   Delete Rating (Restaurant only)
===================================== */

router.delete(
  "/:id",
  protect,
  authorizeRoles("restaurant"),
  deleteRating
);


module.exports = router;