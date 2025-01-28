const express = require("express");
const router = express.Router();
const mediaController = require("../controllers/mediaController");
const jwt = require("jsonwebtoken");
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

router.get("/", mediaController.renderIndex);

router.get("/faq", (req, res) => {
  res.render("faq", { title: "FAQ - Media Processor" });
});

router.get("/upload", authenticateToken, mediaController.renderUploader);

router.post(
  "/upload",
  authenticateToken,
  mediaController.upload.single("file"),
  mediaController.processFile
);

router.get("/media/:id/details", authenticateToken, mediaController.getMedia);

router.post(
  "/media/:id/delete/",
  authenticateToken,
  mediaController.deleteMedia
);

module.exports = router;
