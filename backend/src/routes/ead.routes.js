const express = require("express");
const multer = require("multer");

const {
  previewImport,
  importEad,
  getTree,
} = require("../controllers/ead.controller");

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

router.get("/tree/:structureId", getTree);
router.post("/import/preview", upload.single("file"), previewImport);
router.post("/import", upload.single("file"), importEad);
router.post("/test-upload", upload.single("file"), (req, res) => {
  console.log("[UPLOAD TEST] Route reached");
  console.log("[UPLOAD TEST] File exists:", Boolean(req.file));

  return res.status(200).json({
    message: "Upload route is working",
    fileReceived: Boolean(req.file),
    fileName: req.file?.originalname || null,
    fileSize: req.file?.size || 0,
  });
});

module.exports = router;