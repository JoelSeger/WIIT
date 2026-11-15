import type { Knex } from "knex";
import { StructureRepository } from "../repos/structureRepository";
import { ChangeLogRepository } from "../repos/changeLogRepository";
import { ConflictError, NotFoundError, ValidationError } from "./errorService";
import type { Structure } from "../models/structure/structure";
import type {
  EditStructureRequest,
  StructureAttributeChanges,
  StructureDetails,
} from "../types/structureEdit.types";

/** What is written to change_log: only the things that really changed, old and new. */
type Snapshot = Record<string, unknown>;

/**
 * F1.1.2 – edit a (classification) structure.
 *
 * One edit = one transaction:
 *   1. the columns of the structure (name, version, validity...)
 *   2. updated_at / updated_by
 *   3. one change_log row (entity 'structure', action 'update') with old and new values
 * If any step fails, nothing is saved.
 *
 * The edit does not look at the structure type, so it works for every kind of structure.
 * What an edit can NOT change:
 *   - structure_type: every node of the structure has a node type of that kind
 *   - is_published: publishing is a separate function
 *   - previous_structure_id: the version chain needs its own checks
 *   - the nodes of the structure: they have their own functions (F3.x)
 */
export class StructureEditService {
  constructor(private readonly knex: Knex) {}

  /** The structure with all its fields – what the edit form is filled from. */
  async getStructure(structureId: number): Promise<StructureDetails> {
    const structure = await new StructureRepository(this.knex).findById(structureId);
    if (!structure) throw new NotFoundError(`Structure ${structureId} was not found`);

    return {
      id: structure.id,
      code: structure.code,
      name: structure.name,
      structureType: structure.structureType,
      description: structure.description ?? null,
      version: structure.version ?? null,
      validFrom: this.toDateString(structure.validFrom),
      validTo: this.toDateString(structure.validTo),
      isPublished: Boolean(structure.isPublished),
      previousStructureId: structure.previousStructureId ?? null,
      externalId: structure.externalId ?? null,
      updatedAt: structure.updatedAt ?? null,
      updatedBy: structure.updatedBy ?? null,
    };
  }

  async editStructure(request: EditStructureRequest): Promise<StructureDetails> {
    await this.knex.transaction(async (trx) => {
      const structures = new StructureRepository(this.knex, trx);

      const structure = await structures.findById(request.structureId);
      if (!structure) throw new NotFoundError(`Structure ${request.structureId} was not found`);

      // --- 1. check what changed and whether it is allowed ----------------------------------
      const { changes, oldValues, newValues } = this.diffColumns(structure, request);
      await this.validateColumns(structures, structure, changes);

      // Nothing really changed: do not touch the structure and do not write a log row.
      if (Object.keys(changes).length === 0) return;

      // --- 2. write ------------------------------------------------------------------------
      await structures.updateAttributes(structure.id, changes, request.updatedBy);

      // --- 3. traceability -----------------------------------------------------------------
      await new ChangeLogRepository(this.knex, trx).logStructureUpdate({
        structureId: structure.id,
        oldValue: oldValues,
        newValue: newValues,
        changedBy: request.updatedBy,
      });
    });

    return this.getStructure(request.structureId);
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /** Compares what was sent with what is stored. Only real differences end up in `changes`. */
  private diffColumns(
    structure: Structure,
    request: EditStructureRequest,
  ): { changes: StructureAttributeChanges; oldValues: Snapshot; newValues: Snapshot } {
    const changes: StructureAttributeChanges = {};
    const oldValues: Snapshot = {};
    const newValues: Snapshot = {};

    const stored: Required<StructureAttributeChanges> = {
      code: structure.code,
      name: structure.name,
      description: structure.description ?? null,
      version: structure.version ?? null,
      validFrom: this.toDateString(structure.validFrom),
      validTo: this.toDateString(structure.validTo),
      externalId: structure.externalId ?? null,
    };

    for (const field of Object.keys(stored) as (keyof StructureAttributeChanges)[]) {
      const sent = request[field];
      if (sent === undefined || sent === stored[field]) continue;
      (changes as Record<string, unknown>)[field] = sent;
      oldValues[field] = stored[field];
      newValues[field] = sent;
    }
    return { changes, oldValues, newValues };
  }

  /** Rules that depend on the stored structure. Format checks were already done by the controller. */
  private async validateColumns(
    structures: StructureRepository,
    structure: Structure,
    changes: StructureAttributeChanges,
  ): Promise<void> {
    // The date range is checked on the result: sending only validTo must still be >= stored validFrom.
    const validFrom = "validFrom" in changes ? changes.validFrom : this.toDateString(structure.validFrom);
    const validTo = "validTo" in changes ? changes.validTo : this.toDateString(structure.validTo);
    if (validFrom && validTo && validFrom > validTo) {
      throw new ValidationError("validFrom must be before validTo");
    }

    if (changes.code) {
      const other = await structures.findByCode(changes.code);
      if (other && other.id !== structure.id) {
        throw new ConflictError(`A structure with code '${changes.code}' already exists`);
      }
    }
    if (changes.externalId) {
      const other = await structures.findByExternalId(changes.externalId);
      if (other && other.id !== structure.id) {
        throw new ConflictError(`A structure with external id '${changes.externalId}' already exists`);
      }
    }
  }

  private toDateString(d: unknown): string | null {
    if (!d) return null;
    return d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10);
  }
}
