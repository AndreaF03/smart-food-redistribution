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
    },
    location: {
        type: {
            type: String,
            enum: ["Point"],
            default: "Point"
        },
        coordinates: {
            type: [Number], // [longitude, latitude]
        }
    }
}, { timestamps: true });

foodSchema.index({ location: "2dsphere" });

module.exports = mongoose.model("Food", foodSchema);