const multer = require("multer");
const axios = require("axios");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const MediaModel = require("../models/mediaModel");
const { MEDIA_CONVERT_SERVICE_URL } = require("../constants");
const opentelemetry = require("@opentelemetry/api");

const { context, propagation } = require("@opentelemetry/api");

const storage = multer.memoryStorage();
const upload = multer({ storage });

const mediaUploadTracer = opentelemetry.trace.getTracer(
  "media-uploader-tracer",
  "1.0"
);

const renderIndex = (req, res) => {
  res.render("index", {
    title: "Media Suite",
    user: req.user,
  });
};

const renderUploader = (req, res) => {
  res.render("uploader", {
    title: "Media Suite - Uploader",
  });
};

const processFile = async (req, res) => {
  const contextInfo = {};

  return mediaUploadTracer.startActiveSpan("process-file", async (span) => {
    propagation.inject(context.active(), contextInfo);

    try {
      span.setAttribute("file.size", req.file.size);
      span.setAttribute("file.type", req.file.mimetype);

      const file = req.file;
      const s3 = new S3Client({ region: process.env.AWS_REGION });
      const fileUniqueName = Math.random().toString(36).slice(2, 18) + ".mp4";

      const input = {
        Bucket: process.env.S3_BUCKET_NAME,
        Key: fileUniqueName,
        Body: file.buffer,
        ContentType: file.mimetype,
      };

      const putCommand = new PutObjectCommand(input);
      const response = await s3.send(putCommand);

      if (response.$metadata.httpStatusCode === 200) {
        const media = new MediaModel({
          filename: file.originalname,
          filepath: `${process.env.CLOUDFRONT_URL}/${fileUniqueName}`,
        });

        await media.save();

        // pass context to the next service
        const convertResponse = await axios.post(
          `${MEDIA_CONVERT_SERVICE_URL}/convert`,
          {
            bucket: process.env.S3_BUCKET_NAME,
            key: fileUniqueName,
            mediaId: media._id,
          },
          {
            headers: {
              ContextInfo: JSON.stringify(contextInfo),
            },
          }
        );

        console.log("=================");
        console.log("Final Response: ", convertResponse.data);
        console.log("=================");

        span.setAttribute(
          "mediaConvertJobId",
          convertResponse.data.mediaConvertJobId
        );
        span.setAttribute(
          "mediaConvertJobStatus",
          convertResponse.data.mediaConvertJobStatus
        );
        span.setAttribute(
          "hlsPlaylistUrl",
          convertResponse.data.hlsPlaylistUrl
        );
        span.setAttribute("thumbnailUrl", convertResponse.data.thumbnailUrl);
        span.setAttribute("mediaId", convertResponse.data.mediaId);
        span.setAttribute(
          "subtitleGenerationStatus",
          convertResponse.data.subtitleGenerationStatus
        );
        span.setAttribute(
          "subtitleLanguageCode",
          convertResponse.data.subtitleLanguageCode
        );
        span.setAttribute(
          "subtitleFileUrl",
          convertResponse.data.subtitleFileUrl
        );

        await MediaModel.findByIdAndUpdate(media._id, {
          mediaConvertJobId: convertResponse.data.mediaConvertJobId,
          mediaConvertStatus: convertResponse.data.mediaConvertJobStatus,
          streamingUrl: convertResponse.data.hlsPlaylistUrl,
          thumbnailUrl: convertResponse.data.thumbnailUrl,
          subtitleUrl: convertResponse.data.subtitleFileUrl,
          subtitleLanguageCode: convertResponse.data.subtitleLanguageCode,
          subtitleStatus: convertResponse.data.subtitleGenerationStatus,
        });
      }

      res.status(200).send("File uploaded And processed.");
    } catch (error) {
      console.error(error);
      span.setStatus({
        code: opentelemetry.SpanStatusCode.ERROR,
        message: error.message,
      });
    } finally {
      console.log("Span end");
      span.end();
    }
  });
};

module.exports = {
  renderIndex,
  renderUploader,
  processFile,
  upload,
};
