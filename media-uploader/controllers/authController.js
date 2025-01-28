const jwt = require("jsonwebtoken");
const { validationResult } = require("express-validator");
const User = require("../models/User");
require("dotenv").config();

const JWT_SECRET = process.env.JWT_SECRET || "secretSigner";

// User Registration
exports.register = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).render("register", {
      title: "Register",
      errors: errors.array(),
      formData: req.body,
    });
  }

  const { username, password } = req.body;

  try {
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).render("register", {
        title: "Register",
        errors: [{ msg: "Username already exists", path: "username" }],
        formData: req.body,
      });
    }

    const newUser = new User({ username, password });
    await newUser.save();

    // Render login page with a success message
    res.status(201).render("login", {
      title: "Login",
      successMessage: "Registration successful! You can now log in.",
      errors: null,
      formData: {},
    });
  } catch (error) {
    console.error("Error registering user:", error);
    res.status(500).render("register", {
      title: "Register",
      errors: [{ msg: "Internal Server Error" }],
      formData: req.body,
    });
  }
};

// User Login
exports.login = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).render("login", {
      title: "Login",
      errors: errors.array(), // Validation errors
      formData: req.body, // Preserve submitted username
      successMessage: null,
    });
  }

  const { username, password } = req.body;

  try {
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).render("login", {
        title: "Login",
        errors: [{ msg: "Invalid username or password", path: "username" }],
        formData: req.body,
        successMessage: null,
      });
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).render("login", {
        title: "Login",
        errors: [{ msg: "Invalid username or password", path: "password" }],
        formData: req.body,
        successMessage: null,
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: user._id, username: user.username },
      JWT_SECRET,
      { expiresIn: "1h" }
    );

    // Set the token in a cookie
    res.cookie("token", token, { httpOnly: true, maxAge: 3600000 }); // Cookie valid for 1 hour
    console.log("User logged in:", user.username, token);

    // Redirect to upload page
    res.redirect("/media/upload");
  } catch (error) {
    console.error("Error logging in user:", error);
    res.status(500).render("login", {
      title: "Login",
      errors: [{ msg: "Internal Server Error" }],
      formData: req.body,
      successMessage: null,
    });
  }
};

exports.logout = (req, res) => {
  res.clearCookie("token");
  res.redirect("/auth/login");
};
