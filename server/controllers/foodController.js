const Food = require("../models/Food");
const { getIO } = require("../socket");
const { sendEmail } = require("../utils/mailer");

// Node 18+ has native fetch — no extra package needed
const FORECASTER_URL = process.env.FORECASTER_URL || "http://localhost:5001";

/* =====================================
   FRESHNESS CALCULATION
===================================== */
const calculateFreshness = (cookedTime, storageType) => {
  const now    = new Date();
  const cooked = new Date(cookedTime);

  if (isNaN(cooked.getTime())) throw new Error("Invalid cookedTime provided");
  if (cooked > now)            throw new Error("Cooked time cannot be in the future");

  const hoursPassed     = (now - cooked) / (1000 * 60 * 60);
  const maxHours        = storageType === "refrigerated" ? 12 : 6;
  const freshnessScore  = Math.max(0, Math.round(100 - (hoursPassed / maxHours) * 100));
  const predictedExpiry = new Date(cooked.getTime() + maxHours * 60 * 60 * 1000);

  return { freshnessScore, predictedExpiry };
};

/* =====================================
   FORECAST HELPER
   Calls the Python Flask microservice.
   Returns null gracefully if the service
   is down so analytics still load.
===================================== */
const fetchForecast = async () => {
  try {
    const res = await fetch(`${FORECASTER_URL}/predict?days=30&horizon=7`, {
      signal: AbortSignal.timeout(8000), // 8 s timeout — Prophet can be slow on first call
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.ok ? data : null;
  } catch (err) {
    console.warn("FORECAST SERVICE UNAVAILABLE:", err.message);
    return null;
  }
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
      restaurant:    req.user._id,
      foodType,
      quantity:      Number(quantity),
      cookedTime,
      storageType,
      image:         req.file?.path || "",
      freshnessScore,
      predictedExpiry,
      location: {
        type:        "Point",
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

    if (!req.user.location?.coordinates || req.user.location.coordinates.length !== 2) {
      return res.status(400).json({ message: "NGO location not set" });
    }

    const [longitude, latitude] = req.user.location.coordinates;

    const food = await Food.find({
      status:          "available",
      predictedExpiry: { $gt: new Date() },
      location: {
        $near: {
          $geometry:    { type: "Point", coordinates: [longitude, latitude] },
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
        _id:             req.params.id,
        status:          "available",
        predictedExpiry: { $gt: new Date() },
      },
      {
        status:     "reserved",
        reservedBy: req.user._id,
        reservedAt: new Date(),
      },
      { new: true }
    ).populate("restaurant", "name email _id");

    if (!food) {
      return res.status(400).json({ message: "Food unavailable or expired" });
    }

    const io = getIO();
    if (io) {
      io.to(food.restaurant._id.toString()).emit("food_reserved", {
        type:      "food_reserved",
        message:   `${food.foodType} reserved by ${req.user.name}`,
        foodId:    food._id,
        timestamp: new Date(),
      });
    }

    sendEmail({
      to:      food.restaurant.email,
      subject: "Food Reserved 📦",
      html: `
        <h3>Your food has been reserved!</h3>
        <p><strong>${food.foodType}</strong> (${food.quantity} units)</p>
        <p>Reserved by: ${req.user.name}</p>
      `,
    }).catch(err => console.error("RESERVE EMAIL ERROR:", err));

    res.status(200).json({ message: "Reserved successfully", food });
  } catch (error) {
    console.error("RESERVE FOOD ERROR:", error);
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
    ).populate("reservedBy", "name email _id");

    if (!food) {
      return res.status(404).json({ message: "Unauthorized or food not reserved" });
    }

    const io = getIO();
    if (io) {
      io.to(food.reservedBy._id.toString()).emit("food_picked", {
        type:      "food_picked",
        message:   `Pickup confirmed by ${req.user.name}. Ready for delivery!`,
        foodId:    food._id,
        timestamp: new Date(),
      });
    }

    sendEmail({
      to:      food.reservedBy.email,
      subject: "Pickup Confirmed 🚚",
      html: `
        <h3>Pickup Confirmed!</h3>
        <p>Your reserved food is ready for collection.</p>
        <p><strong>${food.foodType}</strong></p>
      `,
    }).catch(err => console.error("PICKUP EMAIL ERROR:", err));

    res.status(200).json({ message: "Pickup confirmed", food });
  } catch (error) {
    console.error("MARK PICKED ERROR:", error);
    res.status(500).json({ message: error.message });
  }
};

/* =====================================
   MARK DELIVERED (NGO Completion)
===================================== */
exports.markDelivered = async (req, res) => {
  try {
    const food = await Food.findById(req.params.id)
      .populate("restaurant", "name email _id");

    if (!food) {
      return res.status(404).json({ message: "Food not found" });
    }

    if (!food.reservedBy.equals(req.user._id)) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    food.status      = "delivered";
    food.deliveredAt = new Date();
    await food.save();

    const io = getIO();
    if (io) {
      io.to(food.restaurant._id.toString()).emit("food_delivered", {
        type:      "food_delivered",
        message:   `Food delivered successfully by ${req.user.name}`,
        foodId:    food._id,
        timestamp: new Date(),
      });
    }

    sendEmail({
      to:      food.restaurant.email,
      subject: "Delivery Completed ✅",
      html: `
        <h3>Delivery Completed!</h3>
        <p>Your donation has been successfully delivered.</p>
        <p><strong>${food.foodType}</strong></p>
      `,
    }).catch(err => console.error("DELIVERY EMAIL ERROR:", err));

    res.status(200).json({ message: "Delivered", food });
  } catch (error) {
    console.error("MARK DELIVERED ERROR:", error);
    res.status(500).json({ message: error.message });
  }
};

/* =====================================
   DASHBOARDS
===================================== */
exports.getNGODashboard = async (req, res) => {
  try {
    const [reserved, picked, delivered] = await Promise.all([
      Food.find({ reservedBy: req.user._id, status: "reserved"  }).populate("restaurant", "name"),
      Food.find({ reservedBy: req.user._id, status: "picked"    }).populate("restaurant", "name"),
      Food.find({ reservedBy: req.user._id, status: "delivered" }).populate("restaurant", "name").limit(20),
    ]);
    res.status(200).json({ reserved, picked, delivered });
  } catch (error) {
    console.error("NGO DASHBOARD ERROR:", error);
    res.status(500).json({ message: error.message });
  }
};

exports.getRestaurantDashboard = async (req, res) => {
  try {
    const food = await Food.find({ restaurant: req.user._id })
      .populate("reservedBy", "name")   // needed for NGO name in rating modal
      .sort({ createdAt: -1 });
    res.status(200).json(food);
  } catch (error) {
    console.error("RESTAURANT DASHBOARD ERROR:", error);
    res.status(500).json({ message: error.message });
  }
};

/* =====================================
   ADMIN ANALYTICS  (now includes AI forecast)
===================================== */
exports.getAdminAnalytics = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Only admins can access analytics" });
    }

    // Run DB aggregations and forecast call in parallel
    const [
      totalListings,
      deliveredCount,
      activeCount,
      reservedCount,
      expiredCount,
      totalQuantityResult,
      topRestaurants,
      ngoActivity,
      donationsPerDay,
      forecastData,       // ← new: AI forecast (null if service is down)
    ] = await Promise.all([

      Food.countDocuments(),
      Food.countDocuments({ status: "delivered" }),
      Food.countDocuments({ status: "available" }),
      Food.countDocuments({ status: "reserved"  }),
      Food.countDocuments({ status: "expired"   }),

      Food.aggregate([
        { $match: { status: "delivered" } },
        { $group: { _id: null, total: { $sum: "$quantity" } } },
      ]),

      Food.aggregate([
        { $match: { status: "delivered" } },
        { $group: { _id: "$restaurant", totalDelivered: { $sum: "$quantity" }, donationCount: { $sum: 1 } } },
        { $sort: { totalDelivered: -1 } },
        { $limit: 5 },
        { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "restaurantInfo" } },
        { $project: {
            _id: 0,
            restaurantName: { $ifNull: [{ $arrayElemAt: ["$restaurantInfo.name", 0] }, "Deleted User"] },
            totalDelivered: 1,
            donationCount:  1,
        }},
      ]),

      Food.aggregate([
        { $match: { status: "delivered", reservedBy: { $ne: null } } },
        { $group: { _id: "$reservedBy", deliveriesCompleted: { $sum: 1 } } },
        { $sort: { deliveriesCompleted: -1 } },
        { $limit: 5 },
        { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "ngoInfo" } },
        { $project: {
            _id: 0,
            ngoName:             { $ifNull: [{ $arrayElemAt: ["$ngoInfo.name", 0] }, "Unknown NGO"] },
            deliveriesCompleted: 1,
        }},
      ]),

      Food.aggregate([
        { $match: { createdAt: { $gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) } } },
        { $group: {
            _id:       { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            donations: { $sum: 1 },
            quantity:  { $sum: "$quantity" },
        }},
        { $sort: { _id: 1 } },
        { $project: { _id: 0, date: "$_id", donations: 1, quantity: 1 } },
      ]),

      // AI forecast — non-blocking, returns null if Flask is down
      fetchForecast(),
    ]);

    res.status(200).json({
      totalListings,
      deliveredCount,
      activeCount,
      reservedCount,
      expiredCount,
      totalQuantityRedistributed: totalQuantityResult[0]?.total || 0,
      topRestaurants,
      ngoActivity,
      donationsPerDay,
      // Forecast fields — frontend checks for null and shows
      // "Forecast unavailable" gracefully if Flask isn't running
      forecast:         forecastData?.forecast         || null,
      forecastSummary:  forecastData?.summary          || null,
      forecastAvailable: forecastData !== null,
    });

  } catch (error) {
    console.error("ADMIN ANALYTICS ERROR:", error);
    res.status(500).json({ message: error.message });
  }
};

/* =====================================
   DELETE FOOD (Restaurant Only)
===================================== */
exports.deleteFood = async (req, res) => {
  try {
    const food = await Food.findById(req.params.id);

    if (!food) {
      return res.status(404).json({ message: "Food not found" });
    }

    if (food.restaurant.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }

    if (food.status !== "available") {
      return res.status(400).json({ message: "Cannot delete. Food already reserved or processed." });
    }

    await food.deleteOne();
    res.status(200).json({ message: "Food listing deleted successfully" });

  } catch (error) {
    console.error("DELETE FOOD ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/* =====================================
   UPDATE FOOD (Restaurant Only)
===================================== */
exports.updateFood = async (req, res) => {
  try {
    const { quantity, storageType, cookedTime } = req.body;

    const food = await Food.findById(req.params.id);

    if (!food) {
      return res.status(404).json({ message: "Food not found" });
    }

    if (food.restaurant.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }

    if (food.status !== "available") {
      return res.status(400).json({ message: "Only available listings can be edited" });
    }

    if (quantity    !== undefined) food.quantity    = Number(quantity);
    if (storageType !== undefined) food.storageType = storageType;
    if (cookedTime  !== undefined) food.cookedTime  = cookedTime;

    if (cookedTime !== undefined || storageType !== undefined) {
      const { freshnessScore, predictedExpiry } = calculateFreshness(
        food.cookedTime,
        food.storageType
      );
      food.freshnessScore  = freshnessScore;
      food.predictedExpiry = predictedExpiry;
    }

    await food.save();
    res.status(200).json({ message: "Food updated successfully", food });

  } catch (error) {
    console.error("UPDATE FOOD ERROR:", error);
    res.status(500).json({ message: error.message });
  }
};