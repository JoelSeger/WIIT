
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

      // 1. تحديد الأرشيف: موجود أم جديد؟
      if (request.archiveId !== undefined) {
        if (request.newArchive) {
          throw new Error(
            "Provide either archiveId or newArchive, not both.",
          );
        }

        const existingArchive =
          await archiveRepository.findById(request.archiveId);

        if (!existingArchive) {
          throw new Error("Archive not found.");
        }

        archive = existingArchive;
      } else {
        if (!request.newArchive) {
          throw new Error(
            "Provide archiveId or newArchive.",
          );
        }

        // 2. تحديد Arkivbildare عند إنشاء Archive جديد
        let creatorId: number;

        if (request.archiveCreatorId !== undefined) {
          if (request.newArchiveCreator) {
            throw new Error(
              "Provide either archiveCreatorId or newArchiveCreator, not both.",
            );
          }

          const existingCreator =
            await creatorRepository.findById(
              request.archiveCreatorId,
            );

          if (!existingCreator) {
            throw new Error("Archive creator not found.");
          }

          creatorId = existingCreator.id;
        } else {
          if (!request.newArchiveCreator) {
            throw new Error(
              "A new archive requires an existing or a new archive creator.",
            );
          }

          const now = new Date();

          createdCreator = await creatorRepository.create({
            parentId: null,
            creatorType: "corporate",
            name: request.newArchiveCreator.name,
            startYear:
              request.newArchiveCreator.start_year ?? null,
            endYear:
              request.newArchiveCreator.end_year ?? null,
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

        // 3. إنشاء Archive
        const now = new Date();

        archive = await archiveRepository.create({
          archiveCreatorId: creatorId,
          referenceCode:
            request.newArchive.reference_code ?? null,
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

      // 4. إنشاء Structure
      const now = new Date();

      const structure = await structureRepository.create({
        code: request.structure.code,
        name: request.structure.name,
        // Ska förändras sen
        structure_type: "klassificering",
        description: request.structure.description ?? null,
        valid_from: request.structure.valid_from ?? null,
        valid_to: request.structure.valid_to ?? null,
        is_published: false,
        version: request.structure.version ?? null,
        previous_structure_id: null,
        created_at: now,
        created_by: request.createdBy,
        updated_at: now,
        updated_by: request.createdBy,
      });

      // 5. ربط Structure بـ Archive
      await archiveStructureRepository.create({
        archive_id: archive.id,
        structure_id: structure.id,
        valid_from: null,
        valid_to: null,
        created_by: request.createdBy,
      });

      // عند نجاح callback، Knex ينفذ COMMIT تلقائيًا.
      // عند حدوث خطأ، Knex ينفذ ROLLBACK تلقائيًا.
      return {
        archiveCreator: createdCreator,
        archive,
        structure,
      };
    });
  }
}
