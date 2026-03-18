const mongoose = require("mongoose");
const Rating   = require("../models/Rating");
const Food     = require("../models/Food");
const User     = require("../models/User"); // FIX: moved to top-level — was require()'d
                                             // inside getNGOLeaderboard on every call

/* =====================================
   SUBMIT RATING (Restaurant Only)
   FIX: req.user.id → req.user._id throughout
        (authMiddleware attaches the Mongoose doc whose
         id field is ._id — using .id works via the
         virtual, but ._id is explicit and consistent
         with the rest of the codebase)
===================================== */
exports.submitRating = async (req, res) => {
  try {
    if (req.user.role !== "restaurant") {
      return res.status(403).json({ message: "Only restaurants can rate NGOs" });
    }

    const { foodId, rating, comment } = req.body;

    if (!foodId || rating === undefined) {
      return res.status(400).json({ message: "foodId and rating are required" });
    }

    if (!mongoose.Types.ObjectId.isValid(foodId)) {
      return res.status(400).json({ message: "Invalid food ID" });
    }

    const parsedRating = Number(rating);
    if (!Number.isInteger(parsedRating) || parsedRating < 1 || parsedRating > 5) {
      return res.status(400).json({ message: "Rating must be a whole number between 1 and 5" });
    }

    const food = await Food.findById(foodId).populate("reservedBy", "_id name");

    if (!food) {
      return res.status(404).json({ message: "Food listing not found" });
    }

    // FIX: .id virtual vs ._id — use ._id.toString() for explicit comparison
    if (food.restaurant.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "You can only rate NGOs for your own donations" });
    }

    if (food.status !== "delivered") {
      return res.status(400).json({ message: "You can only rate after food is delivered" });
    }

    if (!food.reservedBy) {
      return res.status(400).json({ message: "No NGO found for this delivery" });
    }

    const existing = await Rating.findOne({
      restaurant: req.user._id,  // FIX: ._id
      food:       foodId,
    });

    if (existing) {
      return res.status(400).json({ message: "You have already rated this delivery" });
    }

    const newRating = await Rating.create({
      restaurant: req.user._id,  // FIX: ._id
      ngo:        food.reservedBy._id,
      food:       foodId,
      rating:     parsedRating,
      ...(comment?.trim() && { comment: comment.trim() }),
    });

    await newRating.populate("ngo", "name");

    res.status(201).json({ message: "Rating submitted successfully", rating: newRating });

  } catch (error) {
    console.error("SUBMIT RATING ERROR:", error);
    res.status(500).json({ message: error.message });
  }
};

/* =====================================
   GET NGO RATINGS SUMMARY
===================================== */
exports.getNGORatings = async (req, res) => {
  try {
    const { ngoId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(ngoId)) {
      return res.status(400).json({ message: "Invalid NGO ID" });
    }

    const [summary] = await Rating.aggregate([
      { $match: { ngo: new mongoose.Types.ObjectId(ngoId) } },
      {
        $group: {
          _id:          null,
          average:      { $avg: "$rating" },
          totalRatings: { $sum: 1 },
        },
      },
    ]);

    const ratings = await Rating.find({ ngo: ngoId })
      .populate("restaurant", "name")
      .populate("food", "foodType")
      .sort({ createdAt: -1 })
      .limit(20);

    res.status(200).json({
      ngoId,
      average:      summary ? parseFloat(summary.average.toFixed(1)) : null,
      totalRatings: summary?.totalRatings || 0,
      ratings,
    });

  } catch (error) {
    console.error("GET NGO RATINGS ERROR:", error);
    res.status(500).json({ message: error.message });
  }
};

/* =====================================
   GET MY RATINGS (Restaurant)
===================================== */
exports.getMyRatings = async (req, res) => {
  try {
    if (req.user.role !== "restaurant") {
      return res.status(403).json({ message: "Only restaurants can access this" });
    }

    const ratings = await Rating.find({ restaurant: req.user._id }) // FIX: ._id
      .populate("ngo",  "name")
      .populate("food", "foodType")
      .sort({ createdAt: -1 });

    const ratedFoodIds = ratings
      .map(r => r.food?._id?.toString())
      .filter(Boolean);

    res.status(200).json({ ratings, ratedFoodIds });

  } catch (error) {
    console.error("GET MY RATINGS ERROR:", error);
    res.status(500).json({ message: error.message });
  }
};

/* =====================================
   DELETE RATING
   FIX: entire function was missing try/catch —
        any DB error would crash with an unhandled
        exception instead of returning a 500
   FIX: req.user.id → req.user._id
===================================== */
exports.deleteRating = async (req, res) => {
  try {
    const rating = await Rating.findById(req.params.id);

    if (!rating) {
      return res.status(404).json({ message: "Rating not found" });
    }

    if (rating.restaurant.toString() !== req.user._id.toString()) { // FIX: ._id
      return res.status(403).json({ message: "Not authorized" });
    }

    const hoursSince = (Date.now() - rating.createdAt) / (1000 * 60 * 60);
    if (hoursSince > 24) {
      return res.status(400).json({ message: "Ratings can only be deleted within 24 hours" });
    }

    await rating.deleteOne();
    res.status(200).json({ message: "Rating deleted" });

  } catch (error) {
    console.error("DELETE RATING ERROR:", error);
    res.status(500).json({ message: error.message });
  }
};

/* =====================================
   NGO LEADERBOARD (Admin)
   FIX: NGOs that have deliveries but zero ratings were
        missing avgRating / totalRatings fields entirely
        when the leaderboardMap entry was created from
        deliveryAgg — AdminDashboard reads both fields
        so they must always be present
   FIX: avgRating.toFixed(2) would throw if avgRating
        was 0 (a number, not a Rating aggregate result)
        — guarded with explicit initialisation
===================================== */
exports.getNGOLeaderboard = async (req, res) => {
  try {
    const [ratingsAgg, deliveryAgg] = await Promise.all([

      Rating.aggregate([
        {
          $group: {
            _id:          "$ngo",
            avgRating:    { $avg: "$rating" },
            totalRatings: { $sum: 1 },
          },
        },
      ]),

      Food.aggregate([
        {
          $match: {
            status:     "delivered",
            reservedBy: { $ne: null },
            reservedAt: { $ne: null },
          },
        },
        {
          $group: {
            _id:             "$reservedBy",
            totalDeliveries: { $sum: 1 },
            avgResponseTime: {
              $avg: { $subtract: ["$reservedAt", "$createdAt"] },
            },
          },
        },
      ]),

    ]);

    // Build map — seed every entry with safe defaults for all fields
    const leaderboardMap = {};

    ratingsAgg.forEach(r => {
      leaderboardMap[r._id.toString()] = {
        ngoId:           r._id,
        avgRating:       Number(r.avgRating.toFixed(2)),
        totalRatings:    r.totalRatings,
        totalDeliveries: 0,   // will be filled by deliveryAgg if present
        avgResponseTime: 0,
      };
    });

    deliveryAgg.forEach(d => {
      const id = d._id.toString();

      if (!leaderboardMap[id]) {
        // FIX: NGO has deliveries but no ratings yet — initialise ALL fields
        leaderboardMap[id] = {
          ngoId:           d._id,
          avgRating:       0,
          totalRatings:    0,
          totalDeliveries: 0,
          avgResponseTime: 0,
        };
      }

      leaderboardMap[id].totalDeliveries = d.totalDeliveries;
      leaderboardMap[id].avgResponseTime = Math.round(d.avgResponseTime / 60000); // ms → minutes
    });

    const leaderboard = Object.values(leaderboardMap);

    // Populate NGO names in one query
    const users = await User.find({
      _id: { $in: leaderboard.map(l => l.ngoId) },
    }).select("name");

    const userMap = {};
    users.forEach(u => { userMap[u._id.toString()] = u.name; });

    const final = leaderboard.map(l => ({
      ...l,
      ngoName: userMap[l.ngoId.toString()] || "Unknown NGO",
    }));

    res.status(200).json(final);

  } catch (error) {
    console.error("NGO LEADERBOARD ERROR:", error);
    res.status(500).json({ message: error.message });
  }
};