const jwt = require("jsonwebtoken");
const User = require("../models/User");

/* =========================
   Protect Route
========================= */
const protect = async (req, res, next) => {
  try {
    let token;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer ")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token || token.length < 20) {
      return res.status(401).json({ message: "Not authorized, token missing or invalid" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id).select("-password").lean();

    if (!user) {
      return res.status(401).json({ message: "User no longer exists" });
    }

    if (user.passwordChangedAt) {
      const changedTimestamp = parseInt(user.passwordChangedAt.getTime() / 1000, 10);
      if (decoded.iat < changedTimestamp) {
        return res.status(401).json({
          message: "Password recently changed. Please log in again."
        });
      }
    }

    req.user = user;
    next();
  } catch (error) {
    console.error("AUTH ERROR:", error.name, error.message);

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Session expired" });
    }

    return res.status(401).json({ message: "Not authorized" });
  }
};

/* =========================
   Admin Only
========================= */
const adminOnly = (req, res, next) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Admin access only" });
  }
  next();
};

/* =========================
   Role Authorization
========================= */
const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: `Role (${req.user.role}) not allowed`
      });
    }

    next();
  };
};


module.exports = {
  protect,
  adminOnly,
  authorizeRoles
};