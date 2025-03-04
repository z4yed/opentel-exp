const path = require("path");
const {
  TranscribeClient,
  StartTranscriptionJobCommand,
  GetTranscriptionJobCommand,
} = require("@aws-sdk/client-transcribe");
const express = require("express");
const bodyParser = require("body-parser");
const configureOpenTelemetry = require("./opentelemetry.js");
const { context, propagation, trace } = require("@opentelemetry/api");
require("dotenv").config();

configureOpenTelemetry("subtitle-generator-service");

const app = express();
app.use(bodyParser.json());

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

const PORT = 3003;

const subtitleGeneratorTracer = trace.getTracer(
  "subtitle-generator-tracer",
  "1.0"
);

app.get("/", (req, res) => {
  res.render("index");
});

app.post("/generate-subtitle", async (req, res) => {
  const previousContext = JSON.parse(req.headers.contextinfo);
  const activeContext = propagation.extract(context.active(), previousContext);

  let mainSpan = subtitleGeneratorTracer.startSpan(
    "generate-subtitle-span",
    { attributes: {} },
    activeContext
  );

  trace.setSpan(context.active(), mainSpan);

  try {
    const { bucket, key, mediaId } = req.body;

    if (!bucket || !key || !mediaId) {
      throw new Error("Missing required parameters: bucket, key, or mediaId.");
    }

    mainSpan.setAttribute("bucket", bucket);
    mainSpan.setAttribute("key", key);
    mainSpan.setAttribute("mediaId", mediaId);

    // span - 2
    let callTranscribeJobSpan = subtitleGeneratorTracer.startSpan(
      "call-transcribe-span",
      { attributes: {} },
      activeContext
    );
    trace.setSpan(context.active(), callTranscribeJobSpan);

    const transcriptionJobResponse = await startTranscriptionJob(
      bucket,
      key,
      mediaId
    );
    callTranscribeJobSpan.setAttribute(
      "job-name",
      transcriptionJobResponse.TranscriptionJob.TranscriptionJobName
    );
    callTranscribeJobSpan.end();

    const transcriptionJobName =
      transcriptionJobResponse.TranscriptionJob.TranscriptionJobName;

    // span - 3
    let checkJobStatusSpan = subtitleGeneratorTracer.startSpan(
      "check-job-status-span",
      { attributes: {} },
      activeContext
    );
    trace.setSpan(context.active(), checkJobStatusSpan);

    const jobStatusAndLanguageCode = await checkJobStatusEverySecond(
      transcriptionJobName
    );
    checkJobStatusSpan.end();

    res.json({
      service: "subtitle-generator",
      mediaId,
      status: jobStatusAndLanguageCode.status,
      languageCode: jobStatusAndLanguageCode.languageCode,
      fileUrl: jobStatusAndLanguageCode.fileUrl,
    });
  } catch (error) {
    mainSpan.setStatus({
      code: 2, // ERROR
      message: error.message,
    });

    console.error("Subtitle generation failed:", error);
    res.status(500).send(`Subtitle generation failed: ${error.message}`);
  } finally {
    mainSpan.end();
  }
});

app.listen(PORT, () => {
  console.log(`Subtitle generator Service running on port ${PORT}`);
});

async function checkJobStatusEverySecond(jobName) {
  return new Promise((resolve, reject) => {
    let interval = setInterval(async () => {
      const client = new TranscribeClient({
        region: process.env.AWS_REGION,
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        },
      });

      try {
        const command = new GetTranscriptionJobCommand({
          TranscriptionJobName: jobName,
        });

        const response = await client.send(command);
        const jobStatus = response.TranscriptionJob.TranscriptionJobStatus;
        console.log("Transcribe Job Status:", jobStatus);

        // "QUEUED" || "IN_PROGRESS" || "FAILED" || "COMPLETED",
        if (jobStatus === "COMPLETED") {
          console.log("Transcription job completed successfully.");
          clearInterval(interval);

          const fileUrl =
            response.TranscriptionJob?.Subtitles?.SubtitleFileUris[0];

          // split by bucket name and get relative path
          const relativePath = fileUrl.split(process.env.AWS_BUCKET_NAME)[1];
          resolve({
            status: "COMPLETED",
            languageCode: response.TranscriptionJob.LanguageCode,
            fileUrl: `${process.env.CLOUDFRONT_URL}${relativePath}`,
          });
        } else if (jobStatus === "FAILED") {
          console.error(
            "Transcription job failed:",
            response.TranscriptionJob.FailureReason
          );
          clearInterval(interval);
          resolve({
            status: "FAILED",
            languageCode: null,
            fileUrl: null,
          });
        }
      } catch (error) {
        console.error("Error checking job status:", error);
        clearInterval(interval);
        reject(error);
      }
    }, 1000);
  });
}

async function startTranscriptionJob(bucket, key, mediaId) {
  const REGION = process.env.AWS_REGION;
  const OUTPUT_BUCKET = bucket;

  const transcribeClient = new TranscribeClient({
    region: REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });

  try {
    const objectKey = key;
    const fileUri = `s3://${bucket}/${objectKey}`;

    const outputKey = `${mediaId}/Captions/${objectKey.replace(
      ".mp4",
      ""
    )}-caption.json`;
    const jobName = `${mediaId}-transcription-job`;

    const params = {
      Media: {
        MediaFileUri: fileUri,
      },
      OutputBucketName: OUTPUT_BUCKET,
      TranscriptionJobName: jobName,
      IdentifyLanguage: true, // enables automatic language detection
      LanguageOptions: [
        "en-US",
        "hi-IN",
        "es-ES",
        "fr-FR",
        "ja-JP",
        "ko-KR",
        "pt-BR",
        "pt-PT",
        "bn-IN",
      ],
      OutputKey: outputKey,
      Subtitles: {
        Formats: ["vtt"],
        OutputStartIndex: 0,
      },
      MediaFormat: "mp4",
    };

    console.log("Starting transcription job: " + jobName);
    const transcribeJobResponse = await transcribeClient.send(
      new StartTranscriptionJobCommand(params)
    );
    return transcribeJobResponse;
  } catch (err) {
    console.log("Error triggering transcription job: " + err.message);
    return {
      responseCode: 500,
      body: JSON.stringify(err.message),
    };
  }
}
