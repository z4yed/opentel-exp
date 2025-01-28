const express = require("express");
const path = require("path");
const mongoose = require("mongoose");
const baseRoutes = require("./routes/baseRoutes");
const mediaRoutes = require("./routes/mediaRoutes");
const authRoutes = require("./routes/authRoutes");
const contactRoutes = require("./routes/contactRoutes");
const configureOpenTelemetry = require("./opentelemetry");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const app = express();
const PORT = 3001;
mongoose.connect("mongodb://mongo:27017/opentel");

configureOpenTelemetry("media-uploader-service");

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
const cookieParser = require("cookie-parser");
app.use(cookieParser());

const JWT_SECRET = process.env.JWT_SECRET || "secretSigner";

app.use((req, res, next) => {
  const token =
    req.cookies?.token ||
    (req.headers.authorization && req.headers.authorization.split(" ")[1]);

  if (!token) {
    res.locals.user = null; // No user info if token is missing
    return next(); // Allow non-protected routes to proceed
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET); // Verify the token
    req.user = decoded; // Attach user info to the request object
    res.locals.user = decoded; // Ensure user info is available in views
  } catch (error) {
    res.locals.user = null; // Clear user info if token is invalid
    console.error("Error verifying token:", error.message);
  } finally {
    next(); // Proceed to the next middleware or route
  }
});

app.use("/", baseRoutes);
app.use("/", contactRoutes);
app.use("/", mediaRoutes);
app.use("/auth", authRoutes);

app.listen(PORT, () => {
  console.log(`MediaUploader is running on port ${PORT}`);
});
