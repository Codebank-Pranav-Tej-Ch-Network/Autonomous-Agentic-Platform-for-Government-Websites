require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectToDB = require("./database/db");
const authRoutes = require("./routes/auth-routes");
const homeRoutes = require("./routes/home-routes");
const adminRoutes = require("./routes/admin-routes");

// ✅ Connect to database
connectToDB();

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ Enable JSON parsing & CORS
app.use(express.json());
app.use(cors({ origin: "http://localhost:5173", credentials: true }));

// ✅ Test route (to check connection)
app.get("/api/test", (req, res) => {
  res.json({ success: true, message: "Backend is reachable ✅" });
});

// ✅ Routes
app.use("/api/auth", authRoutes);
app.use("/api/home", homeRoutes);
app.use("/api/admin", adminRoutes);

// ✅ Start server
app.listen(PORT, () => {
  console.log(`🚀 Server is now listening on PORT ${PORT}`);
});
