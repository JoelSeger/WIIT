const path = require("path");

const db = require("../../db/knex")
const { EadParser } = require("../ead/eadParser");
const { EadMapper } = require("../ead/eadMapper");
const { EadRepository } = require("../repositories/ead.repository");

const {
  EadImportService,
  EadImportValidationError,
} = require("../services/EAD-import.service");

const eadService = new EadImportService(
  new EadParser(),
  new EadMapper(),
  new EadRepository(db)
);

function getXmlFromRequest(req) {
  if (!req.file) {
    const error = new Error("Please upload an XML file in the file field.");
    error.status = 400;
    throw error;
  }

  return req.file.buffer.toString("utf8");
}


async function previewImport(req, res, next) {
  console.log("[EAD PREVIEW] Request received");
  console.log("[EAD PREVIEW] File exists:", Boolean(req.file));

  try {
    const xml = getXmlFromRequest(req);

    console.log("[EAD PREVIEW] XML length:", xml.length);
    console.log("[EAD PREVIEW] Starting parser and mapper");

    const result = eadService.preview(xml);

    console.log("[EAD PREVIEW] Success");

    return res.status(200).json(result);
  } catch (error) {
    console.error("[EAD PREVIEW] Error name:", error.name);
    console.error("[EAD PREVIEW] Error message:", error.message);
    console.error("[EAD PREVIEW] Error stack:", error.stack);

    if (error.status === 400) {
      return res.status(400).json({
        message: error.message,
      });
    }

    return res.status(500).json({
      message: error.message || "Unknown error",
      errorName: error.name,
    });
  }
}


async function importEad(req, res, next) {
  console.log("--- تم استلام طلب الـ Import بنجاح في الـ Controller! ---");
  try {
    const xml = getXmlFromRequest(req);

    let structureId = null;

    if (req.body.structureId !== undefined && req.body.structureId !== "") {
      structureId = Number(req.body.structureId);
    }

    const structureName =
      typeof req.body.structureName === "string"
        ? req.body.structureName.trim()
        : "";

    if (!structureId && !structureName) {
      return res.status(400).json({
        message: "Provide either structureId or structureName.",
      });
    }

    const result = await eadService.import({
      xml,
      sourceFileName: path.basename(req.file.originalname),
      structureId: structureId || null,
      structureName: structureName || null,
    });

    return res.status(201).json({
      message: "EAD document imported successfully.",
      ...result,
    });
  } catch (error) {
  console.error("EAD import failed:", error.stack || error);

  if (error instanceof EadImportValidationError) {
    return res.status(400).json({
      message: error.message,
      errors: error.issues,
    });
  }

  if (error.status && error.status < 500) {
    return res.status(error.status).json({
      message: error.message,
    });
  }

  return next(error);
}
}

module.exports = {
  previewImport,
  importEad,
};