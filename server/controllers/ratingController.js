const mongoose = require("mongoose");
const Rating   = require("../models/Rating");
const Food     = require("../models/Food");
const User     = require("../models/User"); // moved to top-level — was require()'d
                                             // inside getNGOLeaderboard on every call

/* =====================================
   SUBMIT RATING (Restaurant Only)
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
      restaurant: req.user._id,
      food:       foodId,
    });

    if (existing) {
      return res.status(400).json({ message: "You have already rated this delivery" });
    }

    const newRating = await Rating.create({
      restaurant: req.user._id,
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

    const ratings = await Rating.find({ restaurant: req.user._id })
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
===================================== */
exports.deleteRating = async (req, res) => {
  try {
    const rating = await Rating.findById(req.params.id);

    if (!rating) {
      return res.status(404).json({ message: "Rating not found" });
    }

    if (rating.restaurant.toString() !== req.user._id.toString()) {
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
   NGO LEADERBOARD (Admin Only)
   FIX: was declared twice — first copy had the admin
        role check but was never closed, second copy had
        the actual logic but no role check. Merged into
        one function with both the role guard and the
        full aggregation logic.
===================================== */
exports.getNGOLeaderboard = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Admins only" });
    }

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
        totalDeliveries: 0,   // filled by deliveryAgg if present
        avgResponseTime: 0,
      };
    });

    deliveryAgg.forEach(d => {
      const id = d._id.toString();

      if (!leaderboardMap[id]) {
        // NGO has deliveries but no ratings yet — initialise all fields
        leaderboardMap[id] = {
          ngoId:           d._id,
          avgRating:       0,
          totalRatings:    0,
          totalDeliveries: 0,
          avgResponseTime: 0,
        };
      }

      leaderboardMap[id].totalDeliveries = d.totalDeliveries;
      leaderboardMap[id].avgResponseTime = Math.round(d.avgResponseTime / 60000); // ms -> minutes
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