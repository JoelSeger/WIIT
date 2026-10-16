
class EadRepository {
  constructor(knex) {
    this.knex = knex;
  }

  /**
   * Determine the application node type from the EAD element.
   */
  getNodeTypeInfo(node) {
    const normalize = (value) =>
      String(value || "")
        .trim()
        .toLowerCase();

    const otherlevel = normalize(node.otherlevel);
    const level = normalize(node.level);

    if (otherlevel === "structuralunit") {
      const description = normalize(
        node.structuralUnitDescription
      )
        .replace(/å/g, "a")
        .replace(/ä/g, "a")
        .replace(/ö/g, "o");

      const classificationTypes = {
        verksamhetsomrade: {
          code: "verksamhetsomrade",
          name: "Verksamhetsområde",
        },
        processgrupp: {
          code: "processgrupp",
          name: "Processgrupp",
        },
        process: {
          code: "process",
          name: "Process",
        },
      };

      return (
        classificationTypes[description] || {
          code: "structuralunit",
          name: "Structural unit (EAD)",
        }
      );
    }

    const eadType = otherlevel || level;

    if (!eadType || eadType === "otherlevel") {
      throw new Error(
        `Cannot determine EAD node type for "${node.name}".`
      );
    }

    const knownTypes = {
      recordgroup: "Record group (EAD)",
      recordtype: "Record type (EAD)",
    };

    return {
      code: eadType,
      name: knownTypes[eadType] || `${eadType} (EAD)`,
    };
  }

  /**
   * Find an existing classification structure or create it.
   * The db argument allows the caller to reuse its transaction.
   */
  async findOrCreateStructure(
    name,
    metadata = {},
    db = this.knex
  ) {
    const structureName = String(name || "").trim();

    if (!structureName) {
      throw new Error("A structure name is required.");
    }

    const existing = await db("structures")
      .where({
        name: structureName,
        structure_type: "klassificering",
      })
      .first();

    if (existing) {
      return existing.id;
    }

    const code =
      "EAD-" +
      Date.now().toString(36).toUpperCase() +
      "-" +
      Math.random().toString(36).slice(2, 7).toUpperCase();

    const inserted = await db("structures").insert(
      {
        code,
        name: structureName,
        structure_type: "klassificering",
        agency_name: metadata.agencyName || "Unknown",
        language_code: metadata.languageCode || "swe",
      },
      ["id"]
    );

    return inserted[0].id;
  }

  /**
   * Ensure the standard classification node types exist.
   */
  async ensureClassificationNodeTypes(trx) {
    const definitions = [
      {
        code: "verksamhetsomrade",
        name: "Verksamhetsområde",
      },
      {
        code: "processgrupp",
        name: "Processgrupp",
      },
      {
        code: "process",
        name: "Process",
      },
    ];

    const typeIds = {};

    for (const definition of definitions) {
      let row = await trx("node_types")
        .where({
          code: definition.code,
          structure_type: "klassificering",
        })
        .first();

      if (!row) {
        const inserted = await trx("node_types").insert(
          {
            code: definition.code,
            name: definition.name,
            structure_type: "klassificering",
            ead_level: "class",
            ead_otherlevel: null,
            description: null,
            is_active: true,
          },
          ["id"]
        );

        row = { id: inserted[0].id };
      }

      typeIds[definition.code] = row.id;
    }

    return typeIds;
  }

  /**
   * Import one EAD document and its tree.
   *
   * The archdesc wrapper is not inserted as a node.
   * Its children are inserted as top-level nodes.
   */
  async importDocument({
    structureId,
    structureName,
    metadata = {},
    rootNode,
    sourceFileName = null,
  }) {
    if (!rootNode) {
      throw new Error("The EAD document has no root node.");
    }

    if (!structureId && !structureName) {
      throw new Error(
        "Either structureId or structureName is required."
      );
    }

    return this.knex.transaction(async (trx) => {
      let targetStructureId = structureId;

      if (!targetStructureId) {
        targetStructureId = await this.findOrCreateStructure(
          structureName,
          metadata,
          trx
        );
      }

      const structure = await trx("structures")
        .where({
          id: targetStructureId,
          structure_type: "klassificering",
        })
        .first();

      if (!structure) {
        throw new Error(
          "The selected classification structure does not exist."
        );
      }

      // Ensure standard types, then cache all classification types.
      await this.ensureClassificationNodeTypes(trx);

      const existingTypes = await trx("node_types")
        .where({
          structure_type: "klassificering",
        })
        .select("id", "code");

      const nodeTypeCache = new Map(
        existingTypes.map((type) => [
          type.code,
          type.id,
        ])
      );

      // Read existing reference codes once.
      // This is necessary because the database has a unique index
      // on (structure_id, reference_code).
      const existingCodes = await trx("nodes")
        .where({
          structure_id: targetStructureId,
        })
        .whereNotNull("reference_code")
        .select("reference_code");

      const usedReferenceCodes = new Set(
        existingCodes.map((row) =>
          String(row.reference_code).trim()
        )
      );

      const documentRows = await trx("ead_documents").insert(
        {
          structure_id: targetStructureId,
          record_id: metadata.recordId || null,
          title_proper:
            metadata.titleProper || rootNode.name || null,
          edition: metadata.edition || null,
          agency_name: metadata.agencyName || null,
          country_code: metadata.countryCode || null,
          language_code: metadata.languageCode || null,
          script_code: metadata.scriptCode || null,
          publication_status:
            metadata.publicationStatus || null,
          source_file_name: sourceFileName,
        },
        ["id"]
      );

      const documentId = documentRows[0].id;
      let importedNodeCount = 0;

      const getUniqueReferenceCode = (value) => {
        const code =
          value == null ? "" : String(value).trim();

        if (!code || usedReferenceCodes.has(code)) {
          return null;
        }

        usedReferenceCodes.add(code);
        return code;
      };

      const getNodeTypeId = async (node) => {
        const typeInfo = this.getNodeTypeInfo(node);

        if (nodeTypeCache.has(typeInfo.code)) {
          return nodeTypeCache.get(typeInfo.code);
        }

        const inserted = await trx("node_types").insert(
          {
            code: typeInfo.code,
            name: typeInfo.name,
            structure_type: "klassificering",
            ead_level: node.level || null,
            ead_otherlevel: node.otherlevel || null,
            description: null,
            is_active: true,
          },
          ["id"]
        );

        const id = inserted[0].id;
        nodeTypeCache.set(typeInfo.code, id);

        return id;
      };

      const insertNode = async (node, parentId) => {
        if (!node || !node.name) {
          throw new Error(
            "A classification node is missing its name."
          );
        }

        const nodeTypeId = await getNodeTypeId(node);

        const insertedRows = await trx("nodes").insert(
          {
            structure_id: targetStructureId,
            parent_id: parentId,
            node_type_id: nodeTypeId,
            reference_code: getUniqueReferenceCode(node.unitid),
            title: node.name,
            sort_order: importedNodeCount,
            is_published: false,
            external_id: null,
            description:
              node.description ||
              node.structuralUnitDescription ||
              null,
            previous_reference_code: null,
            ead_document_id: documentId,
            ead_id: node.eadId || null,
            scope_content: node.scopeContent || null,
            appraisal: node.appraisal || null,
            ead_audience: node.audience || null,
            local_type: node.otherlevel || node.level || null,
          },
          ["id"]
        );

        const insertedNodeId = insertedRows[0].id;
        importedNodeCount += 1;

        for (const childNode of node.children || []) {
          await insertNode(childNode, insertedNodeId);
        }
      };

      for (const node of rootNode.children || []) {
        await insertNode(node, null);
      }

      return {
        structureId: targetStructureId,
        documentId,
        importedNodeCount,
      };
    });
  }
}

module.exports = { EadRepository };
