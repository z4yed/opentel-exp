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
); // start a tracer

const renderIndex = (req, res) => {
  res.render("index", {
    title: "Media Uploader",
    message: "Hello World! This is the media uploader service.",
  });
};

const uploadFile = async (req, res) => {
  const contextInfo = {};

  return mediaUploadTracer.startActiveSpan("uploadFile", async (span) => {
    propagation.inject(context.active(), contextInfo);

    try {
      span.setAttribute("file.size", req.file.size);
      span.setAttribute("file.type", req.file.mimetype);

      const file = req.file;
      const s3 = new S3Client({ region: process.env.AWS_REGION });
      const input = {
        Bucket: process.env.S3_BUCKET_NAME,
        Key: file.originalname,
        Body: file.buffer,
        ContentType: file.mimetype,
      };

      const putCommand = new PutObjectCommand(input);
      const response = await s3.send(putCommand);

      if (response.$metadata.httpStatusCode === 200) {
        const media = new MediaModel({
          filename: file.originalname,
          filepath: `${process.env.CLOUDFRONT_URL}/${file.originalname}`,
          mimetype: file.mimetype,
        });

        await media.save();

        // pass context to the next service
        const convertResponse = await axios.post(
          `${MEDIA_CONVERT_SERVICE_URL}/convert`,
          {
            bucket: process.env.S3_BUCKET_NAME,
            key: file.originalname,
          },
          {
            headers: {
              ContextInfo: JSON.stringify(contextInfo),
            },
          }
        );

        console.log("Media converted", convertResponse.data);
      }

      res.status(200).send("File uploaded to S3");
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
  uploadFile,
  upload,
};
