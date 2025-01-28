const mongoose = require("mongoose");
const { upload } = require("../controllers/mediaController");

const MediaSchema = new mongoose.Schema({
  filename: String,
  filepath: String,
  mimetype: String,
  filesize: Number,
  streamingUrl: String,
  thumbnailUrl: String,
  mediaConvertJobId: String,
  mediaConvertStatus: String,
  subtitleStatus: String,
  subtitleLanguageCode: String,
  subtitleUrl: String,
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId, // Reference to the User model
    ref: "User", // Name of the User model
    required: true, // Make this field mandatory
  },
  uploadedAt: {
    type: Date,
    default: Date.now,
  },
});

const MediaModel = mongoose.model("Media", MediaSchema);

module.exports = MediaModel;
