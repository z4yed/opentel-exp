const express = require("express");
const mongoose = require("mongoose");
const mediaRoutes = require("./routes/mediaRoutes");
require("dotenv").config();

const app = express();
const PORT = 3001;

mongoose.connect("mongodb://mongo:27017/opentel");
app.set("view engine", "ejs");

app.use("/", mediaRoutes);

app.listen(PORT, () => {
  console.log(`MediaUploader is running on port ${PORT}`);
});
