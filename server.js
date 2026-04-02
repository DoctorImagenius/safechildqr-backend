require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const errorMiddleware = require("./middlewares/errorMiddleware");
const authRoutes = require("./routes/auth");
const parentRoutes = require("./routes/parent");
const childRoutes = require("./routes/child");
const scanRoutes = require("./routes/scan");
const connectDB = require("./config/db");


connectDB()

const app = express();
app.use(express.json());
app.use(cors());

app.use("/auth", authRoutes);
app.use("/parent", parentRoutes);
app.use("/child", childRoutes);
app.use("/scan", scanRoutes)

// -------------------- ERROR HANDLER --------------------
app.use(errorMiddleware);

// -------------------- SERVER --------------------
app.listen(process.env.PORT || 5000, () => console.log(`Server running on port ${process.env.PORT || 5000}`));