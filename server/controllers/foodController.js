const mongoose = require("mongoose");
const Food = require("../models/Food");
const { getIO } = require("../socket");

/* =====================================
   FRESHNESS CALCULATION LOGIC
===================================== */
const calculateFreshness = (cookedTime, storageType) => {
  const now = new Date();
  const cooked = new Date(cookedTime);

  if (isNaN(cooked.getTime())) {
    throw new Error("Invalid cookedTime provided");
  }

  if (cooked > now) {
    throw new Error("Cooked time cannot be in the future");
  }

  const hoursPassed = (now - cooked) / (1000 * 60 * 60);
  const maxHours = storageType === "refrigerated" ? 12 : 6;

  const freshnessScore = Math.max(0, 100 - (hoursPassed / maxHours) * 100);
  const predictedExpiry = new Date(cooked.getTime() + maxHours * 60 * 60 * 1000);

  return {
    freshnessScore: Math.round(freshnessScore),
    predictedExpiry,
  };
};

/* =====================================
   CREATE FOOD (Restaurant Only)
===================================== */
exports.createFood = async (req, res) => {
  try {
    if (req.user.role !== "restaurant") {
      return res.status(403).json({ message: "Only restaurants can upload food" });
    }

    const { foodType, quantity, cookedTime, storageType } = req.body;

    if (!foodType || !quantity || !cookedTime || !storageType) {
      return res.status(400).json({ message: "All fields are required" });
    }

    if (!req.user.location?.coordinates || req.user.location.coordinates.length !== 2) {
      return res.status(400).json({ message: "Restaurant location not set" });
    }

    const { freshnessScore, predictedExpiry } = calculateFreshness(cookedTime, storageType);

    const food = await Food.create({
      restaurant: req.user._id, 
      foodType,
      quantity: Number(quantity),
      cookedTime,
      storageType,
      image: req.file?.path || "",
      freshnessScore,
      predictedExpiry,
      location: {
        type: "Point",
        coordinates: req.user.location.coordinates,
      },
      status: "available",
    });

    res.status(201).json(food);
  } catch (error) {
    console.error("CREATE FOOD ERROR:", error);
    res.status(500).json({ message: error.message });
  }
};

/* =====================================
   GET NEARBY FOOD (NGO Only)
===================================== */
exports.getNearbyFood = async (req, res) => {
  try {
    if (req.user.role !== "ngo") {
      return res.status(403).json({ message: "Only NGOs can view nearby food" });
    }

    const [longitude, latitude] = req.user.location.coordinates;

    const food = await Food.find({
      status: "available",
      predictedExpiry: { $gt: new Date() },
      location: {
        $near: {
          $geometry: { type: "Point", coordinates: [longitude, latitude] },
          $maxDistance: 10000, 
        },
      },
    }).populate("restaurant", "name email");

    res.status(200).json(food);
  } catch (error) {
    console.error("GET NEARBY FOOD ERROR:", error);
    res.status(500).json({ message: error.message });
  }
};

/* =====================================
   RESERVE FOOD (NGO Action)
===================================== */
exports.reserveFood = async (req, res) => {
  try {
    const food = await Food.findOneAndUpdate(
      {
        _id: req.params.id,
        status: "available",
        predictedExpiry: { $gt: new Date() },
      },
      {
        status: "reserved",
        reservedBy: req.user._id,
        reservedAt: new Date(),
      },
      { new: true }
    ).populate("restaurant", "name email _id");

    if (!food) {
      return res.status(400).json({ message: "Food unavailable or expired" });
    }

    // NOTIFY RESTAURANT
    const restaurantRoom = food.restaurant._id.toString();
    const io = getIO();
    if (io) {
      io.to(restaurantRoom).emit("food_reserved", {
        type: "food_reserved",
        message: `${food.foodType} reserved by ${req.user.name}`,
        foodId: food._id,
        timestamp: new Date(),
      });
    }

    res.status(200).json({ message: "Reserved successfully", food });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* =====================================
   MARK PICKED (Restaurant Confirmation)
===================================== */
exports.markPicked = async (req, res) => {
  try {
    const food = await Food.findOneAndUpdate(
      { _id: req.params.id, status: "reserved", restaurant: req.user._id },
      { status: "picked" },
      { new: true }
    ).populate("reservedBy", "name _id");

    if (!food) {
      return res.status(404).json({ message: "Unauthorized or food not reserved" });
    }

    // NOTIFY NGO
    const ngoRoom = food.reservedBy._id.toString();
    const io = getIO();
    if (io) {
      io.to(ngoRoom).emit("food_picked", {
        type: "food_picked",
        message: `Pickup confirmed by ${req.user.name}. Ready for delivery!`,
        foodId: food._id,
        timestamp: new Date(),
      });
    }

    res.status(200).json({ message: "Pickup confirmed", food });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* =====================================
   MARK DELIVERED (NGO Completion)
===================================== */
exports.markDelivered = async (req, res) => {
  try {
    const food = await Food.findById(req.params.id).populate("restaurant", "_id");

    if (!food || !food.reservedBy.equals(req.user._id)) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    food.status = "delivered";
    food.deliveredAt = new Date();
    await food.save();

    // NOTIFY RESTAURANT
    const restaurantRoom = food.restaurant._id.toString();
    const io = getIO();
    if (io) {
      io.to(restaurantRoom).emit("food_delivered", {
        type: "food_delivered",
        message: `Food delivered successfully by ${req.user.name}`,
        foodId: food._id,
        timestamp: new Date(),
      });
    }

    res.status(200).json({ message: "Delivered", food });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* =====================================
   DASHBOARDS
===================================== */
exports.getNGODashboard = async (req, res) => {
  try {
    const [reserved, picked, delivered] = await Promise.all([
      Food.find({ reservedBy: req.user._id, status: "reserved" }).populate("restaurant", "name"),
      Food.find({ reservedBy: req.user._id, status: "picked" }).populate("restaurant", "name"),
      Food.find({ reservedBy: req.user._id, status: "delivered" }).populate("restaurant", "name").limit(20),
    ]);
    res.status(200).json({ reserved, picked, delivered });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getRestaurantDashboard = async (req, res) => {
  try {
    const food = await Food.find({ restaurant: req.user._id }).sort({ createdAt: -1 });
    res.status(200).json(food);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
exports.getAdminAnalytics = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Only admins can access analytics" });
    }

    const topRestaurants = await Food.aggregate([
      { $match: { status: "delivered" } },
      {
        $group: {
          _id: "$restaurant",
          totalDelivered: { $sum: "$quantity" },
          donationCount: { $sum: 1 }
        }
      },
      { $sort: { totalDelivered: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "restaurantInfo"
        }
      },
      {
        $project: {
          _id: 0,
          restaurantName: { 
            $ifNull: [{ $arrayElemAt: ["$restaurantInfo.name", 0] }, "Deleted User"] 
          },
          totalDelivered: 1,
          donationCount: 1
        }
      }
    ]);

    const ngoActivity = await Food.aggregate([
      { $match: { status: "delivered", reservedBy: { $ne: null } } }, // safer
      {
        $group: {
          _id: "$reservedBy",
          deliveriesCompleted: { $sum: 1 }
        }
      },
      { $sort: { deliveriesCompleted: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "ngoInfo"
        }
      },
      {
        $project: {
          _id: 0,
          ngoName: {
            $ifNull: [{ $arrayElemAt: ["$ngoInfo.name", 0] }, "Unknown NGO"]
          },
          deliveriesCompleted: 1
        }
      }
    ]);

    
    res.status(200).json({ topRestaurants, ngoActivity });

  } catch (error) {
    console.error("ADMIN ANALYTICS ERROR:", error);
    res.status(500).json({ message: error.message });
  }
};

/* =====================================
   DELETE FOOD
===================================== */
exports.deleteFood = async (req, res) => {
  try {
    const food = await Food.findById(req.params.id);

    // ❌ Not found
    if (!food) {
      return res.status(404).json({ message: "Food not found" });
    }

    // ❌ Not owner
    if (food.restaurant.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }

    // ❌ Already reserved or processed
    if (food.status !== "available") {
      return res.status(400).json({
        message: "Cannot delete. Food already reserved or processed.",
      });
    }

    await food.deleteOne();

    res.status(200).json({ message: "Food listing deleted successfully" });

  } catch (error) {
    console.error("DELETE FOOD ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};