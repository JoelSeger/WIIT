class EadImportValidationError extends Error {
  constructor(issues) {
    super("EAD import validation failed.");
    this.name = "EadImportValidationError";
    this.issues = issues;
  }
}

class EadImportService {
  constructor(parser, mapper, repository) {
    this.parser = parser;
    this.mapper = mapper;
    this.repository = repository;
  }

  prepare(xml) {
    const parsed = this.parser.parse(xml);
    const errors = [];
    const warnings = [];

    const mapped = this.mapper.map(parsed, errors, warnings);

    const countNodes = (node) => {
      if (!node) return 0;

      return 1 + (node.children || []).reduce(
        (total, child) => total + countNodes(child),
        0
      );
    };

    return {
      ...mapped,
      errors,
      warnings,
      nodeCount: countNodes(mapped.rootNode),
    };
  }

  preview(xml) {
    const result = this.prepare(xml);

    return {
      valid: result.errors.length === 0,
      metadata: result.metadata,
      rootNode: result.rootNode,
      nodeCount: result.nodeCount,
      errors: result.errors,
      warnings: result.warnings,
    };
  }

  async import(input) {
    const result = this.prepare(input.xml);

    if (result.errors.length > 0) {
      throw new EadImportValidationError(result.errors);
    }

    const hasStructureId = input.structureId != null;
    const hasStructureName =
      typeof input.structureName === "string" &&
      input.structureName.trim().length > 0;

    if (hasStructureId === hasStructureName) {
      throw new Error(
        "Provide exactly one of structureId or structureName."
      );
    }

    let structureId = input.structureId;

    if (hasStructureName) {
      console.log("[EAD IMPORT] structureName:", JSON.stringify(input.structureName));
  structureId = await this.repository.findOrCreateStructure(
    input.structureName.trim(),
    result.metadata
    );
    }

    return this.repository.importDocument({
      structureId,
      metadata: result.metadata,
      rootNode: result.rootNode,
      sourceXml: input.xml,
      sourceFileName: input.sourceFileName,
    });
  }
}

module.exports = {
  EadImportService,
  EadImportValidationError,
};