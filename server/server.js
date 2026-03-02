const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const authRoutes = require("./routes/authRoutes");

const app = express();   // ✅ MUST COME BEFORE app.use()

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);  // ✅ Now it's safe

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