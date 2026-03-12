const Food = require("../models/Food");
const { getIO } = require("../socket");

/* =====================================
   Freshness Calculation
===================================== */
const calculateFreshness = (cookedTime, storageType) => {

  const now = new Date();
  const cooked = new Date(cookedTime);

  if (isNaN(cooked.getTime())) {
    throw new Error("Invalid cookedTime provided");
  }

  if (cooked > now) {
    throw new Error("cookedTime cannot be in the future");
  }

  const hoursPassed = (now - cooked) / (1000 * 60 * 60);
  const maxHours = storageType === "refrigerated" ? 12 : 6;

  const freshnessScore = Math.max(
    0,
    100 - (hoursPassed / maxHours) * 100
  );

  const predictedExpiry = new Date(
    cooked.getTime() + maxHours * 60 * 60 * 1000
  );

  return {
    freshnessScore: Math.round(freshnessScore),
    predictedExpiry
  };
};


/* =====================================
   Create Food (Restaurant Only)
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

    if (quantity <= 0) {
      return res.status(400).json({ message: "Quantity must be positive" });
    }

    const allowedStorage = ["room", "refrigerated"];
    if (!allowedStorage.includes(storageType)) {
      return res.status(400).json({ message: "Invalid storage type" });
    }

    if (
      !req.user.location ||
      !req.user.location.coordinates ||
      req.user.location.coordinates.length !== 2
    ) {
      return res.status(400).json({ message: "Restaurant location not properly set" });
    }

    let freshnessScore, predictedExpiry;
    try {
      ({ freshnessScore, predictedExpiry } = calculateFreshness(cookedTime, storageType));
    } catch (freshnessError) {
      return res.status(400).json({ message: freshnessError.message });
    }

    const image = req.file?.path || "";

    const food = await Food.create({
      restaurant: req.user.id,
      foodType,
      quantity,
      cookedTime,
      storageType,
      image,
      freshnessScore,
      predictedExpiry,
      location: {
        type: "Point",
        coordinates: req.user.location.coordinates
      },
      status: "active"
    });

    res.status(201).json(food);

  } catch (error) {
    console.error("CREATE FOOD ERROR:", error);
    res.status(500).json({ message: error.message });
  }
};


/* =====================================
   Get Nearby Food (NGO Only)
===================================== */
exports.getNearbyFood = async (req, res) => {
  try {

    if (req.user.role !== "ngo") {
      return res.status(403).json({ message: "Only NGOs can view nearby food" });
    }

    if (
      !req.user.location ||
      !req.user.location.coordinates ||
      req.user.location.coordinates.length !== 2
    ) {
      return res.status(400).json({ message: "NGO location not properly set" });
    }

    const [longitude, latitude] = req.user.location.coordinates;

    await Food.updateMany(
      {
        status: { $in: ["active", "reserved"] },
        predictedExpiry: { $lt: new Date() }
      },
      { status: "expired" }
    );

    const food = await Food.find({
      status: "active",
      location: {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [longitude, latitude]
          },
          $maxDistance: 10000
        }
      }
    })
      .populate("restaurant", "name email")
      .limit(20);

    res.status(200).json(food);

  } catch (error) {
    console.error("GET NEARBY FOOD ERROR:", error);
    res.status(500).json({ message: error.message });
  }
};


/* =====================================
   Reserve Food (NGO Only)
   Notifies: Restaurant
===================================== */
exports.reserveFood = async (req, res) => {
  try {

    if (req.user.role !== "ngo") {
      return res.status(403).json({ message: "Only NGOs can reserve food" });
    }

    const food = await Food.findOneAndUpdate(
      {
        _id: req.params.id,
        status: "active",
        predictedExpiry: { $gt: new Date() }
      },
      {
        status: "reserved",
        reservedBy: req.user.id,
        reservedAt: new Date()
      },
      { new: true }
    ).populate("restaurant", "name email _id");

    if (!food) {
      return res.status(400).json({
        message: "Food already reserved, expired, or unavailable"
      });
    }

    // Notify the restaurant their food was reserved by an NGO
    try {
      getIO()
        .to(food.restaurant._id.toString())
        .emit("food_reserved", {
          type: "food_reserved",
          message: `Your listing "${food.foodType}" has been reserved by ${req.user.name}`,
          foodId: food._id,
          foodType: food.foodType,
          quantity: food.quantity,
          ngoName: req.user.name,
          timestamp: new Date()
        });
    } catch (socketErr) {
      console.error("Socket emit error (reserveFood):", socketErr.message);
    }

    res.status(200).json({ message: "Food reserved successfully", food });

  } catch (error) {
    console.error("RESERVE FOOD ERROR:", error);
    res.status(500).json({ message: error.message });
  }
};


/* =====================================
   Confirm Pickup (Restaurant Only)
   Notifies: NGO
===================================== */
exports.markPicked = async (req, res) => {
  try {

    if (req.user.role !== "restaurant") {
      return res.status(403).json({ message: "Only restaurants can confirm pickup" });
    }

    const food = await Food.findById(req.params.id)
      .populate("reservedBy", "name email _id");

    if (!food) {
      return res.status(404).json({ message: "Food not found" });
    }

    if (food.status !== "reserved") {
      return res.status(400).json({ message: "Food must be reserved first" });
    }

    if (food.restaurant.toString() !== req.user.id) {
      return res.status(403).json({ message: "Not authorized" });
    }

    food.status = "picked";
    await food.save();

    // Notify the NGO that pickup is confirmed — they should now deliver
    if (food.reservedBy) {
      try {
        getIO()
          .to(food.reservedBy._id.toString())
          .emit("food_picked", {
            type: "food_picked",
            message: `"${food.foodType}" is ready — ${req.user.name} confirmed pickup. Please deliver now!`,
            foodId: food._id,
            foodType: food.foodType,
            quantity: food.quantity,
            restaurantName: req.user.name,
            timestamp: new Date()
          });
      } catch (socketErr) {
        console.error("Socket emit error (markPicked):", socketErr.message);
      }
    }

    res.status(200).json({ message: "Pickup confirmed", food });

  } catch (error) {
    console.error("MARK PICKED ERROR:", error);
    res.status(500).json({ message: error.message });
  }
};


/* =====================================
   Mark Delivered (NGO Only)
   Notifies: Restaurant
===================================== */
exports.markDelivered = async (req, res) => {
  try {

    if (req.user.role !== "ngo") {
      return res.status(403).json({ message: "Only NGOs allowed" });
    }

    const food = await Food.findById(req.params.id)
      .populate("restaurant", "name email _id");

    if (!food) {
      return res.status(404).json({ message: "Food not found" });
    }

    if (food.status !== "picked") {
      return res.status(400).json({ message: "Food must be picked first" });
    }

    if (food.reservedBy.toString() !== req.user.id) {
      return res.status(403).json({ message: "Not authorized" });
    }

    food.status = "delivered";
    food.deliveredAt = new Date();
    await food.save();

    // Notify the restaurant that delivery is complete
    try {
      getIO()
        .to(food.restaurant._id.toString())
        .emit("food_delivered", {
          type: "food_delivered",
          message: `"${food.foodType}" (${food.quantity} units) has been delivered to beneficiaries`,
          foodId: food._id,
          foodType: food.foodType,
          quantity: food.quantity,
          timestamp: new Date()
        });
    } catch (socketErr) {
      console.error("Socket emit error (markDelivered):", socketErr.message);
    }

    res.status(200).json({ message: "Food delivered successfully", food });

  } catch (error) {
    console.error("MARK DELIVERED ERROR:", error);
    res.status(500).json({ message: error.message });
  }
};


/* =====================================
   NGO Dashboard
===================================== */
exports.getNGODashboard = async (req, res) => {
  try {

    if (req.user.role !== "ngo") {
      return res.status(403).json({ message: "Only NGOs can access dashboard" });
    }

    const [reserved, picked, delivered] = await Promise.all([
      Food.find({ reservedBy: req.user.id, status: "reserved" })
        .populate("restaurant", "name email")
        .sort({ createdAt: -1 }),

      Food.find({ reservedBy: req.user.id, status: "picked" })
        .populate("restaurant", "name email")
        .sort({ createdAt: -1 }),

      Food.find({ reservedBy: req.user.id, status: "delivered" })
        .populate("restaurant", "name email")
        .sort({ createdAt: -1 })
    ]);

    res.status(200).json({ reserved, picked, delivered });

  } catch (error) {
    console.error("NGO DASHBOARD ERROR:", error);
    res.status(500).json({ message: error.message });
  }
};


/* =====================================
   Restaurant Dashboard
===================================== */
exports.getRestaurantDashboard = async (req, res) => {
  try {

    if (req.user.role !== "restaurant") {
      return res.status(403).json({ message: "Only restaurants can access dashboard" });
    }

    const food = await Food.find({ restaurant: req.user.id })
      .populate("reservedBy", "name email")
      .sort({ createdAt: -1 });

    res.status(200).json(food);

  } catch (error) {
    console.error("RESTAURANT DASHBOARD ERROR:", error);
    res.status(500).json({ message: error.message });
  }
};

/* =====================================
   Admin Analytics
===================================== */
exports.getAdminAnalytics = async (req, res) => {
  try {

    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Only admins can access analytics" });
    }

    const [
      totalListings,
      deliveredCount,
      expiredCount,
      activeCount,
      reservedCount,
      quantityResult,
      donationsPerDay,
      topRestaurants,
      ngoActivity
    ] = await Promise.all([

      // Total food listings ever
      Food.countDocuments(),

      // Total delivered
      Food.countDocuments({ status: "delivered" }),

      // Total expired
      Food.countDocuments({ status: "expired" }),

      // Currently active
      Food.countDocuments({ status: "active" }),

      // Currently reserved
      Food.countDocuments({ status: "reserved" }),

      // Total quantity redistributed
      Food.aggregate([
        { $match: { status: "delivered" } },
        { $group: { _id: null, total: { $sum: "$quantity" } } }
      ]),

      // Food donations per day — last 14 days
      Food.aggregate([
        {
          $match: {
            createdAt: {
              $gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
            }
          }
        },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
            },
            donations: { $sum: 1 },
            quantity: { $sum: "$quantity" }
          }
        },
        { $sort: { _id: 1 } },
        {
          $project: {
            _id: 0,
            date: "$_id",
            donations: 1,
            quantity: 1
          }
        }
      ]),

      // Top 5 restaurants by delivered quantity
      Food.aggregate([
        { $match: { status: "delivered" } },
        {
          $group: {
            _id: "$restaurant",
            totalDelivered: { $sum: "$quantity" },
            totalDonations: { $sum: 1 }
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
            restaurantName: { $arrayElemAt: ["$restaurantInfo.name", 0] },
            totalDelivered: 1,
            totalDonations: 1
          }
        }
      ]),

      // Top 5 NGOs by deliveries completed
      Food.aggregate([
        { $match: { status: "delivered" } },
        {
          $group: {
            _id: "$reservedBy",
            deliveriesCompleted: { $sum: 1 },
            quantityDelivered: { $sum: "$quantity" }
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
            ngoName: { $arrayElemAt: ["$ngoInfo.name", 0] },
            deliveriesCompleted: 1,
            quantityDelivered: 1
          }
        }
      ])

    ]);

    res.status(200).json({
      totalListings,
      deliveredCount,
      expiredCount,
      activeCount,
      reservedCount,
      totalQuantityRedistributed: quantityResult[0]?.total || 0,
      donationsPerDay,
      topRestaurants,
      ngoActivity
    });

  } catch (error) {
    console.error("ADMIN ANALYTICS ERROR:", error);
    res.status(500).json({ message: error.message });
  }
};