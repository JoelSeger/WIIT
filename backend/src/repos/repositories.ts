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
import { UserRepository } from "./userRepository";
import { AdGroupRoleRepository } from "./adGroupRoleRepository";
import { SearchRepository } from "./searchRepository";


// This is currently a very cheap to run but if we ever increase the amout of repos substantionally,
// this could be improved by simple lazy loading the repos. But this can be changed later.
const registry = {
  nodes: NodeRepository,
  nodeTypes: NodeTypeRepository,
  structures: StructureRepository,
  propertyDefinitions: PropertyDefinitionRepository,
  nodeProperties: NodePropertyRepository,
  nodeActivities: NodeActivityRepository,
  nodeRelations: NodeRelationRepository,
  changeLog: ChangeLogRepository,
  archives: ArchiveRepository,
  archiveCreators: ArchiveCreatorRepository,
  archiveStructures: ArchiveStructureRepository,
  user: UserRepository,
  adGroupRoles: AdGroupRoleRepository,
  search: SearchRepository,
} satisfies Record<string, new (db: Knex) => unknown>;   // compile error if a repo has another constructor

export type Repositories = {
  [K in keyof typeof registry]: InstanceType<(typeof registry)[K]>;
};

export function createRepositories(db: Knex): Repositories {
  return Object.fromEntries(
    Object.entries(registry).map(([name, Repo]) => [name, new Repo(db)]),
  ) as Repositories;
}
