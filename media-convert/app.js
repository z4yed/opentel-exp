const express = require("express");
const axios = require("axios");
const app = express();

const PORT = 3002;

app.get("/", async (req, res) => {
  try {
    const response = await axios.get("http://media-uploader:3001");
    res.send(
      `Hello World! This is the media converter service. ${response.data}`
    );
  } catch (error) {
    res.send("Hello World! This is the media converter service.");
  }
});

app.listen(PORT, () => {
  console.log(`Mediaconvert is running on port ${PORT}`);
});
