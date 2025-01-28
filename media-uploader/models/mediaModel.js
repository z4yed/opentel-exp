const mongoose = require("mongoose");

const MediaSchema = new mongoose.Schema({
  title: {
    type: String,
    required: false,
    trim: true,
  },
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
  category: { type: mongoose.Schema.Types.ObjectId, ref: "Category" },
  published: { type: Boolean, default: false },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  uploadedAt: {
    type: Date,
    default: Date.now,
  },
  comments: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Comment",
    },
  ],
});

const MediaModel = mongoose.model("Media", MediaSchema);

module.exports = MediaModel;
