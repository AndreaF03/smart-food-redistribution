const Rating = require("../models/Rating");
const Food   = require("../models/Food");

/* =====================================
   Submit Rating (Restaurant Only)
===================================== */
exports.submitRating = async (req, res) => {
  try {

    if (req.user.role !== "restaurant") {
      return res.status(403).json({ message: "Only restaurants can rate NGOs" });
    }

    const { foodId, rating, comment } = req.body;

    if (!foodId || !rating) {
      return res.status(400).json({ message: "foodId and rating are required" });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({ message: "Rating must be between 1 and 5" });
    }

    // Find the delivered food and verify it belongs to this restaurant
    const food = await Food.findById(foodId).populate("reservedBy", "_id name");

    if (!food) {
      return res.status(404).json({ message: "Food listing not found" });
    }

    if (food.restaurant.toString() !== req.user.id) {
      return res.status(403).json({ message: "You can only rate NGOs for your own donations" });
    }

    if (food.status !== "delivered") {
      return res.status(400).json({ message: "You can only rate after food is delivered" });
    }

    if (!food.reservedBy) {
      return res.status(400).json({ message: "No NGO found for this delivery" });
    }

    // Check if already rated
    const existing = await Rating.findOne({
      restaurant: req.user.id,
      food: foodId
    });

    if (existing) {
      return res.status(400).json({ message: "You have already rated this delivery" });
    }

    const newRating = await Rating.create({
      restaurant: req.user.id,
      ngo:        food.reservedBy._id,
      food:       foodId,
      rating,
      comment:    comment || ""
    });

    await newRating.populate("ngo", "name");

    res.status(201).json({
      message: "Rating submitted successfully",
      rating: newRating
    });

  } catch (error) {
    console.error("SUBMIT RATING ERROR:", error);
    res.status(500).json({ message: error.message });
  }
};


/* =====================================
   Get NGO's Rating Summary
   (average + all reviews)
===================================== */
exports.getNGORatings = async (req, res) => {
  try {

    const { ngoId } = req.params;

    const ratings = await Rating.find({ ngo: ngoId })
      .populate("restaurant", "name")
      .populate("food", "foodType")
      .sort({ createdAt: -1 });

    const average = ratings.length
      ? (ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length).toFixed(1)
      : null;

    res.status(200).json({
      ngoId,
      average: average ? parseFloat(average) : null,
      totalRatings: ratings.length,
      ratings
    });

  } catch (error) {
    console.error("GET NGO RATINGS ERROR:", error);
    res.status(500).json({ message: error.message });
  }
};


/* =====================================
   Get ratings submitted BY this
   restaurant (to know what's rated)
===================================== */
exports.getMyRatings = async (req, res) => {
  try {

    if (req.user.role !== "restaurant") {
      return res.status(403).json({ message: "Only restaurants can access this" });
    }

    const ratings = await Rating.find({ restaurant: req.user.id })
      .populate("ngo", "name")
      .populate("food", "foodType")
      .sort({ createdAt: -1 });

    // Return as a Set of rated foodIds for easy frontend lookup
    const ratedFoodIds = ratings.map(r => r.food?._id?.toString());

    res.status(200).json({ ratings, ratedFoodIds });

  } catch (error) {
    console.error("GET MY RATINGS ERROR:", error);
    res.status(500).json({ message: error.message });
  }
};