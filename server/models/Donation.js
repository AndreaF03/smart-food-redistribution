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

    quantity: {
      type: Number,
      required: [true, "Quantity is required"],
      min: [1, "Quantity must be at least 1"]
    },

    pickupLocation: {
      type: String,
      required: [true, "Pickup location is required"],
      trim: true
    },

    expiryTime: {
      type: Date,
      required: [true, "Expiry time is required"]
    },

    image: {
      type: String,
      default: null
    },

    status: {
      type: String,
      enum: ["available", "reserved", "picked", "delivered", "expired"],
      default: "available"
    },

    claimedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    }
  },
  {
    timestamps: true
  }
);

/* =============================
   Indexes
============================= */

donationSchema.index({ status: 1 });
donationSchema.index({ restaurant: 1 });
donationSchema.index({ createdAt: -1 });

/* =============================
   Auto mark expired donations
============================= */

donationSchema.pre("save", function () {
  if (this.expiryTime && this.expiryTime < new Date()) {
    this.status = "expired";
  }
});

module.exports = mongoose.model("Donation", donationSchema);