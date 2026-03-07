const mongoose = require("mongoose");

const foodSchema = new mongoose.Schema({
    restaurant: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    foodType: {
        type: String,
        required: true,
        trim: true
    },
    quantity: {
        type: Number,
        required: true,
        min: 1
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
        type: Number,
        min: 0,
        max: 100,
        default: 100
    },
    predictedExpiry: {
        type: Date,
        required: true
    },
    status: {
        type: String,
        enum: ["active", "reserved", "picked", "delivered", "expired"],
        default: "active"
    },
    location: {
        type: {
            type: String,
            enum: ["Point"],
            default: "Point"
        },
        coordinates: {
            type: [Number],
            required: true
        }
    },
    reservedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    }

}, { timestamps: true });

// Indexes
foodSchema.index({ location: "2dsphere" });
foodSchema.index({ status: 1 });
foodSchema.index({ restaurant: 1, status: 1 });

module.exports = mongoose.model("Food", foodSchema);