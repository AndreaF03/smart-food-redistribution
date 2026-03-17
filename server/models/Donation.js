const mongoose = require("mongoose");

const donationSchema = new mongoose.Schema(
  {
    restaurant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Restaurant is required"],
    },
    foodName: {
      type: String,
      required: [true, "Food name is required"],
      trim: true,
      maxlength: [100, "Food name cannot exceed 100 characters"],
    },
    quantity: {
      type: String, // Changed to string or stay number? Usually "2kg" or "5 boxes" is better as String, but Number is fine for calculations.
      required: [true, "Quantity is required"],
    },
    pickupLocation: {
      type: String,
      required: [true, "Pickup location address is required"],
    },
    // ADDED: GeoJSON for the 10km radius push notifications
    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: [true, "Coordinates are required for nearby notifications"],
      },
    },
    expiryTime: {
      type: Date,
      required: [true, "Expiry time is required"],
      validate: {
        validator: function (value) {
          return value > new Date();
        },
        message: "Expiry time must be in the future",
      },
    },
    image: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: ["available", "reserved", "picked", "delivered", "expired"],
      default: "available",
    },
    claimedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

/* =============================
   Indexes
============================= */
donationSchema.index({ location: "2dsphere" }); // CRITICAL for $near queries
donationSchema.index({ status: 1 });
donationSchema.index({ restaurant: 1 });
donationSchema.index({ createdAt: -1 });
donationSchema.index({ expiryTime: 1 });

/* =============================
   Auto-expire logic
============================= */
donationSchema.pre("save", function (next) {
  if (this.expiryTime && this.expiryTime < new Date()) {
    this.status = "expired";
  }
  next();
});

donationSchema.pre("findOneAndUpdate", function (next) {
  const update = this.getUpdate();
  // If the user is updating the expiryTime to a past date
  if (update.expiryTime && new Date(update.expiryTime) < new Date()) {
    update.status = "expired";
  }
  next();
});

module.exports = mongoose.model("Donation", donationSchema);