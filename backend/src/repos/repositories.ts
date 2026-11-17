import type { Knex } from "knex";
import { ArchiveCreatorRepository } from "./archiveCreatorRepository";
import { ArchiveRepository } from "./archiveRepository";
import { ArchiveStructureRepository } from "./archiveStructureRepository";
import { ChangeLogRepository } from "./changeLogRepository";
import { NodeActivityRepository } from "./nodeActivityRepository";
import { NodePropertyRepository } from "./nodePropertyRepository";
import { NodeRelationRepository } from "./nodeRelationRepository";
import { NodeRepository } from "./nodeRepository";
import { NodeTypeRepository } from "./nodeTypeRepository";
import { PropertyDefinitionRepository } from "./propertyDefinitionRepository";
import { StructureRepository } from "./structureRepository";

/**
 * One place that knows how to build every repository.
 *
 * Why functions and not ready-made instances: a repository is bound to a transaction when it is
 * created (`new NodeRepository(knex, trx)`), and the transaction only exists inside
 * `knex.transaction(...)`. So a service asks for a repository when it needs one, and passes the
 * `trx` if it has one. Without `trx` the repository uses the plain connection.
 *
 * A service lists what it uses with `Pick<Repositories, "nodes" | "structures">`, so a test only
 * has to fake those.
 */
export interface Repositories {
  nodes(trx?: Knex.Transaction): NodeRepository;
  nodeTypes(trx?: Knex.Transaction): NodeTypeRepository;
  structures(trx?: Knex.Transaction): StructureRepository;
  propertyDefinitions(trx?: Knex.Transaction): PropertyDefinitionRepository;
  nodeProperties(trx?: Knex.Transaction): NodePropertyRepository;
  nodeActivities(trx?: Knex.Transaction): NodeActivityRepository;
  nodeRelations(trx?: Knex.Transaction): NodeRelationRepository;
  changeLog(trx?: Knex.Transaction): ChangeLogRepository;
  archives(trx?: Knex.Transaction): ArchiveRepository;
  archiveCreators(trx?: Knex.Transaction): ArchiveCreatorRepository;
  archiveStructures(trx?: Knex.Transaction): ArchiveStructureRepository;
}

/** The real repositories, all talking to the given database. This is what production uses. */
export function createRepositories(knex: Knex): Repositories {
  return {
    nodes: (trx) => new NodeRepository(knex, trx),
    nodeTypes: (trx) => new NodeTypeRepository(knex, trx),
    structures: (trx) => new StructureRepository(knex, trx),
    propertyDefinitions: (trx) => new PropertyDefinitionRepository(knex, trx),
    nodeProperties: (trx) => new NodePropertyRepository(knex, trx),
    nodeActivities: (trx) => new NodeActivityRepository(knex, trx),
    nodeRelations: (trx) => new NodeRelationRepository(knex, trx),
    changeLog: (trx) => new ChangeLogRepository(knex, trx),
    archives: (trx) => new ArchiveRepository(knex, trx),
    archiveCreators: (trx) => new ArchiveCreatorRepository(knex, trx),
    archiveStructures: (trx) => new ArchiveStructureRepository(knex, trx),
  };
}
