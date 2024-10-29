const express = require("express");
const router = express.Router();
const mediaController = require("../controllers/mediaController");

router.get("/", mediaController.renderIndex);
router.post(
  "/upload",
  mediaController.upload.single("file"),
  mediaController.uploadFile
);

module.exports = router;
