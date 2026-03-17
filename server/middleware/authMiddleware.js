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

    // Checking for token existence and a reasonable minimum length
    if (!token || token.length < 20) {
      return res.status(401).json({ message: "Not authorized, token missing or invalid" });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Fetch user (lean for speed, password excluded for security)
    const user = await User.findById(decoded.id).select("-password").lean();

    if (!user) {
      return res.status(401).json({ message: "The user belonging to this token no longer exists" });
    }

    /* Check if password changed after token was issued */
    if (user.passwordChangedAt) {
      const changedTimestamp = parseInt(user.passwordChangedAt.getTime() / 1000, 10);
      
      // If token issued time (iat) is less than password change time
      if (decoded.iat < changedTimestamp) {
        return res.status(401).json({
          message: "User recently changed password! Please log in again."
        });
      }
    }

    // Attach user to the request object
    req.user = user;
    next();
  } catch (error) {
    console.error("AUTH ERROR:", error.name, error.message);

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Session expired, please log in again" });
    }
    
    return res.status(401).json({ message: "Not authorized, token failed" });
  }
};

/* =========================
   Role Authorization
========================= */
exports.authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: `Role (${req.user.role}) is not authorized to access this resource`
      });
    }

    next();
  };
};