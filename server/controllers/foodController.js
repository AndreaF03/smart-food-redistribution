const Food = require("../models/Food");

/* =====================================
   Freshness Calculation
===================================== */
const calculateFreshness = (cookedTime, storageType) => {
    const now = new Date();
    const cooked = new Date(cookedTime);

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

        const { freshnessScore, predictedExpiry } =
            calculateFreshness(cookedTime, storageType);

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
        .sort({ createdAt: -1 });

        res.json(food);

    } catch (error) {
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
            { new: true }
        );

        if (!food) {
            return res.status(400).json({
                message: "Food already reserved, expired, or unavailable"
            });
        }

        res.json({ message: "Food reserved successfully", food });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};


/* =====================================
   Mark Picked (Restaurant Only)
===================================== */
exports.markPicked = async (req, res) => {
    try {
        if (req.user.role !== "restaurant") {
            return res.status(403).json({ message: "Only restaurants allowed" });
        }

        const food = await Food.findById(req.params.id);

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

        res.json({ message: "Food marked as picked", food });

    } catch (error) {
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

        res.json({ message: "Food delivered successfully", food });

    } catch (error) {
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

        const food = await Food.find({
            reservedBy: req.user.id
        })
        .populate("restaurant", "name email")
        .sort({ createdAt: -1 });

        res.json(food);

    } catch (error) {
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

        const food = await Food.find({
            restaurant: req.user.id
        })
        .populate("reservedBy", "name email")
        .sort({ createdAt: -1 });

        res.json(food);

    } catch (error) {
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

        const totalListings = await Food.countDocuments();
        const deliveredCount = await Food.countDocuments({ status: "delivered" });
        const expiredCount = await Food.countDocuments({ status: "expired" });
        const activeCount = await Food.countDocuments({ status: "active" });
        const reservedCount = await Food.countDocuments({ status: "reserved" });

        const totalQuantityRedistributed = await Food.aggregate([
            { $match: { status: "delivered" } },
            { $group: { _id: null, total: { $sum: "$quantity" } } }
        ]);

        const topRestaurants = await Food.aggregate([
            { $match: { status: "delivered" } },
            {
                $group: {
                    _id: "$restaurant",
                    totalDelivered: { $sum: "$quantity" }
                }
            },
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
        ]);

        res.json({
            totalListings,
            deliveredCount,
            expiredCount,
            activeCount,
            reservedCount,
            totalQuantityRedistributed:
                totalQuantityRedistributed[0]?.total || 0,
            topRestaurants
        });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};