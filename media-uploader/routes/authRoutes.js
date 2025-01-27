const express = require("express");
const { body, validationResult } = require("express-validator");
const authController = require("../controllers/authController");

const router = express.Router();

router.get("/login", (req, res) => {
  res.render("login", {
    title: "Login",
    successMessage: null,
    errors: null,
    formData: {},
  });
});

router.get("/register", (req, res) => {
  res.render("register", {
    title: "Register",
    errors: null,
    formData: {},
  });
});

router.post(
  "/register",
  [
    // Validate username
    body("username")
      .isString()
      .isLength({ min: 3 })
      .withMessage("Username must be at least 3 characters"),

    // Validate password
    body("password")
      .isString()
      .isLength({ min: 6 })
      .withMessage("Password must be at least 6 characters"),

    // Validate confirm password
    body("confirmPassword")
      .custom((value, { req }) => value === req.body.password)
      .withMessage("Passwords do not match"),
  ],
  (req, res) => {
    const errors = validationResult(req);

    console.log("Errors:", errors);

    if (!errors.isEmpty()) {
      // Pass errors and submitted data back to the form
      return res.render("register", {
        title: "Register",
        errors: errors.array(),
        formData: req.body, // Preserve submitted form data
      });
    }

    // If no errors, proceed to register user
    authController.register(req, res);
  }
);

// User Login
router.post(
  "/login",
  [
    body("username").isString().withMessage("Username is required"),
    body("password").isString().withMessage("Password is required"),
  ],
  authController.login
);

router.get("/logout", authController.logout);

module.exports = router;
