const mongoose = require("mongoose");
const validator = require("validator");
const bcrypt = require("bcryptjs"); // ADDED

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, "Name is required"],
        trim: true,
        minlength: [2, "Name must be at least 2 characters"],
        maxlength: [100, "Name cannot exceed 100 characters"]
    },
    email: {
        type: String,
        required: [true, "Email is required"],
        unique: true,
        lowercase: true,
        trim: true,
        validate: {
            validator: (v) => validator.isEmail(v),
            message: "Please enter a valid email"
        }
    },
    password: {
        type: String,
        required: [true, "Password is required"],
        minlength: [8, "Password must be at least 8 characters"],
        select: false // Ensures password isn't leaked in queries
    },
    role: {
        type: String,
        enum: ["restaurant", "ngo", "admin"],
        default: "ngo"
    },
    passwordChangedAt: Date, // ADDED: Required for your authMiddleware logic
    location: {
        type: {
            type: String,
            enum: ["Point"],
            default: "Point"
        },
        coordinates: {
            type: [Number],
            default: undefined,
            validate: {
                validator: function (v) {
                    if (!v) return true;
                    if (v.length !== 2) return false;
                    const [lng, lat] = v;
                    return (lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90);
                },
                message: "Coordinates must be [longitude, latitude]"
            }
        },
        address: { type: String, trim: true }
    }
}, { timestamps: true });

/* ==========================
   Security Hooks & Methods
========================== */

// 1. Hash password before saving
userSchema.pre("save", async function(next) {
    // Only run this if password was actually modified
    if (!this.isModified("password")) return next();

    // Hash the password with cost of 12
    this.password = await bcrypt.hash(this.password, 12);

    // Update passwordChangedAt if the document isn't new
    if (!this.isNew) {
        this.passwordChangedAt = Date.now() - 1000; // -1s ensures token is created after change
    }
    next();
});

// 2. Instance method to compare passwords
userSchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

/* ==========================
   Indexes
========================== */
userSchema.index({ location: "2dsphere" }, { sparse: true });
userSchema.index({ role: 1 });

module.exports = mongoose.model("User", userSchema);