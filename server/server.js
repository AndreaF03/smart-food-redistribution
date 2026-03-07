const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
require("dotenv").config();

const authRoutes = require("./routes/authRoutes");
const foodRoutes = require("./routes/foodRoutes");
const { protect } = require("./middleware/authMiddleware");
const { notFound, errorHandler } = require("./middleware/errorMiddleware");

const app = express();

/* =========================
   Security Middleware
========================= */
app.use(helmet());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 100,
  message: "Too many requests, please try again later."
});

app.use(limiter);

/* =========================
   Core Middleware
========================= */
app.use(cors({
  origin: "http://localhost:3000",
  credentials: true
}));

app.use(express.json());

/* =========================
   Routes
========================= */
app.use("/api/auth", authRoutes);
app.use("/api/food", foodRoutes);

app.get("/api/protected", protect, (req, res) => {
  res.json({
    message: "Protected route working",
    user: req.user
  });
});

app.get("/", (req, res) => {
  res.send("API Running...");
});

/* =========================
   Error Handling Middleware
========================= */
app.use(notFound);
app.use(errorHandler);

/* =========================
   Database Connection
========================= */
const PORT = process.env.PORT || 5000;

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB Connected");

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });

  })
  .catch((err) => {
    console.error("Database connection failed:", err.message);
    process.exit(1);
  });