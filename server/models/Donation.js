const mongoose = require("mongoose");

const donationSchema = new mongoose.Schema(
  {
    restaurant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Restaurant is required"]
    },

    foodName: {
      type: String,
      required: [true, "Food name is required"],
      trim: true,
      maxlength: [100, "Food name cannot exceed 100 characters"]
    },

    // Fixed: Number instead of String
    quantity: {
      type: Number,
      required: [true, "Quantity is required"],
      min: [1, "Quantity must be at least 1"]
    },

    // Fixed: GeoJSON for geospatial support
    pickupLocation: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point"
      },
      coordinates: {
        type: [Number],
        required: [true, "Pickup coordinates are required"]
      },
      address: {
        type: String,
        trim: true
      }
    },

    // Fixed: required at schema level
    expiryTime: {
      type: Date,
      required: [true, "Expiry time is required"]
    },

    status: {
      type: String,
      // Fixed: added "delivered" and "expired"
      enum: ["available", "reserved", "picked", "delivered", "expired"],
      default: "available"
    },

    claimedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    }

  },
  {
    timestamps: true
  }
);

// 2dsphere index for geospatial queries on pickupLocation
donationSchema.index({ pickupLocation: "2dsphere" });

// Index for efficient status filtering
donationSchema.index({ status: 1 });

// Index for restaurant lookups
donationSchema.index({ restaurant: 1 });

module.exports = mongoose.model("Donation", donationSchema);