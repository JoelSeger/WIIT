const knex = require("../../database/knex");

function getInsertedId(rows) {
  if (!Array.isArray(rows) || !rows[0] || rows[0].id == null) {
    throw new Error("Could not retrieve the inserted ID.");
  }

  return rows[0].id;
}

class EadRepository {
  async importDocument(input) {
    return knex.transaction(async (trx) => {
      const structure = await trx("classification_structures")
        .where({ id: input.structureId })
        .first();

      if (!structure) {
        const error = new Error("Classification structure does not exist.");
        error.code = "STRUCTURE_NOT_FOUND";
        throw error;
      }

      const documentRows = await trx("ead_documents")
        .insert({
          classification_structure_id: input.structureId,
          record_id: input.metadata.recordId,
          title_proper: input.metadata.titleProper,
          edition: input.metadata.edition,
          agency_name: input.metadata.agencyName,
          country_code: input.metadata.countryCode || "SE",
          language_code: input.metadata.languageCode,
          script_code: input.metadata.scriptCode,
          publication_status: input.metadata.publicationStatus,
          source_file_name: input.sourceFileName,
          ead_version: input.metadata.eadVersion || "EAD3",
          source_xml: input.sourceXml,
          import_status: "completed",
          imported_at: new Date(),
        })
        .returning("id");

      const documentId = getInsertedId(documentRows);
      let nodeCount = 0;

      async function insertNode(node, parentId) {
        const nodeRows = await trx("classification_nodes")
          .insert({
            ead_document_id: documentId,
            classification_structure_id: input.structureId,
            parent_id: parentId,
            node_type: node.nodeType,
            name: node.name,
            unitid: node.unitid,
            ead_id: node.eadId,
            ead_level: node.level,
            ead_otherlevel: node.otherlevel,
            ead_audience: node.audience,
            description: node.description,
            scope_content: node.scopeContent,
            appraisal: node.appraisal,
          })
          .returning("id");

        const nodeId = getInsertedId(nodeRows);
        nodeCount++;

        for (const child of node.children || []) {
          await insertNode(child, nodeId);
        }
      }

      await insertNode(input.rootNode, null);

      return {
        documentId,
        structureId: input.structureId,
        nodeCount,
      };
    });
  }
  async findOrCreateStructure(name) {
  const existing = await knex("classification_structures")
    .where({ name })
    .first();

  if (existing) {
    return existing.id;
  }

  const rows = await knex("classification_structures")
    .insert({ name })
    .returning("id");

  return getInsertedId(rows);
}
}

module.exports = { EadRepository };