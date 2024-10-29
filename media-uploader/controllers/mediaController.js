const multer = require("multer");
const axios = require("axios");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const MediaModel = require("../models/mediaModel");
const { MEDIA_CONVERT_SERVICE_URL } = require("../constants");

const storage = multer.memoryStorage();
const upload = multer({ storage });

const renderIndex = (req, res) => {
  res.render("index", {
    title: "Media Uploader",
    message: "Hello World! This is the media uploader service.",
  });
};

const uploadFile = async (req, res) => {
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

    const convertResponse = await axios.post(
      `${MEDIA_CONVERT_SERVICE_URL}/convert`,
      {
        bucket: process.env.S3_BUCKET_NAME,
        key: file.originalname,
      }
    );

    console.log("Media converted", convertResponse.data);
  }

  res.status(200).send("File uploaded to S3");
};

module.exports = {
  renderIndex,
  uploadFile,
  upload,
};
