const path = require("path");

const { EadParser } = require("./ead.parser");
const { EadMapper } = require("./ead.mapper");
const { EadRepository } = require("./ead.repository");

const {
  EadImportService,
  EadImportValidationError,
} = require("./ead-import.service");

const eadService = new EadImportService(
  new EadParser(),
  new EadMapper(),
  new EadRepository()
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
  try {
    const xml = getXmlFromRequest(req);
    const result = eadService.preview(xml);

    return res.status(200).json(result);
  } catch (error) {
    if (error instanceof Error) {
      return res.status(400).json({
        message: error.message,
      });
    }

    next(error);
  }
}

async function importEad(req, res, next) {
  try {
    const xml = getXmlFromRequest(req);

    let structureId = null;

    if (req.body.structureId !== undefined && req.body.structureId !== "") {
      structureId = Number(req.body.structureId);

      if (!Number.isInteger(structureId) || structureId <= 0) {
        return res.status(400).json({
          message: "structureId must be a positive integer.",
        });
      }
    }

    const structureName =
      typeof req.body.structureName === "string"
        ? req.body.structureName.trim()
        : "";

    if ((structureId !== null) === (structureName.length > 0)) {
      return res.status(400).json({
        message: "Provide exactly one of structureId or structureName.",
      });
    }

    const result = await eadService.import({
      xml,
      sourceFileName: path.basename(req.file.originalname),
      structureId,
      structureName: structureName || null,
    });

    return res.status(201).json({
      message: "EAD document imported successfully.",
      ...result,
    });
  } catch (error) {
    if (error instanceof EadImportValidationError) {
      return res.status(422).json({
        message: error.message,
        errors: error.issues,
      });
    }

    if (error && error.code === "STRUCTURE_NOT_FOUND") {
      return res.status(404).json({
        message: error.message,
      });
    }

    next(error);
  }
}

module.exports = {
  previewImport,
  importEad,
};