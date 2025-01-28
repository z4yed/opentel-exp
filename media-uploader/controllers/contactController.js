const Contact = require("../models/Contact");

exports.renderContactForm = (req, res) => {
  res.render("contact", {
    title: "Contact Us",
    errors: null,
    formData: {},
    successMessage: null,
  });
};

exports.submitContactForm = async (req, res) => {
  const { name, email, description } = req.body;

  try {
    // Create and save the contact form data
    await Contact.create({ name, email, description });

    // Render the page with a success message
    res.render("contact", {
      title: "Contact Us",
      errors: null,
      formData: {},
      successMessage:
        "Your message has been successfully sent. We'll get back to you soon!",
    });
  } catch (error) {
    console.error("Error submitting contact form:", error);

    // Render the page with validation errors
    const errors = Object.values(error.errors).map((err) => ({
      msg: err.message,
      path: err.path,
    }));

    res.render("contact", {
      title: "Contact Us",
      errors,
      formData: { name, email, description },
      successMessage: null,
    });
  }
};
