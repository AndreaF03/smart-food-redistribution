const jwt = require("jsonwebtoken");
const User = require("../models/User");

/* =========================
   Protect Route
========================= */

exports.protect = async (req, res, next) => {

  try {

    let token;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer ")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token || token.length < 20) {
      return res.status(401).json({
        message: "Invalid token format"
      });
    }

    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET is not defined in environment variables");
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    /* Fetch user (lean object for performance) */
    const user = await User.findById(decoded.id)
      .select("-password")
      .lean();

    if (!user) {
      return res.status(401).json({
        message: "User no longer exists"
      });
    }

    /* Check if password changed after token issued */
    if (user.passwordChangedAt) {
      const changedAt = parseInt(user.passwordChangedAt.getTime() / 1000);

      if (decoded.iat < changedAt) {
        return res.status(401).json({
          message: "Password was recently changed, please log in again"
        });
      }
    }

    req.user = user;

    next();

  } catch (error) {

    console.error("AUTH ERROR:", error);

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

    if (!req.user) {
      console.error("authorizeRoles called without protect middleware");

      return res.status(401).json({
        message: "Not authenticated — protect middleware missing on this route"
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