const express = require("express");
const router = express.Router();
const mediaController = require("../controllers/mediaController");
const jwt = require("jsonwebtoken");
const { body, validationResult } = require("express-validator");
const MediaModel = require("../models/mediaModel");
const Category = require("../models/Category");
require("dotenv").config();

const JWT_SECRET = process.env.JWT_SECRET || "secretSigner";

const authenticateToken = (req, res, next) => {
  const token =
    req.cookies?.token || // Check token in cookies
    (req.headers.authorization && req.headers.authorization.split(" ")[1]);

  if (!token) {
    res.locals.user = null; // Ensure user info is available in views
    return res
      .status(401)
      .redirect(
        "/auth/login?error=" +
          encodeURIComponent("Not authenticated. Please login.")
      );
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET); // Verify the token
    req.user = decoded; // Attach decoded user info to the request
    res.locals.user = decoded; // Ensure user info is available in views
    next(); // Proceed to the next middleware or route
  } catch (error) {
    res.locals.user = null; // Ensure no user is set
    return res
      .status(401)
      .redirect(
        "/auth/login?error=" +
          encodeURIComponent("Not authenticated. Please login.")
      );
  }
};

router.get("/upload", authenticateToken, mediaController.renderUploader);

router.post(
  "/upload",
  authenticateToken,
  mediaController.upload.single("file"),
  mediaController.processFile
);

router.get("/:id", authenticateToken, mediaController.getMediaPublicDetails);

router.get("/:id/details", authenticateToken, mediaController.getMediaDetails);

router.post("/:id/delete/", authenticateToken, mediaController.deleteMedia);

router.get("/:id/edit", authenticateToken, async (req, res) => {
  try {
    const media = await MediaModel.findById(req.params.id);
    const categories = await Category.find({});

    if (!media || media.uploadedBy.toString() !== req.user.id) {
      return res.redirect(
        "/upload?error=" + encodeURIComponent("Media not found")
      );
    }

    res.render("editMedia", {
      title: "Edit Media",
      media,
      categories,
      errors: null,
      formData: {},
    });
  } catch (error) {
    console.error("Error fetching media for editing:", error);
    res.status(500).send("Internal server error");
  }
});

router.post(
  "/:id/edit",
  authenticateToken,
  [
    body("title")
      .if(body("published").equals("true")) // Only validate title if published is true
      .notEmpty()
      .withMessage("Title is required when publishing media")
      .isString()
      .withMessage("Title must be a string"),
    body("category").isMongoId().withMessage("Category must be a valid ID"),
    body("published").isBoolean().withMessage("Published must be a boolean"),
  ],
  async (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      const media = await MediaModel.findById(req.params.id);
      const categories = await Category.find({});

      return res.status(400).render("editMedia", {
        title: "Edit Media",
        media,
        categories,
        errors: errors.array(), // Pass validation errors to the template
      });
    }

    try {
      const { title, category, published } = req.body;

      const media = await MediaModel.findById(req.params.id);

      if (!media) {
        return res.status(404).send("Media not found");
      }

      if (media.mediaConvertStatus !== "COMPLETE") {
        return res
          .status(400)
          .send("Cannot edit media unless conversion is complete.");
      }

      media.title = title;
      media.category = category;
      media.published = published === "true";
      await media.save();

      res.redirect(`/media/${media._id}/details?updated=true`);
    } catch (error) {
      console.error("Error updating media:", error);
      res.status(500).send("Internal server error");
    }
  }
);

// comment routes
router.post(
  "/:mediaId/comments",
  authenticateToken,
  mediaController.addComment
);

router.get("/:mediaId/comments", mediaController.getComments);

module.exports = router;
