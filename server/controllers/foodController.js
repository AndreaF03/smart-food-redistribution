const Food = require("../models/Food");

const calculateFreshness = (cookedTime, storageType) => {
    const now = new Date();
    const cooked = new Date(cookedTime);

    const hoursPassed = (now - cooked) / (1000 * 60 * 60);

    let maxHours = storageType === "refrigerated" ? 12 : 6;

    let freshnessScore = Math.max(0, 100 - (hoursPassed / maxHours) * 100);

    let predictedExpiry = new Date(cooked.getTime() + maxHours * 60 * 60 * 1000);

    return {
        freshnessScore: Math.round(freshnessScore),
        predictedExpiry
    };
};

exports.createFood = async (req, res) => {
    try {
        if (req.user.role !== "restaurant") {
            return res.status(403).json({ message: "Only restaurants can upload food" });
        }

        const { foodType, quantity, cookedTime, storageType } = req.body;

        const { freshnessScore, predictedExpiry } = calculateFreshness(
            cookedTime,
            storageType
        );

        const food = await Food.create({
        restaurant: req.user._id,
        foodType,
        quantity,
        cookedTime,
        storageType,
        freshnessScore,
        predictedExpiry,
        location: req.user.location
    });

        res.status(201).json(food);

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.getNearbyFood = async (req, res) => {
    try {
        if (req.user.role !== "ngo") {
            return res.status(403).json({ message: "Only NGOs can view nearby food" });
        }

        if (!req.user.location || !req.user.location.coordinates) {
            return res.status(400).json({ message: "NGO location not set properly" });
        }

        const [longitude, latitude] = req.user.location.coordinates;

        const food = await Food.find({
            status: "active",
            predictedExpiry: { $gt: new Date() }
        }).find({
            location: {
                $near: {
                    $geometry: {
                        type: "Point",
                        coordinates: [longitude, latitude]
                    },
                    $maxDistance: 10000
                }
            }
        }).populate("restaurant", "name email");

        res.json(food);

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};