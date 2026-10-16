const { XMLParser, XMLValidator } = require("fast-xml-parser");

class EadParser {
  constructor() {
    this.parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      removeNSPrefix: true,
      parseTagValue: false,
      trimValues: true,
      processEntities: false,
    });
  }

  parse(xml) {
    if (typeof xml !== "string" || !xml.trim()) {
      throw new Error("The XML file is empty.");
    }

    if (/<!DOCTYPE|<!ENTITY/i.test(xml)) {
      throw new Error("DOCTYPE and ENTITY declarations are not allowed.");
    }

    const validation = XMLValidator.validate(xml);

    if (validation !== true) {
      throw new Error("The uploaded file contains invalid XML.");
    }

    let parsed;

    try {
      parsed = this.parser.parse(xml);
    } catch {
      throw new Error("The XML file could not be parsed.");
    }

    if (!parsed || typeof parsed !== "object" || !parsed.ead) {
      throw new Error("The XML document must have an EAD root element.");
    }

    return parsed;
  }
}

module.exports = { EadParser };