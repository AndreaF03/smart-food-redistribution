const mongoose = require("mongoose");

const foodSchema = new mongoose.Schema({
    restaurant: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    foodType: {
        type: String,
        required: true
    },
    quantity: {
        type: Number,
        required: true
    },
    cookedTime: {
        type: Date,
        required: true
    },
    storageType: {
        type: String,
        enum: ["room", "refrigerated"],
        required: true
    },
    freshnessScore: {
        type: Number
    },
    predictedExpiry: {
        type: Date
    },
    status: {
        type: String,
        enum: ["active", "reserved", "picked", "delivered"],
        default: "active"
    }
}, { timestamps: true });

module.exports = mongoose.model("Food", foodSchema);