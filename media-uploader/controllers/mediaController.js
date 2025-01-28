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

const renderUploader = async (req, res) => {
  try {
    const mediaList = await MediaModel.find({ uploadedBy: req.user.id });

    res.render("uploader", {
      title: "Media Suite - Uploader",
      mediaList,
    });
  } catch (error) {
    console.error("Error fetching media list:", error.message);
    res.status(500).send("Internal Server Error");
  }
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
          uploadedBy: req.user.id,
          filesize: file.size,
          mimetype: file.mimetype,
          uploadedAt: new Date(),
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

const getMedia = async (req, res) => {
  const { id } = req.params;
  const media = await MediaModel.findById(id);

  // if media is not found or not uploaded by the user
  if (!media || media.uploadedBy.toString() !== req.user.id) {
    return res.redirect(
      "/upload?error=" + encodeURIComponent("Media not found")
    );
  }

  const relatedMedia = await MediaModel.find({
    uploadedBy: media.uploadedBy,
    _id: { $ne: media._id },
  });

  res.render("mediaDetails", {
    title: "Media Suite - Media Details",
    media,
    relatedMedia,
  });
};

const deleteMedia = async (req, res) => {
  try {
    const { id } = req.params;
    const media = await MediaModel.findById(id);

    // if media is not found or not uploaded by the user
    if (!media || media.uploadedBy.toString() !== req.user.id) {
      return res.redirect(
        "/upload?error=" + encodeURIComponent("Media not found")
      );
    }

    await MediaModel.findByIdAndDelete(id);
    res.redirect("/upload?deleted=true");
  } catch (error) {
    console.error("Error deleting media:", error.message);
    res.status(500).redirect("/upload?deleted=false");
  }
};

module.exports = {
  renderIndex,
  renderUploader,
  processFile,
  deleteMedia,
  getMedia,
  upload,
};
