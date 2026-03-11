/* =========================
   404 Not Found Handler
========================= */
exports.notFound = (req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  res.status(404);
  next(error);
};


/* =========================
   Global Error Handler
========================= */
exports.errorHandler = (err, req, res, next) => {

  // Always log the full error server-side
  console.error("SERVER ERROR:", err);

  let statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  let message = err.message || "Server Error";

  // Mongoose invalid ObjectId (e.g. /api/food/notanid)
  if (err.name === "CastError") {
    statusCode = 400;
    message = `Invalid ${err.path}: ${err.value}`;
  }

  // Mongoose duplicate key (e.g. duplicate email)
  if (err.code === 11000) {
    statusCode = 409;
    message = `Duplicate value for: ${Object.keys(err.keyValue).join(", ")}`;
  }

  // Mongoose schema validation failure
  if (err.name === "ValidationError") {
    statusCode = 400;
    message = Object.values(err.errors)
      .map((e) => e.message)
      .join(", ");
  }

  // JWT errors (in case they bubble up past authMiddleware)
  if (err.name === "JsonWebTokenError") {
    statusCode = 401;
    message = "Invalid token";
  }

  if (err.name === "TokenExpiredError") {
    statusCode = 401;
    message = "Token has expired, please log in again";
  }

  res.status(statusCode).json({
    success: false,
    message,
    // Cleanly exclude stack in production
    ...(process.env.NODE_ENV !== "production" && { stack: err.stack })
  });
};