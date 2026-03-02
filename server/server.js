const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const authRoutes = require("./routes/authRoutes");
const foodRoutes = require("./routes/foodRoutes");
const { protect } = require("./middleware/authMiddleware");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/food", foodRoutes);

app.get("/api/protected", protect, (req, res) => {
    res.json({
        message: "Protected route working",
        user: req.user
    });
});

const PORT = process.env.PORT || 5000;

mongoose.connect(process.env.MONGO_URI)
.then(() => console.log("MongoDB Connected"))
.catch((err) => console.log(err));

app.get("/", (req, res) => {
    res.send("API Running...");
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});