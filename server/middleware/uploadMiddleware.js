const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("../config/cloudinary");

/* =========================
   File Type Validation
========================= */
const fileFilter = (req, file, cb) => {

  const allowedMimes = [
    "image/jpeg",
    "image/png",
    "image/jpg",
    "image/webp"
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only JPEG, PNG and WebP images are allowed"), false);
  }
};


/* =========================
   Cloudinary Storage Config
========================= */
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "food-donations",
    allowed_formats: ["jpg", "png", "jpeg", "webp"],

    transformation: [
      { width: 800, height: 600, crop: "limit" }, // limit size
      { quality: "auto" },                        // compress
      { fetch_format: "auto" }                    // serve optimal format
    ]
  }
});


/* =========================
   Multer Upload Middleware
========================= */
const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB max
  },
  fileFilter
});

module.exports = upload;