const express = require("express");
const mongoose = require("mongoose");
const mediaRoutes = require("./routes/mediaRoutes");
const configureOpenTelemetry = require("./opentelemetry");

require("dotenv").config();

const app = express();
const PORT = 3001;

configureOpenTelemetry("media-uploader-service");

// app.use("/upload", (req, res, next) => {
//   // console.log("upload endpoint middleware");
//   // console.log("traceProvider", traceProvider);
//   // const tracer = traceProvider.getTracer("media-uploader-tracer");
//   // const span = tracer.startSpan("upload-endpoint");

//   const tracer = opentelemetry.trace.getTracer("media-uploader-tracer", "1.0");

//   span.setAttribute("raw-endpoint", req.originalUrl);

//   context.with(trace.setSpan(context.active(), span), () => {
//     next();
//   });
// });

mongoose.connect("mongodb://mongo:27017/opentel");
app.set("view engine", "ejs");

app.use("/", mediaRoutes);

app.listen(PORT, () => {
  console.log(`MediaUploader is running on port ${PORT}`);
});
