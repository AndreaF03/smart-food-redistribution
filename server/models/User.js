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
        validate: {
            validator: (v) => validator.isEmail(v),
            message: "Please enter a valid email"
        }
    },

    password: {
        type: String,
        required: [true, "Password is required"],
        minlength: [8, "Password must be at least 8 characters"],
        select: false
    },

    role: {
        type: String,
        enum: ["restaurant", "ngo", "admin"],
        default: "ngo"
    },

    /* ==========================
       GeoJSON Location
    ========================== */

    location: {

        type: {
            type: String,
            enum: ["Point"],
            default: "Point"
        },

        coordinates: {
            type: [Number],

            validate: {
                validator: function (v) {

                    if (!v) return true;

                    if (v.length !== 2) return false;

                    const [lng, lat] = v;

                    return (
                        lng >= -180 &&
                        lng <= 180 &&
                        lat >= -90 &&
                        lat <= 90
                    );
                },

                message: "Coordinates must be [longitude, latitude]"
            }

        },

        address: {
            type: String,
            trim: true
        }

    }

}, { timestamps: true });


/* ==========================
   Geo Index (Sparse)
========================== */

userSchema.index(
    { location: "2dsphere" },
    { sparse: true }
);


module.exports = mongoose.model("User", userSchema);