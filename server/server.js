const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
require("dotenv").config();

const authRoutes = require("./routes/authRoutes");
const donationRoutes = require("./routes/donationRoutes");
const foodRoutes = require("./routes/foodRoutes");

const { notFound, errorHandler } = require("./middleware/errorMiddleware");

const app = express();

/* ==========================
   Security Middleware
========================== */
// Secure HTTP headers
app.use(helmet());

// Restrict CORS to frontend origin
app.use(cors({
  origin: process.env.NODE_ENV === "production"
    ? process.env.CLIENT_URL
    : "http://localhost:3000",
  credentials: true
}));

// Limit payload size to prevent DoS
app.use(express.json({ limit: "10kb" }));
// Manual MongoDB sanitizer — strips $ and . from keys
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
// Manual XSS sanitizer — strips HTML tags from string values
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
app.use("/api/auth", authRoutes);
app.use("/api/donations", donationRoutes);
// Fixed: foodRoutes was missing entirely
app.use("/api/food", foodRoutes);

/* ==========================
   Error Handling
========================== */
// Fixed: 404 and global error handler were never registered
app.use(notFound);
app.use(errorHandler);

/* ==========================
   MongoDB
========================== */
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => {
    // Fixed: log to stderr and exit — server is useless without DB
    console.error("MongoDB connection failed:", err);
    process.exit(1);
  });

/* ==========================
   Server
========================== */
// Fixed: fallback port in case PORT is undefined
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});