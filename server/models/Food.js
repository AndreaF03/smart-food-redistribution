const mongoose = require("mongoose");

const foodSchema = new mongoose.Schema({
    restaurant: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: [true, "Restaurant is required"]
    },

    // Fixed: added enum + maxlength
    foodType: {
        type: String,
        required: [true, "Food type is required"],
        trim: true,
        enum: ["cooked", "raw", "packaged", "beverages", "other"],
        maxlength: [100, "Food type cannot exceed 100 characters"]
    },

    quantity: {
        type: Number,
        required: [true, "Quantity is required"],
        min: [1, "Quantity must be at least 1"]
    },

    // Fixed: added future-date validator
    cookedTime: {
        type: Date,
        required: [true, "Cooked time is required"],
        validate: {
            validator: (v) => v <= new Date(),
            message: "Cooked time cannot be in the future"
        }
    },

    storageType: {
        type: String,
        enum: ["room", "refrigerated"],
        required: [true, "Storage type is required"]
    },

    // Fixed: now required instead of relying on default
    freshnessScore: {
        type: Number,
        required: [true, "Freshness score is required"],
        min: [0, "Freshness score cannot be negative"],
        max: [100, "Freshness score cannot exceed 100"]
    },

    predictedExpiry: {
        type: Date,
        required: [true, "Predicted expiry is required"]
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
            required: [true, "Location coordinates are required"]
        }
    },

    reservedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },

    // Added: reservation and delivery timestamps for analytics
    reservedAt: {
        type: Date
    },

    deliveredAt: {
        type: Date
    }

}, { timestamps: true });

// Indexes
foodSchema.index({ location: "2dsphere" });
foodSchema.index({ status: 1 });
foodSchema.index({ restaurant: 1, status: 1 });
// Fixed: index for auto-expire query performance
foodSchema.index({ predictedExpiry: 1 });

module.exports = mongoose.model("Food", foodSchema);