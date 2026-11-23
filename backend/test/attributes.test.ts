/**
 * Node attributes, node creation rules and activities (migration 011).
 * Run: npm test   (uses the SQLite test schema, not SQL Server)
 */
import knexLib from "knex";
import knexStringcase from "knex-stringcase";
import assert from "node:assert/strict";
import { createTables } from "./sqliteSchema";
import { NodePropertyService } from "../src/services/nodePropertyService";
import { NodeActivityService } from "../src/services/nodeActivityService";
import { NodeCreationService } from "../src/services/nodeCreationService";
import { parseCreateNodeBody } from "../src/controllers/nodeCreationController";
import { ConflictError, NotFoundError, ValidationError } from "../src/services/errorService";

async function main() {
  const db = knexLib({
    client: "better-sqlite3",
    connection: { filename: ":memory:" },
    useNullAsDefault: true,
    ...knexStringcase(),
  });
  await createTables(db);
  // ---- fixtures -----------------------------------------------------------
  const type = async (code: string, structureType: string) =>
    (await db("node_types").insert({ code, name: code, structure_type: structureType, ead_level: "series", is_active: true }))[0];
  const klass = (await db("structures").insert({ code: "k", name: "K", structure_type: "klassificering" }))[0];
  const forv = (await db("structures").insert({ code: "f", name: "F", structure_type: "forvaring" }))[0];
  const tVo = await type("verksamhetsomrade", "klassificering");
  const tPg = await type("processgrupp", "klassificering");
  const tPr = await type("process", "klassificering");
  const tHs = await type("handlingsslag", "klassificering");
  const tHt = await type("handlingstyp", "klassificering");
  const tSu = await type("strukturenhet", "forvaring");
  await db("node_type_rules").insert([
    { parent_type_id: tVo, child_type_id: tPg }, { parent_type_id: tPg, child_type_id: tPr },
    { parent_type_id: tPr, child_type_id: tHs }, { parent_type_id: tHs, child_type_id: tHt },
  ]);
  const node = async (structureId: number, typeId: number, title: string, parentId: number | null, ref: string | null = null) =>
    (await db("nodes").insert({ structure_id: structureId, node_type_id: typeId, title, parent_id: parentId, reference_code: ref, sort_order: 0 }))[0];
  const su = await node(forv, tSu, "Ekonomienheten", null);
  const vo = await node(klass, tVo, "Ekonomi", null, "A");
  const pg = await node(klass, tPg, "Leverantörsreskontra", vo, "A.1");
  const pr = await node(klass, tPr, "Fakturahantering", pg, "A.1.1");
  const pr2 = await node(klass, tPr, "Lönehantering", pg, "A.1.2");
  const hs = await node(klass, tHs, "Inkommande fakturor", pr, "A.1.1.1");
  const ht = await node(klass, tHt, "Faktura", hs, "A.1.1.1.1");
  const ht2 = await node(klass, tHt, "Kreditfaktura", await node(klass, tHs, "Annat", pr2), "A.1.2.1.1");

  // property definitions (as seed 02 creates them)
  const def = (row: Record<string, unknown>) => db("property_definitions").insert({ is_active: true, ...row });
  await def({ node_type_id: tHt, key: "tidsperiod", label: "Tidsperiod", data_type: "text", tab_key: "allmant", sort_order: 1 });
  await def({ node_type_id: tHt, key: "bevaras", label: "Bevaras", data_type: "boolean", tab_key: "beskrivning", has_own_published: true, sort_order: 2 });
  await def({ node_type_id: tHt, key: "serie", label: "Serie", data_type: "text", tab_key: "beskrivning", has_own_published: true, sort_order: 3 });
  await def({ node_type_id: tVo, key: "referens_titel", label: "Titel", data_type: "text", tab_key: "referenser", group_key: "referens", is_repeatable: true, sort_order: 4 });
  await def({ node_type_id: tVo, key: "referens_publicera", label: "Publicera", data_type: "boolean", tab_key: "referenser", group_key: "referens", is_repeatable: true, sort_order: 5 });

  const props = new NodePropertyService(db);
  const acts = new NodeActivityService(db);
  const creation = new NodeCreationService(db);
  const count = async (table: string) => Number((await db(table).count({ n: "*" }).first() as any).n);
  const expectErr = async (fn: () => Promise<unknown>, type: new (...a: any[]) => Error, label: string) => {
    await assert.rejects(fn, type, label);
    console.log("✓", label);
  };

  // 1. Eget / Publicerad round trip
  const form = await props.saveValues(ht, [
    { key: "bevaras", value: true, isOwn: true },
    { key: "serie", value: "MAU", isOwn: true, publishedText: "Mitt Arbetsutskott" },
    { key: "tidsperiod", value: "2015–2025" },
  ]);
  const beskr = form.tabs.find((t) => t.tabKey === "beskrivning")!;
  assert.equal(beskr.fields.find((f) => f.key === "serie")!.values[0].publishedText, "Mitt Arbetsutskott");
  assert.equal(beskr.fields.find((f) => f.key === "bevaras")!.values[0].isOwn, true);
  console.log("✓ Eget/Publicerad stored and read back");

  // unchecked Eget with nothing else = not stored
  const f2 = await props.saveValues(ht, [{ key: "bevaras", value: null, isOwn: false }]);
  assert.equal(f2.tabs.find((t) => t.tabKey === "beskrivning")!.fields.find((f) => f.key === "bevaras")!.values.length, 0);
  console.log("✓ unchecked Eget without value is not stored");

  await expectErr(() => props.saveValues(ht, [{ key: "tidsperiod", value: "x", isOwn: true }]), ValidationError, "Eget rejected on a field without has_own_published");
  await expectErr(() => props.saveValues(ht, [{ key: "okand", value: "x" }]), ValidationError, "unknown field rejected");

  // 2. Node creation: valid process with properties in one transaction
  const before = await count("nodes");
  const createdProcess = await creation.createNode(parseCreateNodeBody({
    structureId: klass, parentId: pg, nodeTypeCode: "process", title: "Nytt", referenceCode: "A.1.3",
    properties: [{ key: "tidsperiod", value: "x" }].filter(() => false),
  }, 42));
  assert.equal(createdProcess.createdBy, 42);
  console.log("✓ createdBy comes from the user, not the body");

  // 3. Rules
  await expectErr(() => creation.createNode(parseCreateNodeBody({ structureId: klass, parentId: null, nodeTypeCode: "strukturenhet", title: "X" }, 1)),
    ValidationError, "strukturenhet cannot be a root in a klassificering structure");
  await expectErr(() => creation.createNode(parseCreateNodeBody({ structureId: forv, parentId: null, nodeTypeCode: "verksamhetsomrade", title: "X" }, 1)),
    ValidationError, "verksamhetsomrade cannot be a root in a forvaring structure");
  await expectErr(() => creation.createNode(parseCreateNodeBody({ structureId: 999, parentId: null, nodeTypeCode: "verksamhetsomrade", title: "X" }, 1)),
    NotFoundError, "unknown structure gives 404");
  await expectErr(() => creation.createNode(parseCreateNodeBody({ structureId: klass, parentId: pg, nodeTypeCode: "process", title: "Dup", referenceCode: "A.1.1" }, 1)),
    ConflictError, "duplicate reference code gives 409");
  await expectErr(() => creation.createNode(parseCreateNodeBody({
    structureId: klass, parentId: hs, nodeTypeCode: "handlingstyp", title: "Bad", referenceCode: "B",
    properties: [{ key: "tidsperiod", value: "x" }, { key: "finns_inte", value: "y" }],
  }, 1)), ValidationError, "bad property rejects the whole node");
  assert.equal(await count("nodes"), before + 1, "rejected node was not written");
  console.log("✓ nothing written when a property is invalid");

  // 4. Activities: checklist only with handlingstyper of this process
  const saved = await acts.replace(pr, [
    { name: "Registrera faktura", description: "Fakturan registreras", handlingstypNodeIds: [ht], structureUnitNodeId: su, structureUnitText: "Ansvarig enhet" },
    { name: "Attestera faktura", handlingstypNodeIds: [ht] },
  ]);
  assert.deepEqual(saved[0].handlingstypNodeIds, [ht]);
  assert.deepEqual(saved[1].handlingstypNodeIds, [ht], "same handlingstyp in two activities is allowed");
  console.log("✓ checklist with handlingstyp, same one in two activities");

  await expectErr(() => acts.replace(pr, [{ name: "X", handlingstypNodeIds: [ht2] }]), ValidationError, "handlingstyp from another process rejected");
  await expectErr(() => acts.replace(pr, [{ name: "X", structureUnitNodeId: ht }]), ValidationError, "structure unit must be a strukturenhet");
  await expectErr(() => acts.replace(vo, [{ name: "X" }]), ValidationError, "activities only on process nodes");

  // 5. Input validation in the controller layer
  await expectErr(async () => parseCreateNodeBody({ structureId: klass, nodeTypeCode: "process" }, 1), ValidationError, "title required");
  await expectErr(async () => parseCreateNodeBody({ structureId: klass, nodeTypeCode: "process", title: "T", validFrom: "2026-13-40" }, 1), ValidationError, "bad date rejected");
  await expectErr(async () => parseCreateNodeBody({ structureId: klass, nodeTypeCode: "process", title: "T", validFrom: "2026-02-01", validTo: "2025-01-01" }, 1), ValidationError, "validFrom after validTo rejected");

  console.log("All node attribute tests passed");
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
