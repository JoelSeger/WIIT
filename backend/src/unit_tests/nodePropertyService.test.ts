import type { Knex } from "knex";
import type { Node } from "../models/node/node";
import type { NodeType } from "../models/node/nodeType";
import type { PropertyDefinition } from "../models/property/propertyDefinition";
import type { Structure } from "../models/structure/structure";
import type { NodePropertyValues } from "../models/node/nodePropertyValues";
import { NotFoundError, ValidationError } from "../services/errorService";
import { NodePropertyService, type NodePropertyRepos } from "../services/nodePropertyService";

// ---------------------------------------------------------------------------
// Helpers that build fake data (factories): a complete object with default values,
// and each test changes only the fields it cares about through overrides.
// ---------------------------------------------------------------------------
const makeNode = (overrides: Partial<Node> = {}): Node => ({
  id: 1,
  structureId: 10,
  parentId: null,
  nodeTypeId: 20,
  referenceCode: "A.1",
  previousReferenceCode: null,
  title: "Node",
  sortOrder: 0,
  isPublished: true,
  externalId: null,
  validFrom: new Date("2026-01-02T00:00:00.000Z"),
  validTo: new Date("2026-12-31T00:00:00.000Z"),
  description: "Description",
  portalUrl: null,
  sourceUpdatedAt: null,
  sourceUpdatedBy: null,
  rowVersion: Buffer.from([1, 2, 3]),
  ...overrides,
});

const makeDefinition = (overrides: Partial<PropertyDefinition> = {}): PropertyDefinition => ({
  id: 100,
  nodeTypeId: 20,
  key: "name",
  label: "Name",
  dataType: "text",
  isRequired: false,
  isPublic: true,
  eadElement: null,
  helpText: null,
  sortOrder: 0,
  isActive: true,
  isRepeatable: false,
  tabKey: "allmant",
  groupKey: null,
  hasOwnPublished: false,
  ...overrides,
});

const makeStored = (overrides: Partial<NodePropertyValues> = {}): NodePropertyValues => ({
  id: 500,
  nodeId: 1,
  propertyDefinitionId: 100,
  valueText: "stored",
  valueNumber: null,
  valueDate: null,
  valueBoolean: null,
  valueOrder: 0,
  isOwn: null,
  publishedText: null,
  ...overrides,
});

const makeNodeType = (overrides: Partial<NodeType> = {}): NodeType => ({
  id: 20,
  code: "process",
  name: "Process",
  structureType: "klassificering",
  eadLevel: "otherlevel",
  eadOtherlevel: null,
  eadUnitDescription: null,
  description: null,
  isActive: true,
  ...overrides,
});

const makeStructure = (overrides: Partial<Structure> = {}): Structure => ({
  id: 10,
  code: "KLA",
  name: "Classification",
  structureType: "klassificering",
  description: null,
  validFrom: null,
  validTo: null,
  isPublished: false,
  agencyCode: null,
  agencyName: null,
  languageCode: "swe",
  license: null,
  version: null,
  previousStructureId: null,
  externalId: null,
  ...overrides,
});

describe("NodePropertyService", () => {
  let nodes: { findById: jest.Mock };
  let nodeTypes: { findOne: jest.Mock };
  let structures: { findById: jest.Mock };
  let propertyDefinitions: { findActiveByNodeType: jest.Mock; findActiveOptions: jest.Mock };
  let nodeProperties: { findByNodeId: jest.Mock; replaceValues: jest.Mock };
  // Repository factories. They are jest.fn so we can see whether they were called with trx or without it.
  let repos: {
    nodes: jest.Mock;
    nodeTypes: jest.Mock;
    structures: jest.Mock;
    propertyDefinitions: jest.Mock;
    nodeProperties: jest.Mock;
  };
  let knex: Knex;
  let trx: Knex.Transaction;
  let service: NodePropertyService;

  // Before each test: fake repositories + a fake knex whose transaction runs the callback immediately with a fake trx.
  // The node, node type and structure exist by default (tests that need otherwise override them).
  beforeEach(() => {
    nodes = { findById: jest.fn().mockResolvedValue(makeNode()) };
    nodeTypes = { findOne: jest.fn().mockResolvedValue(makeNodeType()) };
    structures = { findById: jest.fn().mockResolvedValue(makeStructure()) };
    propertyDefinitions = {
      findActiveByNodeType: jest.fn().mockResolvedValue([]),
      findActiveOptions: jest.fn().mockResolvedValue([]),
    };
    nodeProperties = {
      findByNodeId: jest.fn().mockResolvedValue([]),
      replaceValues: jest.fn().mockResolvedValue(undefined),
    };
    repos = {
      nodes: jest.fn((_trx?: Knex.Transaction) => nodes),
      nodeTypes: jest.fn((_trx?: Knex.Transaction) => nodeTypes),
      structures: jest.fn((_trx?: Knex.Transaction) => structures),
      propertyDefinitions: jest.fn((_trx?: Knex.Transaction) => propertyDefinitions),
      nodeProperties: jest.fn((_trx?: Knex.Transaction) => nodeProperties),
    };
    trx = { name: "transaction" } as unknown as Knex.Transaction;
    knex = {
      transaction: jest.fn(async (callback: (transaction: Knex.Transaction) => Promise<unknown>) => callback(trx)),
    } as unknown as Knex;
    service = new NodePropertyService(knex, repos as unknown as NodePropertyRepos);
  });

  // =========================================================================
  // getForm
  // =========================================================================
  describe("getForm", () => {
    // TC212: Checks that getForm throws NotFoundError when the node does not exist, and does not attempt to load the node type afterwards.
    // What happens:
    //  1. The node lookup returns undefined (the node does not exist).
    //  2. getForm(99) throws NotFoundError immediately.
    //  3. nodeTypes.findOne is never called (the service stopped early).
    test("_TC212_getForm_rejectsMissingNode", async () => {
      nodes.findById.mockResolvedValue(undefined);

      await expect(service.getForm(99)).rejects.toThrow(NotFoundError);
      expect(nodeTypes.findOne).not.toHaveBeenCalled();
    });

    // TC213: Checks that the form is built from the node, property definitions, stored values, and Enum options, including metadata and values formatted for the frontend.
    // What happens:
    //  1. Two fields: "name" (text, tab allmant) and "count" (enum, tab beskrivning, required, repeatable, with groupKey, helpText and hasOwnPublished).
    //  2. One option "One" for the enum field (id=101), and two stored values.
    //  3. getForm returns: the header (dates as YYYY-MM-DD, rowVersion from Buffer [1,2,3] to base64 = "AQID"), two tabs in order (allmant, then beskrivning), and each field with its properties, values and options.
    //  4. findActiveOptions was called with [101] only, i.e. just the ids of enum fields.
    test("_TC213_getForm_mapsHeaderAndFormValues", async () => {
      propertyDefinitions.findActiveByNodeType.mockResolvedValue([
        makeDefinition({ id: 100, key: "name" }),
        makeDefinition({
          id: 101,
          key: "count",
          label: "Count",
          dataType: "enum",
          tabKey: "beskrivning",
          isPublic: false,
          isRequired: true,
          isRepeatable: true,
          groupKey: "group",
          helpText: "Help",
          hasOwnPublished: true,
        }),
      ]);
      propertyDefinitions.findActiveOptions.mockResolvedValue([{ propertyDefinitionId: 101, value: "One" }]);
      nodeProperties.findByNodeId.mockResolvedValue([
        makeStored({ propertyDefinitionId: 100, valueText: "Hello" }),
        makeStored({
          id: 501,
          propertyDefinitionId: 101,
          valueText: "One",
          valueNumber: null,
          valueOrder: 2,
          isOwn: false,
          publishedText: "Published",
        }),
      ]);

      await expect(service.getForm(1)).resolves.toEqual({
        nodeId: 1,
        nodeTypeCode: "process",
        node: {
          title: "Node",
          referenceCode: "A.1",
          previousReferenceCode: null,
          validFrom: "2026-01-02",
          validTo: "2026-12-31",
          description: "Description",
          isPublished: true,
          rowVersion: "AQID",
          nodeTypeName: "Process",
          structureName: "Classification",
        },
        tabs: [
          {
            tabKey: "allmant",
            label: "Allmänt",
            fields: [expect.objectContaining({ key: "name", values: [{ rowIndex: 0, value: "Hello", isOwn: null, publishedText: null }] })],
          },
          {
            tabKey: "beskrivning",
            label: "Beskrivning",
            fields: [
              expect.objectContaining({
                key: "count",
                isPublic: false,
                isRequired: true,
                isRepeatable: true,
                hasOwnPublished: true,
                groupKey: "group",
                helpText: "Help",
                options: ["One"],
                values: [{ rowIndex: 2, value: "One", isOwn: false, publishedText: "Published" }],
              }),
            ],
          },
        ],
      });
      expect(propertyDefinitions.findActiveOptions).toHaveBeenCalledWith([101]);
    });

    // TC214: Checks the defaults used when NodeType or Structure is missing, unknown tabs fall back to allmant, and missing or invalid metadata is normalized.
    // What happens:
    //  1. One field with an unknown tab "future" and null in isPublic/isRequired/isRepeatable/hasOwnPublished.
    //  2. The node type and structure are missing, validFrom=null, and rowVersion is a string rather than a Buffer.
    //  3. Result: nodeTypeCode/nodeTypeName/structureName = "", validFrom=null, validTo="2026-03-04", rowVersion=null.
    //  4. The field falls into the allmant tab, isPublic=true (null is not false), and isRequired/isRepeatable=false.
    test("_TC214_getForm_defaultsUnknownTabToAllmantAndNormalizesMissingMetadata", async () => {
      propertyDefinitions.findActiveByNodeType.mockResolvedValue([
        makeDefinition({ tabKey: "future", isPublic: null, isRequired: null, isRepeatable: null, hasOwnPublished: null }),
      ]);
      nodeTypes.findOne.mockResolvedValue(undefined);
      structures.findById.mockResolvedValue(undefined);
      nodes.findById.mockResolvedValue(makeNode({ validFrom: null, validTo: new Date("2026-03-04T12:00:00.000Z"), rowVersion: "version" as never }));

      const form = await service.getForm(1);

      expect(form.nodeTypeCode).toBe("");
      expect(form.node.nodeTypeName).toBe("");
      expect(form.node.structureName).toBe("");
      expect(form.node.validFrom).toBeNull();
      expect(form.node.validTo).toBe("2026-03-04");
      expect(form.node.rowVersion).toBeNull();
      expect(form.tabs[0]).toMatchObject({ tabKey: "allmant", fields: [{ isPublic: true, isRequired: false, isRepeatable: false }] });
    });

    // TC215: Checks that getForm reads stored Date and Boolean values correctly, and returns an empty values array when a field has no stored value.
    // What happens:
    //  1. Three fields: date, boolean and text (the last has no stored value).
    //  2. The date value (a Date object) is read from valueDate and becomes "2026-05-06".
    //  3. The boolean value true is read from valueBoolean.
    //  4. The third field gets values = [] (an empty array, not null).
    test("_TC215_getForm_readsAllStoredScalarTypes", async () => {
      const defs = [
        makeDefinition({ id: 1, key: "date", dataType: "date" }),
        makeDefinition({ id: 2, key: "flag", dataType: "boolean" }),
        makeDefinition({ id: 3, key: "missing", dataType: "text" }),
      ];
      propertyDefinitions.findActiveByNodeType.mockResolvedValue(defs);
      nodeProperties.findByNodeId.mockResolvedValue([
        makeStored({ propertyDefinitionId: 1, valueText: null, valueDate: new Date("2026-05-06T00:00:00Z") }),
        makeStored({ propertyDefinitionId: 2, valueText: null, valueBoolean: true }),
      ]);

      const fields = (await service.getForm(1)).tabs[0].fields;

      expect(fields.map((field) => field.values)).toEqual([
        [{ rowIndex: 0, value: "2026-05-06", isOwn: null, publishedText: null }],
        [{ rowIndex: 0, value: true, isOwn: null, publishedText: null }],
        [],
      ]);
    });

    // TC234: Checks that getForm reads a Number field from valueNumber and returns it as a numeric value in the form.
    // What happens:
    //  1. A number field with a stored valueNumber=12.5 (and valueText=null).
    //  2. getForm reads the column that matches the type and returns 12.5 as a number, not a string.
    test("_TC234_getForm_readsNumberValues", async () => {
      propertyDefinitions.findActiveByNodeType.mockResolvedValue([
        makeDefinition({ id: 101, key: "amount", dataType: "number" }),
      ]);
      nodeProperties.findByNodeId.mockResolvedValue([
        makeStored({ propertyDefinitionId: 101, valueText: null, valueNumber: 12.5 }),
      ]);

      const field = (await service.getForm(1)).tabs[0].fields[0];

      expect(field.values).toEqual([{ rowIndex: 0, value: 12.5, isOwn: null, publishedText: null }]);
    });

    // TC235: Checks that a null tabKey assigns the field to the allmant tab instead of dropping it or creating an invalid tab.
    // What happens:
    //  1. A field with tabKey=null.
    //  2. It is placed in the default allmant tab: only one tab, the field is not lost and no strange tab is created.
    test("_TC235_getForm_fallsBackToAllmantForNullTabKey", async () => {
      propertyDefinitions.findActiveByNodeType.mockResolvedValue([
        makeDefinition({ tabKey: null }),
      ]);

      const form = await service.getForm(1);

      expect(form.tabs).toHaveLength(1);
      expect(form.tabs[0].tabKey).toBe("allmant");
    });

    // TC236 (fixed): the old test claimed fields are sorted by sortOrder, but the service does not do that (ordering is the
    // repository's job). It now tests what the service actually does: tab order follows TAB_ORDER, and the order of
    // fields inside a tab stays as the repository returned it.
    // What happens:
    //  1. Fields arrive in this order: second (beskrivning), sameTab (allmant), first (allmant), with sortOrder deliberately the opposite.
    //  2. Tabs are ordered allmant then beskrivning (even though the first incoming field is from beskrivning).
    //  3. Inside allmant the order stays [sameTab, first] as it arrived, i.e. the service does not reorder fields itself.
    test("_TC236_getForm_ordersTabsByTabOrderAndKeepsRepositoryOrderInsideTab", async () => {
      propertyDefinitions.findActiveByNodeType.mockResolvedValue([
        makeDefinition({ id: 103, key: "second", tabKey: "beskrivning", sortOrder: 2 }),
        makeDefinition({ id: 102, key: "sameTab", tabKey: "allmant", sortOrder: 3 }),
        makeDefinition({ id: 101, key: "first", tabKey: "allmant", sortOrder: 1 }),
      ]);

      const form = await service.getForm(1);

      expect(form.tabs.map((tab) => tab.tabKey)).toEqual(["allmant", "beskrivning"]);
      expect(form.tabs[0].fields.map((field) => field.key)).toEqual(["sameTab", "first"]);
    });

    // TC237: Checks that Enum options are associated with their own PropertyDefinition so that options from different fields are not mixed.
    // What happens:
    //  1. Two enum fields (101 and 102), and the options arrive mixed: A for 101, B for 102, C for 101.
    //  2. Each field gets only its own options: the first ["A","C"] and the second ["B"].
    test("_TC237_getForm_separatesEnumOptionsByDefinition", async () => {
      propertyDefinitions.findActiveByNodeType.mockResolvedValue([
        makeDefinition({ id: 101, key: "first", dataType: "enum" }),
        makeDefinition({ id: 102, key: "second", dataType: "enum" }),
      ]);
      propertyDefinitions.findActiveOptions.mockResolvedValue([
        { propertyDefinitionId: 101, value: "A" },
        { propertyDefinitionId: 102, value: "B" },
        { propertyDefinitionId: 101, value: "C" },
      ]);

      const fields = (await service.getForm(1)).tabs[0].fields;

      expect(fields.map((field) => field.options)).toEqual([["A", "C"], ["B"]]);
    });

    // TC251 (new): getForm when the node type has no definitions at all.
    // What happens:
    //  1. The repository returns no definitions.
    //  2. The result: tabs = [] (no tabs), and the header is still present.
    //  3. findActiveOptions is called with an empty array [] (there are no enum fields).
    test("_TC251_getForm_returnsNoTabsWhenNodeTypeHasNoDefinitions", async () => {
      const form = await service.getForm(1);

      expect(form.tabs).toEqual([]);
      expect(form.node.title).toBe("Node");
      expect(propertyDefinitions.findActiveOptions).toHaveBeenCalledWith([]);
    });

    // TC252 (new): normalization of the node header when columns arrive in unexpected shapes.
    // What happens:
    //  1. validTo arrives as the string "2026-03-04T10:00:00" rather than a Date and is cut to "2026-03-04".
    //  2. referenceCode, description and previousReferenceCode = undefined become null.
    //  3. isPublished = 0 (a falsy database value) becomes false.
    test("_TC252_getForm_normalizesStringDatesAndMissingHeaderColumns", async () => {
      nodes.findById.mockResolvedValue(makeNode({
        validTo: "2026-03-04T10:00:00" as never,
        referenceCode: undefined as never,
        previousReferenceCode: undefined as never,
        description: undefined as never,
        isPublished: 0 as never,
      }));

      const { node } = await service.getForm(1);

      expect(node.validTo).toBe("2026-03-04");
      expect(node.referenceCode).toBeNull();
      expect(node.previousReferenceCode).toBeNull();
      expect(node.description).toBeNull();
      expect(node.isPublished).toBe(false);
    });

    // TC253 (new): isOwn=true and publishedText are carried into the form.
    // What happens:
    //  1. A stored value with isOwn=1 (a number from the database, not a boolean) and publishedText="Pub".
    //  2. toFormValue converts isOwn to a real true (!!) and keeps publishedText.
    test("_TC253_getForm_mapsIsOwnTrueAndPublishedText", async () => {
      propertyDefinitions.findActiveByNodeType.mockResolvedValue([makeDefinition({ hasOwnPublished: true })]);
      nodeProperties.findByNodeId.mockResolvedValue([
        makeStored({ isOwn: 1 as never, publishedText: "Pub" }),
      ]);

      const field = (await service.getForm(1)).tabs[0].fields[0];

      expect(field.values).toEqual([{ rowIndex: 0, value: "stored", isOwn: true, publishedText: "Pub" }]);
    });

    // TC254 (new, exposes a service bug): a tabKey equal to an inherited Object property such as "toString".
    // What happens:
    //  1. A field with tabKey="toString".
    //  2. asTabKey uses `value in TAB_LABELS`, and "toString" exists on every object through inheritance, so it is treated as a valid tab.
    //  3. "toString" is not in TAB_ORDER, so the field silently disappears from the form.
    //  4. Correct behavior: the field falls into allmant. This test fails until the service is fixed (use hasOwnProperty / Object.hasOwn).
    test("_TC254_getForm_doesNotTreatInheritedObjectKeysAsTabs", async () => {
      propertyDefinitions.findActiveByNodeType.mockResolvedValue([
        makeDefinition({ tabKey: "toString" }),
      ]);

      const form = await service.getForm(1);

      expect(form.tabs).toHaveLength(1);
      expect(form.tabs[0].tabKey).toBe("allmant");
    });
  });

  // =========================================================================
  // snapshotValues
  // =========================================================================
  describe("snapshotValues", () => {
    // TC216: Checks that snapshotValues returns an empty object when no keys are requested, without querying property definitions or stored values.
    // What happens:
    //  1. snapshotValues is called with an empty key list and returns {} immediately.
    //  2. No queries are made: neither findActiveByNodeType nor findByNodeId.
    test("_TC216_snapshotValues_returnsEmptyWithoutKeys", async () => {
      await expect(service.snapshotValues(trx, { id: 1, nodeTypeId: 20 }, [])).resolves.toEqual({});
      expect(propertyDefinitions.findActiveByNodeType).not.toHaveBeenCalled();
      expect(nodeProperties.findByNodeId).not.toHaveBeenCalled();
    });

    // TC217: Checks that snapshotValues returns only the requested fields that exist in the node type's definitions, ignoring unknown keys.
    // What happens:
    //  1. Two definitions "name" and "other", each with a stored value.
    //  2. We request ["name", "unknown"]: the result contains only "name" ("other" was not requested and "unknown" is silently ignored).
    //  3. The queries were made with nodeTypeId=20 and nodeId=1.
    test("_TC217_snapshotValues_returnsOnlyRequestedFields", async () => {
      propertyDefinitions.findActiveByNodeType.mockResolvedValue([
        makeDefinition({ id: 100, key: "name" }),
        makeDefinition({ id: 101, key: "other" }),
      ]);
      nodeProperties.findByNodeId.mockResolvedValue([
        makeStored({ propertyDefinitionId: 100, valueText: "value" }),
        makeStored({ propertyDefinitionId: 101, valueText: "ignored" }),
      ]);

      await expect(service.snapshotValues(trx, { id: 1, nodeTypeId: 20 }, ["name", "unknown"])).resolves.toEqual({
        name: [{ rowIndex: 0, value: "value", isOwn: null, publishedText: null }],
      });
      expect(propertyDefinitions.findActiveByNodeType).toHaveBeenCalledWith(20);
      expect(nodeProperties.findByNodeId).toHaveBeenCalledWith(1);
    });

    // TC238: Checks that snapshotValues returns an empty object when none of the requested keys match a property definition, and verifies that the node's stored values are queried.
    // What happens:
    //  1. The only definition has the key "other" and we request "missing": the result is {}.
    //  2. Even so, the stored values are queried (findByNodeId(1)) because the service loads them before matching.
    test("_TC238_snapshotValues_returnsEmptyForNoMatchingDefinitions", async () => {
      propertyDefinitions.findActiveByNodeType.mockResolvedValue([
        makeDefinition({ key: "other" }),
      ]);

      await expect(service.snapshotValues(trx, { id: 1, nodeTypeId: 20 }, ["missing"])).resolves.toEqual({});
      expect(nodeProperties.findByNodeId).toHaveBeenCalledWith(1);
    });

    // TC239: Checks that snapshotValues can return multiple stored values for one repeatable definition, in the order the repository returned them.
    // What happens:
    //  1. A repeatable field with two stored rows ("first" order 0, "second" order 1).
    //  2. The result is {name: [first, second]} in the repository's order (the service does not reorder).
    test("_TC239_snapshotValues_returnsMultipleValuesForOneDefinition", async () => {
      propertyDefinitions.findActiveByNodeType.mockResolvedValue([
        makeDefinition({ isRepeatable: true }),
      ]);
      nodeProperties.findByNodeId.mockResolvedValue([
        makeStored({ valueText: "first", valueOrder: 0 }),
        makeStored({ id: 501, valueText: "second", valueOrder: 1 }),
      ]);

      await expect(service.snapshotValues(trx, { id: 1, nodeTypeId: 20 }, ["name"])).resolves.toEqual({
        name: [
          { rowIndex: 0, value: "first", isOwn: null, publishedText: null },
          { rowIndex: 1, value: "second", isOwn: null, publishedText: null },
        ],
      });
    });

    // TC255 (new): snapshotValues must read inside the given transaction.
    // What happens:
    //  1. We call snapshotValues(trx, ...) with one key.
    //  2. The propertyDefinitions and nodeProperties factories are called with trx (not without it), otherwise the read would happen outside the transaction and could see different data from what the edit saves.
    test("_TC255_snapshotValues_readsInsideTheGivenTransaction", async () => {
      propertyDefinitions.findActiveByNodeType.mockResolvedValue([makeDefinition()]);

      await service.snapshotValues(trx, { id: 1, nodeTypeId: 20 }, ["name"]);

      expect(repos.propertyDefinitions).toHaveBeenCalledWith(trx);
      expect(repos.nodeProperties).toHaveBeenCalledWith(trx);
    });
  });

  // =========================================================================
  // saveValues
  // =========================================================================
  describe("saveValues", () => {
    // TC218: Checks that saveValues refuses to save when the node does not exist and does not call replaceValues in that case.
    // What happens:
    //  1. The node does not exist, so NotFoundError is thrown inside the transaction.
    //  2. The transaction was started once and replaceValues was never called (nothing was saved).
    test("_TC218_saveValues_rejectsMissingNodeBeforeSaving", async () => {
      nodes.findById.mockResolvedValue(undefined);

      await expect(service.saveValues(99, [], 7)).rejects.toThrow(NotFoundError);
      expect(knex.transaction).toHaveBeenCalledTimes(1);
      expect(nodeProperties.replaceValues).not.toHaveBeenCalled();
    });

    // TC219 (strengthened): the old test only counted findById calls and did not verify what its name claims.
    // What happens:
    //  1. The node has a definition "name", and after the save the repository returns the value "new" when the form is reloaded.
    //  2. saveValues(1, [{name:"new"}], 7) performs the save inside a single transaction.
    //  3. replaceValues was called with (1, [100], [a row with valueText="new" and updatedBy=7]).
    //  4. Only after that (checked via call order) the form is reloaded, and that reloaded form is what the method returns (nodeId and the value "new").
    //  5. findById was called twice: once inside the transaction and once in getForm.
    test("_TC219_saveValues_usesTransactionAndReturnsFreshForm", async () => {
      propertyDefinitions.findActiveByNodeType.mockResolvedValue([makeDefinition()]);
      nodeProperties.findByNodeId.mockResolvedValue([makeStored({ valueText: "new" })]);

      const form = await service.saveValues(1, [{ key: "name", value: "new" }], 7);

      expect(knex.transaction).toHaveBeenCalledTimes(1);
      expect(nodeProperties.replaceValues).toHaveBeenCalledWith(1, [100], [
        expect.objectContaining({ valueText: "new", updatedBy: 7 }),
      ]);
      expect(nodeProperties.replaceValues.mock.invocationCallOrder[0])
        .toBeLessThan(nodeTypes.findOne.mock.invocationCallOrder[0]);
      expect(form.nodeId).toBe(1);
      expect(form.tabs[0].fields[0].values[0].value).toBe("new");
      expect(nodes.findById).toHaveBeenCalledTimes(2);
    });

    // TC240: Checks that an error from the transaction callback is not swallowed and is propagated to the caller unchanged.
    // What happens:
    //  1. knex.transaction itself rejects with the error "transaction failed".
    //  2. saveValues passes that very same error object through (toBe) without swallowing it.
    //  3. nodes.findById was not called because the callback never ran.
    test("_TC240_saveValues_propagatesTransactionCallbackErrors", async () => {
      const error = new Error("transaction failed");
      (knex.transaction as jest.Mock).mockRejectedValue(error);

      await expect(service.saveValues(1, [], 7)).rejects.toBe(error);
      expect(nodes.findById).not.toHaveBeenCalled();
    });

    // TC241: Checks that repository factories receive the transaction during the save, and are called without a transaction when the form is reloaded after the save.
    // What happens:
    //  1. We run saveValues successfully (the factories are the shared jest.fn, so no second service is needed).
    //  2. During the save: nodes, propertyDefinitions and nodeProperties are called with trx.
    //  3. When the form is reloaded after the save: the last call of each of nodes, propertyDefinitions and nodeProperties has no arguments.
    test("_TC241_saveValues_passesTransactionToRepositoryFactories", async () => {
      propertyDefinitions.findActiveByNodeType.mockResolvedValue([makeDefinition()]);

      await service.saveValues(1, [{ key: "name", value: "new" }], 7);

      expect(repos.nodes).toHaveBeenCalledWith(trx);
      expect(repos.propertyDefinitions).toHaveBeenCalledWith(trx);
      expect(repos.nodeProperties).toHaveBeenCalledWith(trx);
      expect(repos.nodes).toHaveBeenLastCalledWith();
      expect(repos.propertyDefinitions).toHaveBeenLastCalledWith();
      expect(repos.nodeProperties).toHaveBeenLastCalledWith();
    });

    // TC256 (new): a validation failure inside the transaction prevents saving and does not reload the form.
    // What happens:
    //  1. We send an unknown key "unknown" through saveValues.
    //  2. A ValidationError is raised inside the transaction (so a real database would roll the save back).
    //  3. replaceValues was not called, and the form was not reloaded after the failure (nodeTypes.findOne was not called).
    test("_TC256_saveValues_doesNotReloadFormWhenValidationFails", async () => {
      propertyDefinitions.findActiveByNodeType.mockResolvedValue([makeDefinition()]);

      await expect(service.saveValues(1, [{ key: "unknown", value: "x" }], 7)).rejects.toThrow(ValidationError);
      expect(nodeProperties.replaceValues).not.toHaveBeenCalled();
      expect(nodeTypes.findOne).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // saveValuesInTransaction
  // =========================================================================
  describe("saveValuesInTransaction", () => {
    // Helper: sets the definitions (and optionally the options) that the fake repositories will return.
    const configure = (definitions: PropertyDefinition[], options: { propertyDefinitionId: number; value: string }[] = []) => {
      propertyDefinitions.findActiveByNodeType.mockResolvedValue(definitions);
      propertyDefinitions.findActiveOptions.mockResolvedValue(options);
    };
    // Helper: runs the save in edit mode (requireAll=false) with userId=7 by default.
    // userId is deliberately a rest argument: we pass the value as is (even undefined); a default parameter would turn undefined into 7.
    const save = (inputs: unknown[] | undefined, requireAll = false, ...userId: Array<number | null | undefined>) =>
      service.saveValuesInTransaction(trx, { id: 1, nodeTypeId: 20 }, inputs as never, userId.length ? userId[0] : 7, requireAll);

    // --- Basic inputs ------------------------------------------------------

    // TC220: Checks that no replacement is performed when no inputs are provided and there is nothing that needs to be saved.
    // What happens:
    //  1. One optional definition, and inputs = undefined in edit mode: there is nothing to save, so the method returns early.
    //  2. replaceValues is not called.
    test("_TC220_saveValuesInTransaction_returnsWithoutReplacingWhenNoInputsAndNothingRequired", async () => {
      configure([makeDefinition()]);

      await save(undefined);

      expect(nodeProperties.replaceValues).not.toHaveBeenCalled();
    });

    // TC221: Checks that the service rejects a submitted field that has no PropertyDefinition for the current node type.
    // What happens:
    //  1. The only definition is "name", and we send an unknown key "unknown".
    //  2. ValidationError with the message "Field 'unknown' does not exist for this node type".
    //  3. Nothing is saved (replaceValues was not called).
    test("_TC221_saveValuesInTransaction_rejectsUnknownField", async () => {
      configure([makeDefinition()]);

      await expect(save([{ key: "unknown", value: "x" }]))
        .rejects.toThrow("Field 'unknown' does not exist for this node type");
      expect(nodeProperties.replaceValues).not.toHaveBeenCalled();
    });

    // TC222: Checks that only the definitions for submitted fields are replaced, leaving other fields untouched, and that surrounding whitespace is trimmed from text values.
    // What happens:
    //  1. Two definitions "name" (100) and "other" (101), and we send only name=" Hello ".
    //  2. replaceValues is called with [100] only (other is untouched).
    //  3. The row: valueText="Hello" after trim, other value columns null, valueOrder=0, updatedBy=7.
    test("_TC222_saveValuesInTransaction_replacesOnlySentDefinitions", async () => {
      configure([makeDefinition({ id: 100, key: "name" }), makeDefinition({ id: 101, key: "other" })]);

      await save([{ key: "name", value: " Hello " }]);

      expect(nodeProperties.replaceValues).toHaveBeenCalledWith(1, [100], [
        expect.objectContaining({
          nodeId: 1,
          propertyDefinitionId: 100,
          valueText: "Hello",
          valueNumber: null,
          valueDate: null,
          valueBoolean: null,
          valueOrder: 0,
          updatedBy: 7,
        }),
      ]);
    });

    // --- Type conversion and validation ------------------------------------

    // TC223: Checks that input values are converted to the appropriate formats for Text, LongText, Number, Date, Boolean, URL, and Enum fields before being sent to the repository.
    // What happens:
    //  1. Seven definitions (one per data type) with an option "Choice" for the enum.
    //  2. We send raw values: padded strings, "1,5", a date, "true" as text, and a URL with spaces.
    //  3. Each value goes to the right column: text/long/url/enum to valueText, number to valueNumber=1.5, date to valueDate, boolean to valueBoolean=true.
    //  4. findActiveOptions was requested for the enum field alone [7].
    test("_TC223_saveValuesInTransaction_coercesSupportedTypes", async () => {
      configure([
        makeDefinition({ id: 1, key: "text", dataType: "text" }),
        makeDefinition({ id: 2, key: "long", dataType: "longtext" }),
        makeDefinition({ id: 3, key: "number", dataType: "number" }),
        makeDefinition({ id: 4, key: "date", dataType: "date" }),
        makeDefinition({ id: 5, key: "boolean", dataType: "boolean" }),
        makeDefinition({ id: 6, key: "url", dataType: "url" }),
        makeDefinition({ id: 7, key: "enum", dataType: "enum" }),
      ], [{ propertyDefinitionId: 7, value: "Choice" }]);

      await save([
        { key: "text", value: " text " },
        { key: "long", value: " long " },
        { key: "number", value: "1,5" },
        { key: "date", value: "2026-05-06" },
        { key: "boolean", value: "true" },
        { key: "url", value: " https://example.test/a " },
        { key: "enum", value: "Choice" },
      ], false, null);

      const rows = nodeProperties.replaceValues.mock.calls[0][2];
      expect(rows).toEqual(expect.arrayContaining([
        expect.objectContaining({ propertyDefinitionId: 1, valueText: "text" }),
        expect.objectContaining({ propertyDefinitionId: 2, valueText: "long" }),
        expect.objectContaining({ propertyDefinitionId: 3, valueNumber: 1.5 }),
        expect.objectContaining({ propertyDefinitionId: 4, valueDate: "2026-05-06" }),
        expect.objectContaining({ propertyDefinitionId: 5, valueBoolean: true }),
        expect.objectContaining({ propertyDefinitionId: 6, valueText: "https://example.test/a" }),
        expect.objectContaining({ propertyDefinitionId: 7, valueText: "Choice" }),
      ]));
      expect(propertyDefinitions.findActiveOptions).toHaveBeenCalledWith([7]);
    });

    // TC224: Checks that invalid Number, Date, Boolean, and URL values are rejected and that no save is performed when such values are supplied.
    // What happens:
    //  1. A loop over four cases: number="not-a-number", date="06/05/2026", boolean="yes", url="ftp://...".
    //  2. In each iteration a ValidationError with the message for that type is thrown.
    //  3. At the end replaceValues was never called.
    test("_TC224_saveValuesInTransaction_rejectsInvalidScalarValues", async () => {
      const invalidValues: Array<[PropertyDefinition["dataType"], string, string]> = [
        ["number", "not-a-number", "a number"],
        ["date", "06/05/2026", "a date as YYYY-MM-DD"],
        ["boolean", "yes", "true or false"],
        ["url", "ftp://example.test", "a web address starting with http:// or https://"],
      ];

      for (const [dataType, value, expected] of invalidValues) {
        configure([makeDefinition({ dataType })]);
        await expect(save([{ key: "name", value }])).rejects.toThrow(expected);
      }
      expect(nodeProperties.replaceValues).not.toHaveBeenCalled();
    });

    // TC225: Checks that an Enum value is rejected when it is not included in the options allowed for that property definition.
    // What happens:
    //  1. An enum field whose only option is "Allowed", and we send "Other".
    //  2. ValidationError containing "one of: Allowed" (the database does not check enum values, the service does).
    test("_TC225_saveValuesInTransaction_rejectsInvalidEnumValue", async () => {
      configure([makeDefinition({ dataType: "enum" })], [{ propertyDefinitionId: 100, value: "Allowed" }]);

      await expect(save([{ key: "name", value: "Other" }])).rejects.toThrow("one of: Allowed");
    });

    // TC247: Checks that an Enum value is rejected when no options are available or defined for the field.
    // What happens:
    //  1. An enum field with no options defined, and we send "Choice".
    //  2. It is rejected with "one of: (no choices defined)" and nothing is saved.
    test("_TC247_saveValuesInTransaction_rejectsEnumWithoutAvailableOptions", async () => {
      configure([makeDefinition({ dataType: "enum" })]);

      await expect(save([{ key: "name", value: "Choice" }])).rejects.toThrow("one of: (no choices defined)");
      expect(nodeProperties.replaceValues).not.toHaveBeenCalled();
    });

    // TC242: Checks that Boolean false is accepted both as the Boolean value false and as the string "false", rather than being treated as an empty value.
    // What happens:
    //  1. Two boolean fields, sent false (a real boolean) and "false" (a string).
    //  2. Both are saved as valueBoolean=false and not treated as empty (false is neither null nor an empty string).
    test("_TC242_saveValuesInTransaction_acceptsBooleanFalseAndStringFalse", async () => {
      configure([
        makeDefinition({ id: 101, key: "first", dataType: "boolean" }),
        makeDefinition({ id: 102, key: "second", dataType: "boolean" }),
      ]);
      await save([
        { key: "first", value: false },
        { key: "second", value: "false" },
      ]);

      expect(nodeProperties.replaceValues.mock.calls[0][2]).toEqual(expect.arrayContaining([
        expect.objectContaining({ propertyDefinitionId: 101, valueBoolean: false }),
        expect.objectContaining({ propertyDefinitionId: 102, valueBoolean: false }),
      ]));
    });

    // TC243: Checks that negative and decimal numbers are accepted, and that a decimal numeric string is converted to a Number correctly.
    // What happens:
    //  1. Two number fields: we send -7 (a number) and "3.14" (a string).
    //  2. They are saved as valueNumber=-7 and 3.14 (the string was converted to a number).
    test("_TC243_saveValuesInTransaction_acceptsNegativeAndDecimalNumbers", async () => {
      configure([
        makeDefinition({ id: 101, key: "negative", dataType: "number" }),
        makeDefinition({ id: 102, key: "decimal", dataType: "number" }),
      ]);

      await save([
        { key: "negative", value: -7 },
        { key: "decimal", value: "3.14" },
      ]);

      expect(nodeProperties.replaceValues.mock.calls[0][2]).toEqual(expect.arrayContaining([
        expect.objectContaining({ propertyDefinitionId: 101, valueNumber: -7 }),
        expect.objectContaining({ propertyDefinitionId: 102, valueNumber: 3.14 }),
      ]));
    });

    // TC244: Checks that an invalid numeric format such as 1.2.3 is rejected, and that a NaN rowIndex is rejected for a repeatable field.
    // What happens:
    //  1. A number field with the value "1.2.3": Number(...) is NaN, so a ValidationError is thrown.
    //  2. A repeatable field with rowIndex=NaN: Number.isInteger(NaN) is false, giving "rowIndex must be 0 or higher".
    test("_TC244_saveValuesInTransaction_rejectsInvalidDecimalAndNaNRowIndex", async () => {
      configure([makeDefinition({ dataType: "number" })]);

      await expect(save([{ key: "name", value: "1.2.3" }])).rejects.toThrow(ValidationError);

      configure([makeDefinition({ isRepeatable: true })]);
      await expect(save([{ key: "name", value: "value", rowIndex: Number.NaN }]))
        .rejects.toThrow("rowIndex must be 0 or higher");
    });

    // TC257 (new, exposes a service bug): a correctly formatted but impossible date.
    // What happens:
    //  1. A date field: we send "2026-02-30" and "2026-04-31" (days that do not exist).
    //  2. V8's Date.parse accepts them and rolls them over to March 2 and May 1, so the wrong value passes and is stored as typed.
    //  3. Correct behavior: reject with "a date as YYYY-MM-DD". This test fails until the service is fixed (compare the parsed date with the text).
    //  4. Values that are further off, such as "2026-13-01" and "2026-02-32", are already rejected (checked in the same test).
    test("_TC257_saveValuesInTransaction_rejectsImpossibleCalendarDates", async () => {
      configure([makeDefinition({ dataType: "date" })]);

      for (const value of ["2026-02-30", "2026-04-31", "2026-13-01", "2026-02-32"]) {
        await expect(save([{ key: "name", value }])).rejects.toThrow("a date as YYYY-MM-DD");
      }
      expect(nodeProperties.replaceValues).not.toHaveBeenCalled();
    });

    // TC258 (new): a valid leap day is accepted.
    // What happens:
    //  1. We send "2028-02-29" (2028 is a leap year): it is accepted and stored as is.
    test("_TC258_saveValuesInTransaction_acceptsLeapDay", async () => {
      configure([makeDefinition({ dataType: "date" })]);

      await save([{ key: "name", value: "2028-02-29" }]);

      expect(nodeProperties.replaceValues.mock.calls[0][2][0]).toEqual(expect.objectContaining({ valueDate: "2028-02-29" }));
    });

    // TC259 (new): non-finite numbers and thousands separators are rejected.
    // What happens:
    //  1. "Infinity" and Infinity (a number) are rejected because Number.isFinite is false.
    //  2. "1,000.5": the service replaces only the first comma, giving "1.000.5" = NaN, so it is rejected (thousands separators are not supported; this documents the behavior).
    test("_TC259_saveValuesInTransaction_rejectsInfinityAndThousandsSeparators", async () => {
      configure([makeDefinition({ dataType: "number" })]);

      for (const value of ["Infinity", Infinity, "1,000.5"]) {
        await expect(save([{ key: "name", value }])).rejects.toThrow("a number");
      }
    });

    // TC260 (new): unsupported boolean forms are rejected.
    // What happens:
    //  1. "TRUE" (uppercase), 1 (a number) and "1" (a string) are all rejected with the message "true or false".
    //  2. Only real true/false or the lowercase strings "true"/"false" are accepted.
    test("_TC260_saveValuesInTransaction_rejectsUnsupportedBooleanForms", async () => {
      configure([makeDefinition({ dataType: "boolean" })]);

      for (const value of ["TRUE", 1, "1"]) {
        await expect(save([{ key: "name", value }])).rejects.toThrow("true or false");
      }
    });

    // TC261 (new): URL rules in detail.
    // What happens:
    //  1. "HTTPS://A.TEST/x" (uppercase) is accepted (the check is case-insensitive).
    //  2. "https://exa mple.test" (inner space), "https://" (no host) and "example.test" (no protocol) are rejected.
    test("_TC261_saveValuesInTransaction_validatesUrlShape", async () => {
      configure([makeDefinition({ dataType: "url" })]);

      await save([{ key: "name", value: "HTTPS://A.TEST/x" }]);
      expect(nodeProperties.replaceValues.mock.calls[0][2][0]).toEqual(expect.objectContaining({ valueText: "HTTPS://A.TEST/x" }));

      for (const value of ["https://exa mple.test", "https://", "example.test"]) {
        await expect(save([{ key: "name", value }])).rejects.toThrow("a web address");
      }
    });

    // TC262 (new): an enum value with surrounding spaces is trimmed before matching the options.
    // What happens:
    //  1. The option is "Choice" and we send "  Choice  ": it is accepted and stored as "Choice".
    test("_TC262_saveValuesInTransaction_trimsEnumValueBeforeMatching", async () => {
      configure([makeDefinition({ dataType: "enum" })], [{ propertyDefinitionId: 100, value: "Choice" }]);

      await save([{ key: "name", value: "  Choice  " }]);

      expect(nodeProperties.replaceValues.mock.calls[0][2][0]).toEqual(expect.objectContaining({ valueText: "Choice" }));
    });

    // --- Repeatable and single-value rows ----------------------------------

    // TC226: Checks that multiple rows are accepted for a repeatable field and that the supplied rowIndex values are preserved as valueOrder.
    // What happens:
    //  1. A repeatable field and two rows with rowIndex = 2 and 4.
    //  2. replaceValues is called once with [100], and valueOrder = [2, 4] exactly as sent.
    test("_TC226_saveValuesInTransaction_validatesRepeatableRows", async () => {
      configure([makeDefinition({ isRepeatable: true })]);

      await save([
        { key: "name", value: "first", rowIndex: 2 },
        { key: "name", value: "second", rowIndex: 4 },
      ]);

      expect(nodeProperties.replaceValues.mock.calls[0][1]).toEqual([100]);
      expect(nodeProperties.replaceValues.mock.calls[0][2].map((row: NodePropertyValues) => row.valueOrder)).toEqual([2, 4]);
    });

    // TC227: Checks that duplicate rowIndex values and negative rowIndex values are rejected for repeatable fields.
    // What happens:
    //  1. Two rows with the same rowIndex=1 give "row 1 was sent twice".
    //  2. rowIndex=-1 gives "rowIndex must be 0 or higher".
    test("_TC227_saveValuesInTransaction_rejectsDuplicateOrNegativeRowIndexes", async () => {
      configure([makeDefinition({ isRepeatable: true })]);

      await expect(save([
        { key: "name", value: "first", rowIndex: 1 },
        { key: "name", value: "second", rowIndex: 1 },
      ])).rejects.toThrow("row 1 was sent twice");
      await expect(save([
        { key: "name", value: "negative", rowIndex: -1 },
      ])).rejects.toThrow("rowIndex must be 0 or higher");
    });

    // TC228: Checks that more than one value cannot be submitted for a field that is not repeatable.
    // What happens:
    //  1. A non-repeatable field and we send two values.
    //  2. Both get rowIndex=0, so "can only have one value" is thrown at the second row (from the seenRows check).
    //  3. Note: the `kept > 1` check after the loop in the service is unreachable, because the seenRows check throws first.
    test("_TC228_saveValuesInTransaction_rejectsMultipleValuesForNonRepeatableField", async () => {
      configure([makeDefinition()]);

      await expect(save([
        { key: "name", value: "first" },
        { key: "name", value: "second" },
      ])).rejects.toThrow("can only have one value");
    });

    // TC245: Checks that rowIndex is assigned automatically from each value's position when no rowIndex is supplied for a repeatable field.
    // What happens:
    //  1. A repeatable field and two rows without rowIndex: valueOrder = [0, 1] (by row position).
    test("_TC245_saveValuesInTransaction_defaultsRepeatableRowIndexesToPosition", async () => {
      configure([makeDefinition({ isRepeatable: true })]);

      await save([
        { key: "name", value: "first" },
        { key: "name", value: "second" },
      ]);

      expect(nodeProperties.replaceValues.mock.calls[0][2].map((row: NodePropertyValues) => row.valueOrder)).toEqual([0, 1]);
    });

    // TC263 (new): a non-repeatable field ignores the supplied rowIndex.
    // What happens:
    //  1. A normal field and we send rowIndex=5.
    //  2. The service forces rowIndex=0 for non-repeatable fields, so valueOrder=0 is stored.
    test("_TC263_saveValuesInTransaction_ignoresRowIndexForNonRepeatableField", async () => {
      configure([makeDefinition()]);

      await save([{ key: "name", value: "x", rowIndex: 5 }]);

      expect(nodeProperties.replaceValues.mock.calls[0][2][0].valueOrder).toBe(0);
    });

    // TC264 (new): a fractional rowIndex is rejected.
    // What happens:
    //  1. A repeatable field and rowIndex=1.5: Number.isInteger is false, giving "rowIndex must be 0 or higher".
    test("_TC264_saveValuesInTransaction_rejectsFractionalRowIndex", async () => {
      configure([makeDefinition({ isRepeatable: true })]);

      await expect(save([{ key: "name", value: "x", rowIndex: 1.5 }])).rejects.toThrow("rowIndex must be 0 or higher");
    });

    // TC265 (new): a required repeatable field whose rows are all empty.
    // What happens:
    //  1. A repeatable, required field and we send two empty rows (null and "   ").
    //  2. Both rows are dropped (kept=0), so "Field 'Name' is required" is thrown.
    test("_TC265_saveValuesInTransaction_rejectsRequiredRepeatableFieldWithOnlyEmptyRows", async () => {
      configure([makeDefinition({ isRepeatable: true, isRequired: true })]);

      await expect(save([
        { key: "name", value: null },
        { key: "name", value: "   " },
      ])).rejects.toThrow("Field 'Name' is required");
    });

    // --- Required fields (create vs edit) -----------------------------------

    // TC229: Checks that a required field is rejected when it is omitted or submitted with an empty value.
    // What happens:
    //  1. Create (requireAll=true) with no inputs gives "Field 'Name' is required".
    //  2. Edit (requireAll=false) with an empty value "": the row is dropped (kept=0), giving the same error.
    test("_TC229_saveValuesInTransaction_rejectsMissingRequiredFields", async () => {
      configure([makeDefinition({ isRequired: true })]);

      await expect(save([], true)).rejects.toThrow("Field 'Name' is required");
      await expect(save([{ key: "name", value: "" }], false)).rejects.toThrow("Field 'Name' is required");
    });

    // TC230: Checks that requireAll=true requires every required field to be submitted, rather than accepting only one of the required fields.
    // What happens:
    //  1. Two required fields, name and description, and we send only name during creation.
    //  2. The service checks every required definition, finds description missing and throws "Field 'Description' is required".
    test("_TC230_saveValuesInTransaction_requiresEveryRequiredFieldOnCreate", async () => {
      configure([
        makeDefinition({ id: 100, key: "name", isRequired: true }),
        makeDefinition({ id: 101, key: "description", label: "Description", isRequired: true }),
      ]);

      await expect(save([{ key: "name", value: "Name" }], true)).rejects.toThrow("Field 'Description' is required");
    });

    // TC266 (new): the success path on create (previously uncovered; only failures were tested).
    // What happens:
    //  1. Two required fields and we send two valid values with requireAll=true.
    //  2. No error, and replaceValues is called with the ids [100, 101] and two rows.
    test("_TC266_saveValuesInTransaction_createSucceedsWhenAllRequiredFieldsAreSent", async () => {
      configure([
        makeDefinition({ id: 100, key: "name", isRequired: true }),
        makeDefinition({ id: 101, key: "description", label: "Description", isRequired: true }),
      ]);

      await save([{ key: "name", value: "A" }, { key: "description", value: "B" }], true);

      expect(nodeProperties.replaceValues).toHaveBeenCalledWith(1, [100, 101], [
        expect.objectContaining({ propertyDefinitionId: 100, valueText: "A" }),
        expect.objectContaining({ propertyDefinitionId: 101, valueText: "B" }),
      ]);
    });

    // TC267 (new): create with no required fields and no inputs.
    // What happens:
    //  1. Only an optional field, inputs=[] with requireAll=true.
    //  2. Nothing is required and nothing was sent: early return, no replaceValues.
    test("_TC267_saveValuesInTransaction_createWithNothingRequiredAndNoInputsSavesNothing", async () => {
      configure([makeDefinition()]);

      await save([], true);

      expect(nodeProperties.replaceValues).not.toHaveBeenCalled();
    });

    // TC268 (new): in edit mode only the fields that were sent are checked.
    // What happens:
    //  1. Field "name" is required and "other" is optional, and we send only "other" (requireAll=false).
    //  2. No error about "name" (it was not sent, so it is not checked), and only "other" is saved: replaceValues(1, [101], ...).
    test("_TC268_saveValuesInTransaction_editDoesNotRequireUnsentRequiredFields", async () => {
      configure([
        makeDefinition({ id: 100, key: "name", isRequired: true }),
        makeDefinition({ id: 101, key: "other", label: "Other" }),
      ]);

      await save([{ key: "other", value: "x" }], false);

      expect(nodeProperties.replaceValues).toHaveBeenCalledWith(1, [101], [expect.objectContaining({ valueText: "x" })]);
    });

    // --- Empty text and clearing fields -------------------------------------

    // TC246: Checks that submitting an empty value for an optional field clears its existing value by calling replaceValues with an empty rows array.
    // What happens:
    //  1. An optional field and an empty value "" (the user cleared the field).
    //  2. No row is produced, but the field stays among the "sent" ones: replaceValues(1, [100], []) so the old values are deleted.
    test("_TC246_saveValuesInTransaction_clearsOptionalFieldWithEmptyValue", async () => {
      configure([makeDefinition()]);

      await save([{ key: "name", value: "" }]);

      expect(nodeProperties.replaceValues).toHaveBeenCalledWith(1, [100], []);
    });

    // TC269 (new): whitespace-only text is treated as empty.
    // What happens:
    //  1. An optional field with the value "   ": the field is cleared (rows=[]).
    //  2. The same value in a required field gives "Field 'Name' is required".
    test("_TC269_saveValuesInTransaction_treatsWhitespaceOnlyTextAsEmpty", async () => {
      configure([makeDefinition()]);
      await save([{ key: "name", value: "   " }]);
      expect(nodeProperties.replaceValues).toHaveBeenCalledWith(1, [100], []);

      configure([makeDefinition({ isRequired: true })]);
      await expect(save([{ key: "name", value: "   " }])).rejects.toThrow("Field 'Name' is required");
    });

    // --- Eget / Publicerad -----------------------------------------------------

    // TC231: Checks that empty rows are removed from the prepared data, unless metadata such as isOwn=true makes the row meaningful.
    // What happens:
    //  1. A field that supports Eget/Publicerad, and two rows: value=null with no data (dropped) and value="" with isOwn=true (kept).
    //  2. One row reaches replaceValues: all value columns null and isOwn=true.
    test("_TC231_saveValuesInTransaction_dropsEmptyRowsUnlessMetadataIsSet", async () => {
      configure([makeDefinition({ hasOwnPublished: true })]);

      await save([
        { key: "name", value: null },
        { key: "name", value: "", isOwn: true },
      ]);

      expect(nodeProperties.replaceValues.mock.calls[0][2]).toEqual([
        expect.objectContaining({ valueText: null, valueNumber: null, valueDate: null, valueBoolean: null, isOwn: true }),
      ]);
    });

    // TC232: Checks that Eget/Publicerad metadata, such as isOwn or publishedText, is rejected when the property definition does not support those columns.
    // What happens:
    //  1. A field without hasOwnPublished: sending isOwn=true gives "has no Eget/Publicerad columns".
    //  2. Sending publishedText="text" gives the same error.
    test("_TC232_saveValuesInTransaction_validatesOwnPublishedMetadata", async () => {
      configure([makeDefinition()]);

      await expect(save([{ key: "name", value: "x", isOwn: true }])).rejects.toThrow("has no Eget/Publicerad columns");
      await expect(save([{ key: "name", value: "x", publishedText: "text" }])).rejects.toThrow("has no Eget/Publicerad columns");
    });

    // TC233: Checks that surrounding whitespace is trimmed from publishedText and that invalid types for isOwn and publishedText are rejected.
    // What happens:
    //  1. Successful save: isOwn=false and publishedText="  public  " are saved as isOwn=false and publishedText="public".
    //  2. isOwn="yes" gives "isOwn must be true or false".
    //  3. publishedText=123 gives "publishedText must be text".
    test("_TC233_saveValuesInTransaction_trimsPublishedTextAndValidatesTypes", async () => {
      configure([makeDefinition({ hasOwnPublished: true })]);

      await save([{ key: "name", value: "x", isOwn: false, publishedText: "  public  " }]);

      expect(nodeProperties.replaceValues.mock.calls[0][2][0]).toEqual(expect.objectContaining({
        isOwn: false,
        publishedText: "public",
      }));
      await expect(save([{ key: "name", value: "x", isOwn: "yes" as never }])).rejects.toThrow("isOwn must be true or false");
      await expect(save([{ key: "name", value: "x", publishedText: 123 as never }])).rejects.toThrow("publishedText must be text");
    });

    // TC248: Checks that a publishedText value containing only whitespace is converted to null before saving.
    // What happens:
    //  1. value="value" and publishedText="   ": after trim it is empty, so publishedText=null is saved (not "").
    test("_TC248_saveValuesInTransaction_storesEmptyPublishedTextAsNull", async () => {
      configure([makeDefinition({ hasOwnPublished: true })]);

      await save([{ key: "name", value: "value", publishedText: "   " }]);

      expect(nodeProperties.replaceValues.mock.calls[0][2][0]).toEqual(expect.objectContaining({ publishedText: null }));
    });

    // TC270 (new): isOwn=false with an empty value counts as "not filled in".
    // What happens:
    //  1. A field that supports Eget/Publicerad, and we send value="" and isOwn=false with no publishedText.
    //  2. The row is dropped (the Eget box is unchecked and there is nothing else): replaceValues(1, [100], []).
    test("_TC270_saveValuesInTransaction_dropsRowWithUncheckedIsOwnAndNoValue", async () => {
      configure([makeDefinition({ hasOwnPublished: true })]);

      await save([{ key: "name", value: "", isOwn: false }]);

      expect(nodeProperties.replaceValues).toHaveBeenCalledWith(1, [100], []);
    });

    // TC271 (new): publishedText alone makes a row meaningful even without a value.
    // What happens:
    //  1. value="" and publishedText="Text": a row is saved whose value columns are null, with publishedText="Text" and isOwn=null.
    test("_TC271_saveValuesInTransaction_keepsRowThatHasOnlyPublishedText", async () => {
      configure([makeDefinition({ hasOwnPublished: true })]);

      await save([{ key: "name", value: "", publishedText: "Text" }]);

      expect(nodeProperties.replaceValues.mock.calls[0][2]).toEqual([
        expect.objectContaining({ valueText: null, isOwn: null, publishedText: "Text" }),
      ]);
    });

    // --- Several fields, user id, and the transaction -----------------------

    // TC249: Checks that a null or undefined userId is normalized to updatedBy=null in the prepared rows.
    // What happens:
    //  1. We save once with userId=null and once with undefined: in both cases updatedBy=null.
    //  2. mockClear between the two runs resets the replaceValues call history.
    test("_TC249_saveValuesInTransaction_normalizesNullAndUndefinedUserId", async () => {
      configure([makeDefinition()]);

      await save([{ key: "name", value: "a" }], false, null);
      expect(nodeProperties.replaceValues.mock.calls[0][2][0].updatedBy).toBeNull();

      nodeProperties.replaceValues.mockClear();
      await save([{ key: "name", value: "b" }], false, undefined);
      expect(nodeProperties.replaceValues.mock.calls[0][2][0].updatedBy).toBeNull();
    });

    // TC250: Checks that updatedAt is set to a recent Date and that the supplied userId is assigned to updatedBy in the prepared row.
    // What happens:
    //  1. We record the time, then save with userId=42.
    //  2. The row: updatedAt is a Date whose value is >= the time before the save, and updatedBy=42.
    test("_TC250_saveValuesInTransaction_setsUpdatedAtAndUpdatedByOnRows", async () => {
      configure([makeDefinition()]);
      const before = Date.now();

      await save([{ key: "name", value: "value" }], false, 42);

      const row = nodeProperties.replaceValues.mock.calls[0][2][0];
      expect(row.updatedAt).toBeInstanceOf(Date);
      expect((row.updatedAt as Date).getTime()).toBeGreaterThanOrEqual(before);
      expect(row.updatedBy).toBe(42);
    });

    // TC272 (new): several fields sent together.
    // What happens:
    //  1. Two definitions 100 and 101, and we send 101 first, then 100.
    //  2. replaceValues is called once with the ids [101, 100] (in order of first appearance) and two rows.
    test("_TC272_saveValuesInTransaction_replacesAllSentFieldsInOneCall", async () => {
      configure([makeDefinition({ id: 100, key: "name" }), makeDefinition({ id: 101, key: "other" })]);

      await save([{ key: "other", value: "o" }, { key: "name", value: "n" }]);

      expect(nodeProperties.replaceValues).toHaveBeenCalledTimes(1);
      expect(nodeProperties.replaceValues).toHaveBeenCalledWith(1, [101, 100], [
        expect.objectContaining({ propertyDefinitionId: 101, valueText: "o" }),
        expect.objectContaining({ propertyDefinitionId: 100, valueText: "n" }),
      ]);
    });

    // TC273 (new): saving inside the transaction uses trx for every repository it touches.
    // What happens:
    //  1. We call saveValuesInTransaction directly.
    //  2. The propertyDefinitions and nodeProperties factories are called with trx.
    //  3. No factory is called without trx (no reads outside the transaction).
    test("_TC273_saveValuesInTransaction_usesTransactionForEveryRepository", async () => {
      configure([makeDefinition()]);

      await save([{ key: "name", value: "x" }]);

      expect(repos.propertyDefinitions).toHaveBeenCalledWith(trx);
      expect(repos.nodeProperties).toHaveBeenCalledWith(trx);
      expect(repos.propertyDefinitions).not.toHaveBeenCalledWith();
      expect(repos.nodeProperties).not.toHaveBeenCalledWith();
    });
  });
});