const express = require("express");
const multer = require("multer");

const {
  previewImport,
  importEad,
} = require("./ead.controller");

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
  },
  fileFilter: (req, file, callback) => {
    const extension = file.originalname.toLowerCase().endsWith(".xml");

    if (!extension) {
      return callback(new Error("Only .xml files are accepted."));
    }

    callback(null, true);
  },
});

router.post("/import/preview", upload.single("file"), previewImport);
router.post("/import", upload.single("file"), importEad);

module.exports = router;