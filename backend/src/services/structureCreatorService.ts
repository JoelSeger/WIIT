
import type { Knex } from "knex";

import { ArchiveCreatorRepository } from "../repos/archiveCreatorRepository";
import { ArchiveRepository } from "../repos/archiveRepository";
import { StructureRepository } from "../repos/structureRepository";
import { ArchiveStructureRepository } from "../repos/archiveStructureRepository";

import type { ArchiveCreator } from "../models/archive/archiveCreator";
import type { Archive } from "../models/archive/archive";
import type { Structure } from "../models/structure/structure";

import type {
  CreateStructureRequest,
} from "../types/structureCreation.types";
import { ConflictError, NotFoundError, ValidationError } from "./errorService";

export interface CreateStructureResult {
  archiveCreator?: ArchiveCreator;
  archive: Archive;
  structure: Structure;
}

export class StructureCreationService {
  constructor(private readonly knex: Knex) {}

  async create(
    request: CreateStructureRequest,
  ): Promise<CreateStructureResult> {
    const code = request.structure.code?.trim();
    const name = request.structure.name?.trim();
    if (!code) throw new ValidationError("Structure code is required.");
    if (!name) throw new ValidationError("Structure name is required.");

    if (await new StructureRepository(this.knex).findByCode(code)) {
      throw new ConflictError(`A structure with code '${code}' already exists.`);
    }

    return this.knex.transaction(async (trx) => {
      const creatorRepository =
        new ArchiveCreatorRepository(this.knex, trx);

      const archiveRepository =
        new ArchiveRepository(this.knex, trx);

      const structureRepository =
        new StructureRepository(this.knex, trx);

      const archiveStructureRepository =
        new ArchiveStructureRepository(this.knex, trx);

      let createdCreator: ArchiveCreator | undefined;
      let archive: Archive;

      // 1. Determin wether it is an existing archive or a new one
      if (request.archiveId !== undefined) {
        if (request.newArchive) {
          throw new ValidationError("Provide either archiveId or newArchive, not both.");
        }

        const existingArchive =
          await archiveRepository.findById(request.archiveId);

        if (!existingArchive) {
          throw new NotFoundError("Archive not found.");
        }

        archive = existingArchive;
      } else {
        if (!request.newArchive) {
          throw new ValidationError("Provide archiveId or newArchive.");
        }

        // 2. Choosing an archive_craetor when creating an archive
        let creatorId: number;

        if (request.archiveCreatorId !== undefined) {
          if (request.newArchiveCreator) {
            throw new ValidationError("Provide either archiveCreatorId or newArchiveCreator, not both.");
          }

          const existingCreator =
            await creatorRepository.findById(
              request.archiveCreatorId,
            );

          if (!existingCreator) {
            throw new NotFoundError("Archive creator not found.");
          }

          creatorId = existingCreator.id;
        } else {
          if (!request.newArchiveCreator) {
            throw new ValidationError("A new archive requires an existing or a new archive creator.");
          }

          const now = new Date();

          createdCreator = await creatorRepository.create({
            parentId: null,
            creatorType: "corporate",
            name: request.newArchiveCreator.name,
            startYear:
              request.newArchiveCreator.startYear ?? null,
            endYear:
              request.newArchiveCreator.endYear ?? null,
            description:
              request.newArchiveCreator.description ?? null,
            externalId: null,
            isPublished: false,
            createdAt: now,
            createdBy: request.createdBy,
            updatedAt: now,
            updatedBy: request.createdBy,
          });

          creatorId = createdCreator.id;
        }

        // Create archive
        const now = new Date();

        archive = await archiveRepository.create({
          archiveCreatorId: creatorId,
          referenceCode:
            request.newArchive.referenceCode ?? null,
          name: request.newArchive.name,
          startYear: null,
          endYear: null,
          description: null,
          externalId: null,
          isPublished: false,
          createdAt: now,
          createdBy: request.createdBy,
          updatedAt: now,
          updatedBy: request.createdBy,
        });
      }

      // Create structure
      const now = new Date();

      const structure = await structureRepository.create({
        code,
        name,
        structureType: "klassificering",
        description: request.structure.description ?? null,
        validFrom: request.structure.validFrom ?? null,
        validTo: request.structure.validTo ?? null,
        isPublished: false,
        agencyCode: request.structure.agencyCode ?? null,
        agencyName: request.structure.agencyName ?? null,
        languageCode: request.structure.languageCode ?? "swe",
        license: request.structure.license ?? null,
        version: request.structure.version ?? null,
        previousStructureId: null,
        externalId: request.structure.externalId ?? null,
        createdAt: now,
        createdBy: request.createdBy,
        updatedAt: now,
        updatedBy: request.createdBy,
      });

      // 5. Link an archive to a structure
      await archiveStructureRepository.create({
        archiveId: archive.id,
        structureId: structure.id,
        validFrom: null,
        validTo: null,
        createdBy: request.createdBy,
      });

      
      return {
        archiveCreator: createdCreator,
        archive,
        structure,
      };
    });
  }
}
