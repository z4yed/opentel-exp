require("dotenv").config();
const mongoose = require("mongoose");
const Category = require("./models/Category");

mongoose.connect("mongodb://mongo:27017/opentel");

const seedCategories = async () => {
  const categories = [
    { name: "Technology", description: "Videos about technology and gadgets." },
    { name: "Education", description: "Educational and learning videos." },
    {
      name: "Entertainment",
      description: "Movies, shows, and other entertainment content.",
    },
    { name: "Music", description: "Music videos and songs." },
    {
      name: "Gaming",
      description: "Gameplay, walkthroughs, and gaming reviews.",
    },
    { name: "Sports", description: "Sports-related content and highlights." },
    { name: "Travel", description: "Travel vlogs and destination videos." },
    { name: "Food", description: "Food recipes, reviews, and cooking videos." },
    {
      name: "Lifestyle",
      description: "Videos about lifestyle, fashion, and wellness.",
    },
    {
      name: "Other",
      description: "Miscellaneous videos that don't fit other categories.",
    },
  ];

  try {
    await Category.insertMany(categories);
    console.log("Categories seeded successfully!");
    mongoose.connection.close();
  } catch (error) {
    console.error("Error seeding categories:", error);
    mongoose.connection.close();
  }
};

seedCategories();
