const express = require("express");
const multer = require("multer");

const app = express();
app.set("view engine", "ejs");

const PORT = 3001;

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  },
});

const upload = multer({ storage });

app.get("/", (req, res) => {
  res.render("index", {
    title: "Media Uploader",
    message: "Hello World! This is the media uploader service.",
  });
});

app.post("/upload", upload.single("file"), (req, res) => {
  res.send("File uploaded successfully!");
});

app.listen(PORT, () => {
  console.log(`MediaUploader is running on port ${PORT}`);
});
