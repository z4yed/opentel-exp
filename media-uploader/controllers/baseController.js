const renderIndex = (req, res) => {
  res.render("index", {
    title: "Media Suite - Home",
    user: req.user,
  });
};

exports.renderIndex = renderIndex;
