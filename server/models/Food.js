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
        enum: ["cooked", "raw", "packaged", "beverages", "other"],
        maxlength: [100, "Food type cannot exceed 100 characters"]
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
        enum: ["active", "reserved", "picked", "delivered", "expired"],
        default: "active"
    },

    // ✅ Correct GeoJSON location structure
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
        type: String
    }

},
{ timestamps: true }
);

// 🌍 Geo index for nearby search
foodSchema.index({ location: "2dsphere" });

// Other indexes
foodSchema.index({ status: 1 });
foodSchema.index({ restaurant: 1, status: 1 });
foodSchema.index({ predictedExpiry: 1 });

module.exports = mongoose.model("Food", foodSchema);