const MediaModel = require("../models/mediaModel");
const CategoryModel = require("../models/Category");

const renderIndex = async (req, res) => {
  try {
    // Fetch all categories
    const categories = await CategoryModel.find();

    // Fetch categorized media
    const categorizedMedia = {};
    for (const category of categories) {
      const media = await MediaModel.find({
        category: category._id,
        title: { $ne: null },
        published: true,
      })
        .populate("category")
        .populate("uploadedBy");
      if (media.length > 0) {
        categorizedMedia[category.name] = media;
      }
    }

    const uncategorizedMedia = await MediaModel.find({
      category: null,
      published: true,
    }).populate("uploadedBy");

    res.render("index", {
      title: "Media Suite - Home",
      categorizedMedia,
      uncategorizedMedia,
    });
  } catch (error) {
    console.error("Error rendering index page:", error);
    res.status(500).send("Internal Server Error");
  }
};

exports.renderIndex = renderIndex;
