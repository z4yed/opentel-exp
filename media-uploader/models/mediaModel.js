const mongoose = require("mongoose");

const MediaSchema = new mongoose.Schema({
  filename: String,
  filepath: String,
  mimetype: String,
});

const MediaModel = mongoose.model("Media", MediaSchema);

module.exports = MediaModel;
