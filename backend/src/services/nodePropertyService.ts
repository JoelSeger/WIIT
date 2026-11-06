import type { Knex } from "knex";
import { NodeRepository } from "../repos/nodeRepository";
import { NodeTypeRepository } from "../repos/nodeTypeRepository";
import { PropertyDefinitionRepository } from "../repos/propertyDefinitionRepository";
import { NodePropertyRepository } from "../repos/nodePropertyRepository";
import type { PropertyDefinition } from "../models/property/propertyDefinition";
import type { NodePropertyValues } from "../models/node/nodePropertyValues";
import type { Node } from "../models/node/node";
import {
  TAB_LABELS,
  TAB_ORDER,
  type FormField,
  type FormTab,
  type NodeForm,
  type PropertyScalar,
  type PropertyValueInput,
  type TabKey,
} from "../types/node.properties.types";
import { NotFoundError, ValidationError } from "../services/errorService";

interface StoredValue {
  valueText: string | null;
  valueNumber: number | null;
  valueDate: string | null;
  valueBoolean: boolean | null;
}

const EMPTY: StoredValue = { valueText: null, valueNumber: null, valueDate: null, valueBoolean: null };

export class NodePropertyService {
  constructor(private readonly knex: Knex) {}

  // ---------------------------------------------------------------------------
  // Read: the form of one node = its fields (for its node type) + the current values
  // ---------------------------------------------------------------------------

  async getForm(nodeId: number): Promise<NodeForm> {
    const node = await new NodeRepository(this.knex).findById(nodeId);
    if (!node) throw new NotFoundError(`Node ${nodeId} was not found`);

    const nodeType = await new NodeTypeRepository(this.knex).findOne(node.nodeTypeId);
    const defRepo = new PropertyDefinitionRepository(this.knex);
    const defs = await defRepo.findActiveByNodeType(node.nodeTypeId);
    const options = await defRepo.findActiveOptions(defs.filter((d) => d.dataType === "enum").map((d) => d.id));
    const stored = await new NodePropertyRepository(this.knex).findByNodeId(nodeId);

    const byTab = new Map<TabKey, FormField[]>();
    for (const def of defs) {
      const tabKey = this.asTabKey(def.tabKey);
      const field: FormField = {
        key: def.key,
        label: def.label,
        dataType: def.dataType,
        isRequired: !!def.isRequired,
        isPublic: def.isPublic !== false,
        isRepeatable: !!def.isRepeatable,
        hasOwnPublished: !!def.hasOwnPublished,
        groupKey: def.groupKey,
        helpText: def.helpText,
        options: options.filter((o) => o.propertyDefinitionId === def.id).map((o) => o.value),
        values: stored
          .filter((v) => v.propertyDefinitionId === def.id)
          .map((v) => ({
            rowIndex: v.valueOrder,
            value: this.readValue(def, v),
            isOwn: v.isOwn === null || v.isOwn === undefined ? null : !!v.isOwn,
            publishedText: v.publishedText ?? null,
          })),
      };
      byTab.set(tabKey, [...(byTab.get(tabKey) ?? []), field]);
    }

    const tabs: FormTab[] = TAB_ORDER.filter((k) => byTab.has(k)).map((k) => ({
      tabKey: k,
      label: TAB_LABELS[k],
      fields: byTab.get(k)!,
    }));

    return { nodeId, nodeTypeCode: nodeType?.code ?? "", tabs };
  }

  // ---------------------------------------------------------------------------
  // Write
  // ---------------------------------------------------------------------------

  /** Saves some fields of an existing node (e.g. everything on one tab). */
  async saveValues(nodeId: number, inputs: PropertyValueInput[], userId?: number | null): Promise<NodeForm> {
    await this.knex.transaction(async (trx) => {
      const node = await new NodeRepository(this.knex, trx).findById(nodeId);
      if (!node) throw new NotFoundError(`Node ${nodeId} was not found`);
      await this.saveValuesInTransaction(trx, node, inputs, userId, false);
    });
    return this.getForm(nodeId);
  }

  /**
   * Same, inside a transaction started by someone else (used by node creation, so the node and
   * its values are saved together or not at all).
   *
   * requireAll = true  (creating a node): every isRequired field must be present.
   * requireAll = false (editing): only the fields sent are checked.
   */
  async saveValuesInTransaction(
    trx: Knex.Transaction,
    node: Pick<Node, "id" | "nodeTypeId">,
    inputs: PropertyValueInput[] | undefined,
    userId: number | null | undefined,
    requireAll: boolean,
  ): Promise<void> {
    const list = inputs ?? [];
    const defRepo = new PropertyDefinitionRepository(this.knex, trx);
    const defs = await defRepo.findActiveByNodeType(node.nodeTypeId);
    if (list.length === 0 && !(requireAll && defs.some((d) => d.isRequired))) return;

    const defsByKey = new Map(defs.map((d) => [d.key, d]));
    const options = await defRepo.findActiveOptions(defs.filter((d) => d.dataType === "enum").map((d) => d.id));

    // 1. group by field; unknown fields are an error, not silently ignored
    const byKey = new Map<string, PropertyValueInput[]>();
    for (const input of list) {
      if (!defsByKey.has(input.key)) {
        throw new ValidationError(`Field '${input.key}' does not exist for this node type`);
      }
      byKey.set(input.key, [...(byKey.get(input.key) ?? []), input]);
    }

    // 2. validate and build the rows
    const rows: Omit<NodePropertyValues, "id">[] = [];
    for (const [key, group] of byKey) {
      const def = defsByKey.get(key)!;
      const allowed = options.filter((o) => o.propertyDefinitionId === def.id).map((o) => o.value);
      const seenRows = new Set<number>();
      let kept = 0;

      group.forEach((input, position) => {
        const { isOwn, publishedText } = this.checkOwnPublished(def, input);
        const hasValue = !this.isEmpty(input.value);
        // An unchecked Eget with nothing else in the row means "not filled in": nothing is stored.
        if (!hasValue && isOwn !== true && publishedText === null) return;

        const rowIndex = def.isRepeatable ? (input.rowIndex ?? position) : 0;
        if (!Number.isInteger(rowIndex) || rowIndex < 0) {
          throw new ValidationError(`Field '${key}': rowIndex must be 0 or higher`);
        }
        if (seenRows.has(rowIndex)) {
          throw new ValidationError(
            def.isRepeatable
              ? `Field '${key}': row ${rowIndex} was sent twice`
              : `Field '${key}' can only have one value`,
          );
        }
        seenRows.add(rowIndex);
        kept++;

        rows.push({
          nodeId: node.id,
          propertyDefinitionId: def.id,
          ...(hasValue ? this.coerce(def, input.value, allowed) : EMPTY),
          valueOrder: rowIndex,
          isOwn,
          publishedText,
          updatedAt: new Date(),
          updatedBy: userId ?? null,
        });
      });

      if (!def.isRepeatable && kept > 1) {
        throw new ValidationError(`Field '${key}' can only have one value`);
      }
      if (def.isRequired && kept === 0) {
        throw new ValidationError(`Field '${def.label}' is required`);
      }
    }

    if (requireAll) {
      for (const def of defs) {
        if (def.isRequired && !byKey.has(def.key)) {
          throw new ValidationError(`Field '${def.label}' is required`);
        }
      }
    }

    // 3. replace the stored values of exactly the fields that were sent
    const ids = [...byKey.keys()].map((k) => defsByKey.get(k)!.id);
    await new NodePropertyRepository(this.knex, trx).replaceValues(node.id, ids, rows);
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private asTabKey(value: string | null): TabKey {
    return value && value in TAB_LABELS ? (value as TabKey) : "allmant";
  }

  private isEmpty(value: PropertyScalar | undefined): boolean {
    return value === null || value === undefined || (typeof value === "string" && value.trim() === "");
  }

  /**
   * Eget (checkbox) and Publicerad (text box) exist only on fields with hasOwnPublished.
   * What "Eget" means is not known yet, so it is stored as given and nothing depends on it.
   */
  private checkOwnPublished(
    def: PropertyDefinition,
    input: PropertyValueInput,
  ): { isOwn: boolean | null; publishedText: string | null } {
    const hasOwn = input.isOwn !== null && input.isOwn !== undefined;
    const published = typeof input.publishedText === "string" ? input.publishedText.trim() : "";

    if ((hasOwn || published !== "") && !def.hasOwnPublished) {
      throw new ValidationError(`Field '${def.key}' has no Eget/Publicerad columns`);
    }
    if (hasOwn && typeof input.isOwn !== "boolean") {
      throw new ValidationError(`Field '${def.key}': isOwn must be true or false`);
    }
    if (input.publishedText !== null && input.publishedText !== undefined && typeof input.publishedText !== "string") {
      throw new ValidationError(`Field '${def.key}': publishedText must be text`);
    }
    return { isOwn: hasOwn ? (input.isOwn as boolean) : null, publishedText: published === "" ? null : published };
  }

  /** Checks the value against the data type and puts it in the one column that type uses. */
  private coerce(def: PropertyDefinition, raw: PropertyScalar, allowed: string[]): StoredValue {
    const bad = (what: string) => new ValidationError(`Field '${def.key}' must be ${what}`);

    switch (def.dataType) {
      case "text":
      case "longtext":
        return { ...EMPTY, valueText: String(raw).trim() };

      case "url": {
        const text = String(raw).trim();
        if (!/^https?:\/\/\S+$/i.test(text)) throw bad("a web address starting with http:// or https://");
        return { ...EMPTY, valueText: text };
      }

      case "enum": {
        // the database cannot check enum values (migration 009), so the service does
        const text = String(raw).trim();
        if (!allowed.includes(text)) throw bad(`one of: ${allowed.join(", ") || "(no choices defined)"}`);
        return { ...EMPTY, valueText: text };
      }

      case "number": {
        const n = typeof raw === "number" ? raw : Number(String(raw).replace(",", "."));
        if (!Number.isFinite(n)) throw bad("a number");
        return { ...EMPTY, valueNumber: n };
      }

      case "date": {
        const text = String(raw).trim();
        const ok = /^\d{4}-\d{2}-\d{2}$/.test(text) && !Number.isNaN(Date.parse(text));
        if (!ok) throw bad("a date as YYYY-MM-DD");
        return { ...EMPTY, valueDate: text };
      }

      case "boolean": {
        if (typeof raw === "boolean") return { ...EMPTY, valueBoolean: raw };
        if (raw === "true" || raw === "false") return { ...EMPTY, valueBoolean: raw === "true" };
        throw bad("true or false");
      }
    }
  }

  /** The reverse: the value of the one column the data type uses. */
  private readValue(def: PropertyDefinition, row: NodePropertyValues): PropertyScalar {
    switch (def.dataType) {
      case "number":
        return row.valueNumber === null || row.valueNumber === undefined ? null : Number(row.valueNumber);
      case "date": {
        const d = row.valueDate;
        if (!d) return null;
        return d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10);
      }
      case "boolean":
        return row.valueBoolean === null || row.valueBoolean === undefined ? null : !!row.valueBoolean;
      default:
        return row.valueText ?? null;
    }
  }
}
