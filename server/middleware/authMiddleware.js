const jwt = require("jsonwebtoken");
const User = require("../models/User");

/* =========================
   Protect Route
========================= */

exports.protect = async (req, res, next) => {

  try {

    let token;

    // Fixed: "Bearer " with space to prevent "Bearertoken" matching
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer ")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return res.status(401).json({
        message: "Not authorized, no token"
      });
    }

    // Guard against missing JWT_SECRET
    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET is not defined in environment variables");
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id).select("-password");

    if (!user) {
      return res.status(401).json({
        message: "User no longer exists"
      });
    }

    req.user = user;
    next();

  } catch (error) {

    console.error("AUTH ERROR:", error);

    // Distinguish between expired and invalid token
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        message: "Token has expired, please log in again"
      });
    }

    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        message: "Invalid token, please log in again"
      });
    }

    res.status(401).json({
      message: "Not authorized"
    });
  }
};


/* =========================
   Role Authorization
========================= */

exports.authorizeRoles = (...roles) => {

  return (req, res, next) => {

    // Guard against protect middleware not being applied
    if (!req.user) {
      return res.status(401).json({
        message: "Not authenticated"
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: `Access denied: requires one of [${roles.join(", ")}]`
      });
    }

    next();
  };
};