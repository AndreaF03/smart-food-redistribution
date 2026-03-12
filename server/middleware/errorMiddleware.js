/* =========================
   404 Not Found Handler
========================= */
exports.notFound = (req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
};


/* =========================
   Global Error Handler
========================= */
exports.errorHandler = (err, req, res, next) => {

  // Always log the full error server-side
  console.error("SERVER ERROR:", err);

  let statusCode = err.statusCode || (res.statusCode === 200 ? 500 : res.statusCode);
  let message = err.message || "Server Error";


  /* =========================
     Mongoose CastError
     (invalid ObjectId)
  ========================= */
  if (err.name === "CastError") {
    statusCode = 400;

    message =
      process.env.NODE_ENV === "production"
        ? "Invalid ID format"
        : `Invalid ${err.path}: ${err.value}`;
  }


  /* =========================
     Duplicate Key Error
  ========================= */
  if (err.code === 11000) {
    statusCode = 409;

    message =
      process.env.NODE_ENV === "production"
        ? "An account with these details already exists"
        : `Duplicate value for: ${Object.keys(err.keyValue).join(", ")}`;
  }


  /* =========================
     Mongoose Validation Error
  ========================= */
  if (err.name === "ValidationError") {
    statusCode = 400;

    message = Object.values(err.errors)
      .map((e) => e.message)
      .join(", ");
  }


  /* =========================
     JWT Errors
  ========================= */
  if (err.name === "JsonWebTokenError") {
    statusCode = 401;
    message = "Invalid token";
  }

  if (err.name === "TokenExpiredError") {
    statusCode = 401;
    message = "Token has expired, please log in again";
  }


  /* =========================
     Multer Upload Errors
  ========================= */
  if (err.name === "MulterError") {
    statusCode = 400;

    message =
      err.code === "LIMIT_FILE_SIZE"
        ? "File too large. Maximum size is 5MB"
        : `Upload error: ${err.message}`;
  }


  /* =========================
     MongoDB Network Errors
  ========================= */
  if (
    err.name === "MongoNetworkError" ||
    err.name === "MongoServerSelectionError"
  ) {
    statusCode = 503;
    message = "Database unavailable, please try again later";
  }


  res.status(statusCode).json({
    success: false,
    message,

    // Show stack only in development
    ...(process.env.NODE_ENV !== "production" && { stack: err.stack })
  });
};