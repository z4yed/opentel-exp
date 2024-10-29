const express = require("express");
var bodyParser = require("body-parser");

const app = express();
app.use(bodyParser.json());

const PORT = 3002;

app.post("/convert", async (req, res) => {
  console.log("converting media", req.body);

  return res.status(200).send("Media converted successfully");
});

app.listen(PORT, () => {
  console.log(`Mediaconvert is running on port ${PORT}`);
});
