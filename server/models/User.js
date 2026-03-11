const mongoose = require("mongoose");
const validator = require("validator");

const userSchema = new mongoose.Schema({

    name: {
        type: String,
        required: [true, "Name is required"],
        trim: true,
        maxlength: [100, "Name cannot exceed 100 characters"]
    },

    email: {
        type: String,
        required: [true, "Email is required"],
        unique: true,
        lowercase: true,
        trim: true,
        // Fixed: proper email validation
        validate: {
            validator: (v) => validator.isEmail(v),
            message: "Please enter a valid email"
        }
    },

    password: {
        type: String,
        required: [true, "Password is required"],
        // Fixed: 8 instead of 6
        minlength: [8, "Password must be at least 8 characters"],
        select: false
    },

    role: {
        type: String,
        enum: ["restaurant", "ngo", "admin"],
        // Fixed: safe default so client never needs to send role
        default: "ngo"
    },

    location: {
        type: {
            type: String,
            enum: ["Point"],
            default: "Point"
        },
        // Fixed: no default coordinates — location is optional
        coordinates: {
            type: [Number]
        }
    }

}, { timestamps: true });

/* ==========================
   Geo index — sparse so documents
   without location are excluded
========================== */
userSchema.index({ location: "2dsphere" }, { sparse: true });

module.exports = mongoose.model("User", userSchema);