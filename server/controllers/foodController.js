const Food = require("../models/Food");

/* =====================================
   Freshness Calculation
===================================== */
const calculateFreshness = (cookedTime, storageType) => {
    const now = new Date();
    const cooked = new Date(cookedTime);

    // Validate cookedTime
    if (isNaN(cooked.getTime())) {
        throw new Error("Invalid cookedTime provided");
    }

    // Reject future cookedTime
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

        if (!req.user.location) {
            return res.status(400).json({ message: "Restaurant location not set" });
        }

        // calculateFreshness may throw for invalid/future cookedTime
        let freshnessScore, predictedExpiry;
        try {
            ({ freshnessScore, predictedExpiry } = calculateFreshness(cookedTime, storageType));
        } catch (freshnessError) {
            return res.status(400).json({ message: freshnessError.message });
        }

        const food = await Food.create({
            restaurant: req.user.id,
            foodType,
            quantity,
            cookedTime,
            storageType,
            freshnessScore,
            predictedExpiry,
            location: req.user.location,
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

        if (!req.user.location) {
            return res.status(400).json({ message: "NGO location not set" });
        }

        const [longitude, latitude] = req.user.location.coordinates;

        // Auto-expire outdated food
        await Food.updateMany(
            {
                status: { $in: ["active", "reserved"] },
                predictedExpiry: { $lt: new Date() }
            },
            { status: "expired" }
        );

        // NOTE: .sort() is NOT used here — incompatible with $near in MongoDB
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
   Reserve Food (Race Safe)
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
    reservedBy: req.user.id
  },
  { returnDocument: 'after' } // Fixed: replaces deprecated { new: true }
);

        if (!food) {
            return res.status(400).json({
                message: "Food already reserved, expired, or unavailable"
            });
        }

        res.status(200).json({ message: "Food reserved successfully", food });

    } catch (error) {
        console.error("RESERVE FOOD ERROR:", error);
        res.status(500).json({ message: error.message });
    }
};


/* =====================================
   Mark Picked (NGO confirms pickup)
===================================== */
exports.markPicked = async (req, res) => {
    try {
        // Fixed: NGO picks up food, not restaurant
        if (req.user.role !== "ngo") {
            return res.status(403).json({ message: "Only NGOs can confirm pickup" });
        }

        const food = await Food.findById(req.params.id);

        if (!food) {
            return res.status(404).json({ message: "Food not found" });
        }

        if (food.status !== "reserved") {
            return res.status(400).json({ message: "Food must be reserved first" });
        }

        // Ensure only the NGO who reserved it can mark it picked
        if (food.reservedBy.toString() !== req.user.id) {
            return res.status(403).json({ message: "Not authorized" });
        }

        food.status = "picked";
        await food.save();

        res.status(200).json({ message: "Food marked as picked", food });

    } catch (error) {
        console.error("MARK PICKED ERROR:", error);
        res.status(500).json({ message: error.message });
    }
};


/* =====================================
   Mark Delivered (NGO Only)
===================================== */
exports.markDelivered = async (req, res) => {
    try {
        if (req.user.role !== "ngo") {
            return res.status(403).json({ message: "Only NGOs allowed" });
        }

        const food = await Food.findById(req.params.id);

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
        await food.save();

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

        // Group by status for a useful dashboard view
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
            totalQuantityRedistributed,
            topRestaurants
        ] = await Promise.all([
            Food.countDocuments(),
            Food.countDocuments({ status: "delivered" }),
            Food.countDocuments({ status: "expired" }),
            Food.countDocuments({ status: "active" }),
            Food.countDocuments({ status: "reserved" }),
            Food.aggregate([
                { $match: { status: "delivered" } },
                { $group: { _id: null, total: { $sum: "$quantity" } } }
            ]),
            Food.aggregate([
                { $match: { status: "delivered" } },
                { $group: { _id: "$restaurant", totalDelivered: { $sum: "$quantity" } } },
                { $sort: { totalDelivered: -1 } },
                { $limit: 5 },
                {
                    $lookup: {
                        from: "users",
                        localField: "_id",
                        foreignField: "_id",
                        as: "restaurant"
                    }
                },
                { $unwind: "$restaurant" },
                {
                    $project: {
                        _id: 0,
                        restaurantName: "$restaurant.name",
                        totalDelivered: 1
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
            totalQuantityRedistributed: totalQuantityRedistributed[0]?.total || 0,
            topRestaurants
        });

    } catch (error) {
        console.error("ADMIN ANALYTICS ERROR:", error);
        res.status(500).json({ message: error.message });
    }
};