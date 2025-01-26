document
  .getElementById("uploadForm")
  .addEventListener("submit", function (event) {
    event.preventDefault();
    const formData = new FormData(this);
    const uploadStatus = document.getElementById("uploadStatus");

    fetch("/upload", {
      method: "POST",
      body: formData,
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          uploadStatus.innerHTML = "<p>Upload successful!</p>";
        } else {
          uploadStatus.innerHTML = "<p>Upload failed. Please try again.</p>";
        }
      })
      .catch((error) => {
        console.error("Error:", error);
        uploadStatus.innerHTML = "<p>An error occurred. Please try again.</p>";
      });
  });
