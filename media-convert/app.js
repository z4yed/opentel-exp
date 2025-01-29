const axios = require("axios");
const path = require("path");
const {
  MediaConvertClient,
  CreateJobCommand,
  GetJobCommand,
} = require("@aws-sdk/client-mediaconvert");
const express = require("express");
const bodyParser = require("body-parser");
const configureOpenTelemetry = require("./opentelemetry");
const { context, propagation, trace } = require("@opentelemetry/api");
require("dotenv").config();

const { SUBTITLE_GENERATE_SERVICE_ENDPOINT } = require("./constants");

configureOpenTelemetry("media-convert-service");

const app = express();
app.use(bodyParser.json());

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

const PORT = 3002;

const mediaconvertClient = new MediaConvertClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const mediaConvertTracer = trace.getTracer("media-convert-tracer", "1.0");

app.get("/", (req, res) => {
  res.render("index");
});

app.post("/convert", async (req, res) => {
  const previousContext = JSON.parse(req.headers.contextinfo);
  const activeContext = propagation.extract(context.active(), previousContext);

  let span = mediaConvertTracer.startSpan(
    "convert-media-span",
    { attributes: {} },
    activeContext
  );

  trace.setSpan(context.active(), span);

  const payload = {};

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
    jobConfig.Settings.OutputGroups[0].OutputGroupSettings.HlsGroupSettings.Destination = `s3://${bucket}/${mediaId}/HLS/`;

    // Update thumbnail output destination
    jobConfig.Settings.OutputGroups[1].OutputGroupSettings.FileGroupSettings.Destination = `s3://${bucket}/${mediaId}/Thumbnails/`;

    // pass context to the next service
    jobConfig.UserMetadata = {
      ...previousContext,
    };

    // Create the MediaConvert job
    const command = new CreateJobCommand(jobConfig);
    const response = await mediaconvertClient.send(command);

    const jobId = response.Job.Id;
    span.setAttribute("MediaConvertJobId", jobId);

    // check the status of the job every 2 seconds
    const jobDetails = await checkJobStatusEvery2Seconds(jobId);

    payload.mediaConvertJobId = jobId;
    payload.mediaConvertJobStatus = jobDetails.status;

    // if status is complete, trigger subtitle generation
    if (jobDetails.status === "COMPLETE") {
      payload.hlsPlaylistUrl = `${
        process.env.CLOUDFRONT_URL
      }/${mediaId}/HLS/${key.replace(".mp4", "")}.m3u8`;
      payload.thumbnailUrl = `${
        process.env.CLOUDFRONT_URL
      }/${mediaId}/Thumbnails/${key.replace(".mp4", "")}.0000001.jpg`;

      // call the subtitle generation service
      const subtitleGenerationResponse = await axios.post(
        `${SUBTITLE_GENERATE_SERVICE_ENDPOINT}/generate-subtitle`,
        {
          bucket,
          key,
          mediaId,
        },
        {
          headers: {
            ContextInfo: JSON.stringify(previousContext),
          },
        }
      );

      payload.mediaId = mediaId;
      payload.subtitleGenerationStatus = subtitleGenerationResponse.data.status;
      payload.subtitleLanguageCode =
        subtitleGenerationResponse.data.languageCode;
      payload.subtitleFileUrl = subtitleGenerationResponse.data.fileUrl;
    } else {
      payload.subtitleErrorMessage = jobDetails.errorMessage;
    }

    // return payload as JSON response
    res.json({ ...payload });
  } catch (error) {
    span.setStatus({
      code: 2, // ERROR
      message: error.message,
    });
    payload.mediaConvertErrorMessage = error.message;

    console.error("Error submitting MediaConvert job:", error);
    res
      .status(500)
      .send(`An error occurred at media-convert service: ${error.message}`);
  } finally {
    span.end();
  }
});

app.listen(PORT, () => {
  console.log(`Media Convert Service running on port ${PORT}`);
});

async function checkJobStatusEvery2Seconds(jobId) {
  return new Promise((resolve, reject) => {
    let interval = setInterval(async () => {
      try {
        const command = new GetJobCommand({ Id: jobId });
        const response = await mediaconvertClient.send(command);

        console.log("MediaConvert Job Status: ", response.Job.Status);

        if (response.Job.Status === "COMPLETE") {
          console.log("Media conversion job completed.");
          clearInterval(interval);
          resolve({
            status: "COMPLETE",
          });
        } else if (response.Job.Status === "ERROR") {
          console.error(
            "Media conversion job failed: ",
            response.Job.ErrorMessage
          );
          clearInterval(interval);
          resolve({
            status: "ERROR",
            errorMessage: response.Job?.ErrorMessage,
          });
        }
      } catch (error) {
        console.error("Error checking job status: ", error);
        clearInterval(interval);
        reject(error);
      }
    }, 2000);
  });
}
