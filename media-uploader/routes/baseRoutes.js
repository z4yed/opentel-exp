const express = require("express");
const router = express.Router();
const baseController = require("../controllers/baseController");

router.get("/", baseController.renderIndex);

router.get("/how-it-works", (req, res) => {
  res.render("how-it-works", { title: "How It Works - Media Processor" });
});
router.get("/faq", (req, res) => {
  res.render("faq", { title: "FAQ - Media Processor" });
});

router.get("/about", (req, res) => {
  res.render("about", { title: "About Us" });
});

module.exports = router;
