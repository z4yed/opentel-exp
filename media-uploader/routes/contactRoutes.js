const express = require("express");
const { body, validationResult } = require("express-validator");
const contactController = require("../controllers/contactController");

const router = express.Router();

// Render Contact Form
router.get("/contact", contactController.renderContactForm);

// Handle Form Submission
router.post(
  "/contact",
  [
    body("name").notEmpty().withMessage("Name is required"),
    body("email").isEmail().withMessage("Valid email is required"),
    body("description").notEmpty().withMessage("Description is required"),
  ],
  async (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.render("contact", {
        title: "Contact Us",
        errors: errors.array(),
        formData: req.body,
        successMessage: null,
      });
    }

    contactController.submitContactForm(req, res);
  }
);

module.exports = router;
