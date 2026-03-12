const mongoose = require("mongoose");

const ratingSchema = new mongoose.Schema(
{
  restaurant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },

  ngo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },

  food: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Food",
    required: true
  },

  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5,
    validate: {
      validator: Number.isInteger,
      message: "Rating must be a whole number between 1 and 5"
    }
  },

  comment: {
    type: String,
    trim: true,
    maxlength: [300, "Comment cannot exceed 300 characters"]
  }

},
{ timestamps: true }
);


/* ==========================
   Indexes
========================== */

// Prevent duplicate ratings for same delivery
ratingSchema.index({ restaurant: 1, food: 1 }, { unique: true });

// Fast NGO rating lookup
ratingSchema.index({ ngo: 1 });


module.exports = mongoose.model("Rating", ratingSchema);