const {
  TranscribeClient,
  StartTranscriptionJobCommand,
  GetTranscriptionJobCommand,
} = require("@aws-sdk/client-transcribe");
const express = require("express");
const bodyParser = require("body-parser");
const configureOpenTelemetry = require("./opentelemetry");
const { context, propagation, trace } = require("@opentelemetry/api");
require("dotenv").config();

configureOpenTelemetry("subtitle-generator");

const app = express();
app.use(bodyParser.json());

const PORT = 3003;

const subtitleGeneratorTracer = trace.getTracer(
  "subtitle-generator-tracer",
  "1.0"
);

app.get("/", (req, res) => {
  res.send("Subtitle Generator Service is running.");
});

app.post("/generate-subtitle", async (req, res) => {
  console.log("Headers:", req.headers);
  const previousContext = JSON.parse(req.headers.contextinfo);
  const activeContext = propagation.extract(context.active(), previousContext);

  let span = subtitleGeneratorTracer.startSpan(
    "generateSubtitle",
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

    const transcriptionJobResponse = await startTranscriptionJob(
      bucket,
      key,
      mediaId
    );

    const transcriptionJobName =
      transcriptionJobResponse.TranscriptionJob.TranscriptionJobName;
    const jobStatusAndLanguageCode = await checkJobStatusEverySecond(
      transcriptionJobName
    );

    res.json({
      service: "subtitle-generator",
      mediaId,
      status: jobStatusAndLanguageCode.status,
      languageCode: jobStatusAndLanguageCode.languageCode,
      fileUrl: jobStatusAndLanguageCode.fileUrl,
    });
  } catch (error) {
    span.setStatus({
      code: 2, // ERROR
      message: error.message,
    });

    console.error("Subtitle generation failed:", error);
    res.status(500).send(`Subtitle generation failed: ${error.message}`);
  } finally {
    span.end();
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
            fileUrl: relativePath,
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
