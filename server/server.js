const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const http = require("http");
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");

const authRoutes = require("./routes/authRoutes");

const foodRoutes = require("./routes/foodRoutes");
const ratingRoutes = require("./routes/ratingRoutes");

const { notFound, errorHandler } = require("./middleware/errorMiddleware");
const { initSocket } = require("./socket");
const { startExpireJob } = require("./jobs/expireFood");


// =============================
// ENV VALIDATION
// =============================

const requiredEnvVars = [
  "MONGO_URI",
  "JWT_SECRET",
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET"
];

requiredEnvVars.forEach((key) => {
  if (!process.env[key]) {
    console.error(`FATAL ERROR: Missing environment variable ${key}`);
    process.exit(1);
  }
});


// =============================
// APP INITIALIZATION
// =============================

const app = express();
const server = http.createServer(app);


// =============================
// SECURITY MIDDLEWARE
// =============================

app.use(helmet());


// =============================
// CORS CONFIG
// =============================

const allowedOrigins =
  process.env.NODE_ENV === "production"
    ? [
        process.env.CLIENT_URL,
        `https://www.${process.env.CLIENT_URL?.replace("https://", "")}`
      ]
    : ["http://localhost:3000"];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS blocked: ${origin}`));
      }
    },
    credentials: true
  })
);

app.use(express.json({ limit: "10kb" }));


// =============================
// MONGODB INJECTION PROTECTION
// =============================

app.use((req, res, next) => {
  const hasDangerousKeys = (obj) => {
    if (obj && typeof obj === "object") {
      for (const key of Object.keys(obj)) {
        if (/^\$/.test(key) || /\./.test(key)) return true;
        if (hasDangerousKeys(obj[key])) return true;
      }
    }
    return false;
  };

  if (hasDangerousKeys(req.body) || hasDangerousKeys(req.query)) {
    return res.status(400).json({
      message: "Invalid characters in request"
    });
  }

  next();
});


// =============================
// XSS SANITIZER
// =============================

app.use((req, res, next) => {
  const sanitizeXSS = (obj) => {
    if (obj && typeof obj === "object") {
      for (const key of Object.keys(obj)) {
        if (typeof obj[key] === "string") {
          obj[key] = obj[key]
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
        } else {
          sanitizeXSS(obj[key]);
        }
      }
    }
  };

  sanitizeXSS(req.body);
  sanitizeXSS(req.query);

  next();
});


// =============================
// HEALTH CHECK (for Docker/Railway)
// =============================

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    db: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    uptime: process.uptime()
  });
});


// =============================
// ROUTES
// =============================

app.use("/api/auth", authRoutes);
app.use("/api/food", foodRoutes);
app.use("/api/ratings", ratingRoutes);


// =============================
// ERROR HANDLING
// =============================

app.use(notFound);
app.use(errorHandler);


// =============================
// SOCKET.IO (AFTER MIDDLEWARE)
// =============================
const io = initSocket(server, allowedOrigins);

// Middleware to make socket accessible in all routes via req.io
app.use((req, res, next) => {
  req.io = io;
  next();
});
// =============================
// DATABASE CONNECTION
// =============================

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB Connected");

    startExpireJob(); // Start background job after DB is ready
  })
  .catch((err) => {
    console.error("MongoDB connection failed:", err);
    process.exit(1);
  });


// Mongo runtime errors

mongoose.connection.on("error", (err) => {
  console.error("MongoDB runtime error:", err);
});

mongoose.connection.on("disconnected", () => {
  console.warn("MongoDB disconnected — attempting reconnect...");
});


// =============================
// START SERVER
// =============================

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});


// =============================
// GRACEFUL SHUTDOWN
// =============================

const shutdown = async (signal) => {
  console.log(`${signal} received — shutting down gracefully`);

  server.close(async () => {
    await mongoose.connection.close();
    console.log("MongoDB connection closed");
    process.exit(0);
  });

  setTimeout(() => {
    console.error("Forced shutdown after timeout");
    process.exit(1);
  }, 10000);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));


// =============================
// GLOBAL ERROR HANDLERS
// =============================

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Promise Rejection:", reason);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
  process.exit(1);
});