const mongoose = require("mongoose");

const foodSchema = new mongoose.Schema(
{
    restaurant: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: [true, "Restaurant is required"]
    },

    foodType: {
        type: String,
        required: [true, "Food type is required"],
        trim: true,
        enum: ["cooked", "raw", "packaged", "beverages", "other"]
    },

    quantity: {
        type: Number,
        required: [true, "Quantity is required"],
        min: [1, "Quantity must be at least 1"]
    },

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
        enum: ["available", "reserved", "picked", "delivered", "expired"],
        default: "available"
    },

    /* ==========================
       GeoJSON Location
    ========================== */

    location: {
        type: {
            type: String,
            enum: ["Point"],
            default: "Point",
            required: true
        },
        coordinates: {
            type: [Number], // [longitude, latitude]
            required: true,
            validate: {
                validator: function (v) {
                    return v.length === 2;
                },
                message: "Coordinates must be [longitude, latitude]"
            }
        },
        address: {
            type: String,
            trim: true
        }
    },

    reservedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },

    reservedAt: {
        type: Date
    },

    deliveredAt: {
        type: Date
    },

    image: {
        type: String,
        default: ""
    }

},
{ timestamps: true }
);


/* ==========================
   Indexes
========================== */

// 🌍 Geo index for nearby food search
foodSchema.index({ location: "2dsphere" });

// Query optimization
foodSchema.index({ status: 1 });
foodSchema.index({ restaurant: 1, status: 1 });

// Expiry monitoring
foodSchema.index({ predictedExpiry: 1 });

// NGO dashboard queries
foodSchema.index({ reservedBy: 1, status: 1 });

// Delivery analytics
foodSchema.index({ deliveredAt: 1 });


module.exports = mongoose.model("Food", foodSchema);