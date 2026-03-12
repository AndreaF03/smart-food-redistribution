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
      max: 5
    },
    comment: {
      type: String,
      maxlength: 300,
      default: ""
    }
  },
  { timestamps: true }
);

// One rating per food delivery — restaurant can't rate same delivery twice
ratingSchema.index({ restaurant: 1, food: 1 }, { unique: true });

module.exports = mongoose.model("Rating", ratingSchema);