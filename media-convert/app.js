const express = require("express");
var bodyParser = require("body-parser");
const configureOpenTelemetry = require("./opentelemetry");
const { context, propagation, trace } = require("@opentelemetry/api");
const opentelemetry = require("@opentelemetry/api");

configureOpenTelemetry("media-convert-service");

const app = express();
app.use(bodyParser.json());

const PORT = 3002;

const mediaConvertTracer = trace.getTracer("media-convert-tracer", "1.0");

app.post("/convert", async (req, res) => {
  console.log("headers", req.headers);
  const previousContext = JSON.parse(req.headers.contextinfo);
  const activeContext = propagation.extract(context.active(), previousContext);

  let span = mediaConvertTracer.startSpan(
    "convertMedia",
    {
      attributes: {},
    },
    activeContext
  );

  trace.setSpan(context.active(), span);

  try {
    for (const key in req.body) {
      span.setAttribute(key, String(req.body[key]));
    }

    return res.status(200).send("Media converted successfully");
  } catch (error) {
    span.setStatus({
      code: opentelemetry.SpanStatusCode.ERROR,
      message: error.message,
    });
    return res.status(500).send("Media convert failed");
  } finally {
    span.end();
  }
});

app.listen(PORT, () => {
  console.log(`Mediaconvert is running on port ${PORT}`);
});
