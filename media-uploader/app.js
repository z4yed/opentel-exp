const express = require("express");
const mongoose = require("mongoose");
const mediaRoutes = require("./routes/mediaRoutes");
const configureOpenTelemetry = require("./opentelemetry");

require("dotenv").config();

const app = express();
const PORT = 3001;

configureOpenTelemetry("media-uploader-service");

mongoose.connect("mongodb://mongo:27017/opentel");
app.set("view engine", "ejs");

app.use("/", mediaRoutes);

app.listen(PORT, () => {
  console.log(`MediaUploader is running on port ${PORT}`);
});
