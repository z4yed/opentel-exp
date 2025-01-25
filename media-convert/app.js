const {
  MediaConvertClient,
  CreateJobCommand,
} = require("@aws-sdk/client-mediaconvert");
const express = require("express");
const bodyParser = require("body-parser");
const configureOpenTelemetry = require("./opentelemetry");
const { context, propagation, trace } = require("@opentelemetry/api");
require("dotenv").config();

configureOpenTelemetry("media-convert-service");

const app = express();
app.use(bodyParser.json());

const PORT = 3002;
const mediaconvertClient = new MediaConvertClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const mediaConvertTracer = trace.getTracer("media-convert-tracer", "1.0");

app.post("/convert", async (req, res) => {
  console.log("Headers:", req.headers);
  const previousContext = JSON.parse(req.headers.contextinfo);
  const activeContext = propagation.extract(context.active(), previousContext);

  let span = mediaConvertTracer.startSpan(
    "convertMedia",
    { attributes: {} },
    activeContext
  );

  trace.setSpan(context.active(), span);

  try {
    const { bucket, key, mediaId } = req.body;

    if (!bucket || !key || !mediaId) {
      throw new Error("Missing required parameters: bucket, key, or mediaId.");
    }

    span.setAttribute("bucket", bucket);
    span.setAttribute("key", key);
    span.setAttribute("mediaId", mediaId);

    // Load and modify the job.json file
    const jobConfig = require("./job.json");

    // Update the input file
    jobConfig.Settings.Inputs[0].FileInput = `s3://${bucket}/${key}`;

    // Update HLS output destination
    jobConfig.Settings.OutputGroups[0].OutputGroupSettings.HlsGroupSettings.Destination = `s3://${bucket}/${mediaId}/HLS`;

    // Update thumbnail output destination
    jobConfig.Settings.OutputGroups[1].OutputGroupSettings.FileGroupSettings.Destination = `s3://${bucket}/${mediaId}/Thumbnails`;

    // Create the MediaConvert job
    const command = new CreateJobCommand(jobConfig);
    const response = await mediaconvertClient.send(command);

    console.log("MediaConvert Job Response:", response);
    span.setAttribute("MediaConvertJobId", response.Job.Id);

    res.status(200).send("Media conversion job submitted successfully.");
  } catch (error) {
    span.setStatus({
      code: 2, // ERROR
      message: error.message,
    });
    console.error("Error submitting MediaConvert job:", error);
    res.status(500).send(`Media conversion failed: ${error.message}`);
  } finally {
    span.end();
  }
});

app.listen(PORT, () => {
  console.log(`Media Convert Service running on port ${PORT}`);
});
