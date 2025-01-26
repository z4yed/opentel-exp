const express = require("express");
const router = express.Router();
const mediaController = require("../controllers/mediaController");

router.get("/", mediaController.renderIndex);

router.get("/upload", mediaController.renderUploader);

router.post(
  "/upload",
  mediaController.upload.single("file"),
  mediaController.processFile
);

module.exports = router;
