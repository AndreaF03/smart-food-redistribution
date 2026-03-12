require("dotenv").config();
const http = require("http");
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");

const authRoutes     = require("./routes/authRoutes");
const donationRoutes = require("./routes/donationRoutes");
const foodRoutes     = require("./routes/foodRoutes");

const { notFound, errorHandler } = require("./middleware/errorMiddleware");
const { initSocket }   = require("./socket");
const { startExpireJob } = require("./jobs/expireFood");   // ← NEW

const app    = express();
const server = http.createServer(app);

initSocket(server);

/* ==========================
   Security Middleware
========================== */
app.use(helmet());

app.use(cors({
  origin: process.env.NODE_ENV === "production"
    ? process.env.CLIENT_URL
    : "http://localhost:3000",
  credentials: true
}));

app.use(express.json({ limit: "10kb" }));

// MongoDB sanitizer
app.use((req, res, next) => {
  const sanitize = (obj) => {
    if (obj && typeof obj === "object") {
      for (const key of Object.keys(obj)) {
        if (/^\$/.test(key) || /\./.test(key)) {
          delete obj[key];
        } else {
          sanitize(obj[key]);
        }
      }
    }
  };
  sanitize(req.body);
  sanitize(req.query);
  sanitize(req.params);
  next();
});

// XSS sanitizer
app.use((req, res, next) => {
  const sanitizeXSS = (obj) => {
    if (obj && typeof obj === "object") {
      for (const key of Object.keys(obj)) {
        if (typeof obj[key] === "string") {
          obj[key] = obj[key].replace(/</g, "&lt;").replace(/>/g, "&gt;");
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

/* ==========================
   Routes
========================== */
app.use("/api/auth",      authRoutes);
app.use("/api/donations", donationRoutes);
app.use("/api/food",      foodRoutes);

/* ==========================
   Error Handling
========================== */
app.use(notFound);
app.use(errorHandler);

/* ==========================
   MongoDB
========================== */
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB Connected");
    startExpireJob();   // ← NEW: start only after DB is ready
  })
  .catch((err) => {
    console.error("MongoDB connection failed:", err);
    process.exit(1);
  });

/* ==========================
   Server
========================== */
const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});