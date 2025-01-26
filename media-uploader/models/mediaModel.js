const mongoose = require("mongoose");

const MediaSchema = new mongoose.Schema({
  filename: String,
  filepath: String,
  streamingUrl: String,
  thumbnailUrl: String,
  mediaConvertJobId: String,
  mediaConvertStatus: String,
  subtitleStatus: String,
  subtitleLanguageCode: String,
  subtitleUrl: String,
});

const MediaModel = mongoose.model("Media", MediaSchema);

module.exports = MediaModel;
