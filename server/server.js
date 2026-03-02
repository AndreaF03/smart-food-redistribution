const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;

// Better MongoDB Connection Setup
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 10000, // fail fast
      tls: true,                       // required for Atlas when using mongodb://
    });

    console.log("✅ MongoDB Connected Successfully");
  } catch (error) {
    console.error("❌ MongoDB Connection Error:");
    console.error(error.message);
    process.exit(1); // stop server if DB fails
  }
};

connectDB();

app.get("/", (req, res) => {
  res.send("API Running...");
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});