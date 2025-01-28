const MediaModel = require("../models/mediaModel");
const CategoryModel = require("../models/Category");

const renderIndex = async (req, res) => {
  const categoryName = req.query.category;
  let filteredCategory = null;

  if (categoryName) {
    filteredCategory = await CategoryModel.findOne({ name: categoryName });
  }

  try {
    const categories = await CategoryModel.find();
    const filteredMedia = [];

    const categorizedMedia = {};
    for (const category of categories) {
      const media = await MediaModel.find({
        category: category._id,
        title: { $ne: null },
        published: true,
      })
        .populate("category")
        .populate("uploadedBy")
        .sort({ uploadedAt: -1 });

      if (media.length > 0) {
        if (filteredCategory && category.name === filteredCategory.name) {
          filteredMedia.push(...media);
        }
        categorizedMedia[category.name] = media;
      }
    }

    res.render("index", {
      title: "Media Suite - Home",
      categorizedMedia,
      filteredMedia,
      filteredCategoryName: filteredCategory ? filteredCategory.name : null,
    });
  } catch (error) {
    console.error("Error rendering index page:", error);
    res.status(500).send("Internal Server Error");
  }
};

exports.renderIndex = renderIndex;
