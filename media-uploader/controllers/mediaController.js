const multer = require("multer");
const axios = require("axios");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const MediaModel = require("../models/mediaModel");
const CommentModel = require("../models/Comment");
const { MEDIA_CONVERT_SERVICE_URL } = require("../constants");
const opentelemetry = require("@opentelemetry/api");

const { context, propagation } = require("@opentelemetry/api");

const storage = multer.memoryStorage();
const upload = multer({ storage });

const mediaUploadTracer = opentelemetry.trace.getTracer(
  "media-uploader-tracer",
  "1.0"
);

const renderUploader = async (req, res) => {
  try {
    const mediaList = await MediaModel.find({ uploadedBy: req.user.id })
      .sort({
        uploadedAt: -1,
      })
      .populate("category");

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
  return mediaUploadTracer.startActiveSpan(
    "process-file-span",
    async (span) => {
      propagation.inject(context.active(), contextInfo);

      try {
        span.setAttribute("file.size", req.file.size);
        span.setAttribute("file.type", req.file.mimetype);

        const uploadSpan = mediaUploadTracer.startSpan(
          "upload-to-s3-span",
          { attributes: {} },
          context.active()
        );

        const file = req.file;
        console.log("Uploading to s3: PROCESSING");
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
          console.log("Uploading to s3: SUCCESS");
          uploadSpan.setAttribute("uploadStatus", "success");
          uploadSpan.setAttribute("s3Bucket", process.env.S3_BUCKET_NAME);
          uploadSpan.setAttribute("s3Key", fileUniqueName);
          uploadSpan.end();

          // create a new media record span
          const mediaSpan = mediaUploadTracer.startSpan(
            "create-media-record-span",
            { attributes: {} },
            context.active()
          );

          const media = new MediaModel({
            title: null,
            filename: file.originalname,
            filepath: `${process.env.CLOUDFRONT_URL}/${fileUniqueName}`,
            uploadedBy: req.user.id,
            filesize: file.size,
            mimetype: file.mimetype,
            category: null,
            uploadedAt: new Date(),
          });

          await media.save();
          mediaSpan.setAttribute("record-id", media._id);
          mediaSpan.end();

          // pass context to the next service
          const videoProcessResponse = await axios.post(
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

          const responseData = videoProcessResponse.data;

          console.log("=================================");
          console.log("Final Response: ", responseData);
          console.log("=================================");

          span.setAttribute(
            "mediaConvertJobId",
            responseData.mediaConvertJobId
          );
          span.setAttribute(
            "mediaConvertJobStatus",
            responseData.mediaConvertJobStatus
          );
          span.setAttribute("hlsPlaylistUrl", responseData.hlsPlaylistUrl);
          span.setAttribute("thumbnailUrl", responseData.thumbnailUrl);
          span.setAttribute("mediaId", responseData.mediaId);
          span.setAttribute(
            "subtitleGenerationStatus",
            responseData.subtitleGenerationStatus
          );
          span.setAttribute(
            "subtitleLanguageCode",
            responseData.subtitleLanguageCode
          );
          span.setAttribute("subtitleFileUrl", responseData.subtitleFileUrl);

          await MediaModel.findByIdAndUpdate(media._id, {
            mediaConvertJobId: responseData.mediaConvertJobId,
            mediaConvertStatus: responseData.mediaConvertJobStatus,
            streamingUrl: responseData.hlsPlaylistUrl,
            thumbnailUrl: responseData.thumbnailUrl,
            subtitleUrl: responseData.subtitleFileUrl,
            subtitleLanguageCode: responseData.subtitleLanguageCode,
            subtitleStatus: responseData.subtitleGenerationStatus,
          });
        }
        res.status(200).send("File uploaded successfully");
      } catch (error) {
        console.error(error);
        span.setStatus({
          code: opentelemetry.SpanStatusCode.ERROR,
          message: error.message,
        });
      } finally {
        span.end();
      }
    }
  );
};

const getMediaPublicDetails = async (req, res) => {
  const { id } = req.params;
  const media = await MediaModel.findById(id).populate("category");
  const comments = await CommentModel.find({ media: id }).populate("user");

  const relatedMedia = await MediaModel.find({
    category: media.category,
    _id: { $ne: media._id },
  })
    .populate("category")
    .populate("uploadedBy")
    .limit(5);

  if (!media) {
    return res.redirect("/");
  }

  res.render("mediaPublicDetails", {
    title: "Media Suite - Media",
    media,
    relatedMedia,
    comments,
  });
};

const getMediaDetails = async (req, res) => {
  const { id } = req.params;
  const media = await MediaModel.findById(id).populate("category");

  // if media is not found or not uploaded by the user
  if (!media || media.uploadedBy.toString() !== req.user.id) {
    return res.redirect(
      "/media/upload?error=" + encodeURIComponent("Media not found")
    );
  }

  const relatedMedia = await MediaModel.find({
    category: media.category,
    uploadedBy: media.uploadedBy,
    _id: { $ne: media._id },
  }).populate("category");

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
        "/media/upload?error=" + encodeURIComponent("Media not found")
      );
    }

    await MediaModel.findByIdAndDelete(id);
    res.redirect("/media/upload?deleted=true");
  } catch (error) {
    console.error("Error deleting media:", error.message);
    res.status(500).redirect("/upload?deleted=false");
  }
};

const addComment = async (req, res) => {
  try {
    const { content } = req.body;
    const { mediaId } = req.params;

    if (!content || content.trim() === "") {
      return res.status(400).json({ message: "Comment content is required." });
    }

    // Create a new comment
    const comment = new CommentModel({
      content,
      media: mediaId,
      user: req.user.id,
    });

    await comment.save();

    // Add the comment to the media
    await MediaModel.findByIdAndUpdate(mediaId, {
      $push: { comments: comment._id },
    });

    const commentWithUser = await CommentModel.findById(comment._id).populate(
      "user",
      "username"
    );
    // send comment with populated user
    res.status(201).json({
      message: "Comment added successfully!",
      comment: commentWithUser,
    });
  } catch (error) {
    console.error("Error adding comment:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const getComments = async (req, res) => {
  try {
    const { mediaId } = req.params;

    const comments = await CommentModel.find({ media: mediaId })
      .populate("user", "username") // Populate the user with their username
      .sort({ createdAt: -1 });

    res.status(200).json(comments);
  } catch (error) {
    console.error("Error fetching comments:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

module.exports = {
  renderUploader,
  processFile,
  deleteMedia,
  getMediaDetails,
  getMediaPublicDetails,
  addComment,
  getComments,
  upload,
};
