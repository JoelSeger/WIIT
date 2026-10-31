import { NodeRepository } from '../repos/nodeRepository';
import { toTree, validId } from '../controllers/nodeApiSupport';
import type { NodeRow } from '../models/node/nodeRow';

/** Coordinates classification and archive workflows. It applies domain rules and tree shaping; NodeRepository owns SQL. */

export class NodeService {

  /** Use the repository as the only entry point to node/archive tables. */
  constructor(private readonly nodes: NodeRepository) {}



  /** Load classification structures and nodes, then nest each flat node list into a tree. */
  async classificationTree() {
    const structures = await this.nodes.classificationStructures();
    const result =[];
    for (const structure of structures) result.push({ structure, nodes: toTree(await this.nodes.nodesInStructure(structure.id)) });

    return result;

  }


  /** Find one node only if its type belongs to a classification structure. */
  async classificationNode(id: number) {
    return this.nodes.classificationNode(id); }


  /** Find a series only when it belongs to the requested archive. */
  async series(archiveId: number, seriesId: number) {
    return this.nodes.series(archiveId, seriesId); }


  /** Load archives and linked structures, then nest each structure's nodes for the response. */

  async archiveTree() {
    return (await this.nodes.archiveTreeData()).map((archive: any) =>({
      ...archive,
      structures: archive.structures.map((item: any) => ({ ...item, nodes: toTree(item.nodes) })),
    }
    ));
  }


  /** Return the direct children of a series with type labels. The repository currently treats every child as a volume. */
  async volumes(seriesId: number) {
    return this.nodes.volumes(seriesId); }


  /** Find an archive's inventory structure. If none or several match, return an error instead of guessing. */
  async archiveAndStructure(archiveId: number, requestedId?: number): Promise<{
    archive?: Record<string, unknown>;
    structure?: { id: number };
    error?: { message: string; status: number };
  }> {
    const result = await this.nodes.archiveStructure(archiveId, requestedId);
    if (!result.archive) return { error: { message: 'Archive not found.', status: 404 } };
    if (!result.structures.length) return { error: { message: 'Archive has no linked archival inventory structure.', status: 409 } };
    if (result.structures.length > 1) return { error: { message: 'More than one archival inventory structure is linked; supply structureId.', status: 409 } };

    return { archive: result.archive, structure: result.structures[0] };
  }



  /** Resolve one active series type. The current rule identifies series by EAD level 'series'. */

  async resolveSeriesType(requested: unknown): Promise<number | null> {
    const id = requested == null ? undefined : validId(String(requested)) ?? undefined;
    if (requested != null && !id)
      return null;
    const types = await this.nodes.seriesTypes(id);

    return types.length === 1 ? Number(types[0].id) : null;
  }


  /** Resolve an allowed child type. If multiple types match, require the caller to choose one. */

  async resolveVolumeType(parentTypeId: number, requested: unknown): Promise<number | null> {
    const id = requested == null ? undefined : validId(String(requested)) ?? undefined;
    if (requested != null && !id)
      return null;
    const types = await this.nodes.volumeTypes(parentTypeId, id);

    return types.length === 1 ? Number(types[0].id) : null;
  }


  /** Accept a parent only when the node belongs to the selected structure. */
  async parent(parentId: number, structureId: number): Promise<NodeRow | undefined> {
    const parent = await this.nodes.node(parentId);

    return parent?.structureId === structureId ? parent : undefined;
  }


  /** Check whether the configured node type rule allows this child under its parent. */
  async isAllowedChild(parentTypeId: number, childTypeId: number) {
    return this.nodes.allowedChild(parentTypeId, childTypeId); }


  /** Choose the next sibling position when the caller did not supply sortOrder. */
  async nextSortOrder(structureId: number, parentId: number | null) {
    return this.nodes.nextSortOrder(structureId, parentId); }


  /** Save a node through the repository, including its create audit record. */
  async create(values: Record<string, unknown>, structureId: number, userId: number | null) {
    return this.nodes.createNode(values, structureId, userId);
  }


  /** Apply classification-specific checks before creating a child node. */

  async createClassification(input: { structureId: number; parentId: number; nodeTypeId: number; title: string; referenceCode: unknown; sortOrder: unknown; userId: number | null }) {
    if (!(await this.nodes.activeClassificationTarget(input.structureId, input.nodeTypeId))) throw new Error('Unknown classification structure or active node type.');
    const parent = await this.parent(input.parentId, input.structureId);
    if(!parent) throw new Error('Parent must exist in the selected structure.');
    if(!(await this.isAllowedChild(parent.nodeTypeId, input.nodeTypeId))) throw new Error('This node type is not allowed under that parent type.');

    return this.create({ structureId: input.structureId, parentId: parent.id, nodeTypeId: input.nodeTypeId,
      title: input.title.trim(), referenceCode: input.referenceCode, sortOrder: input.sortOrder }, input.structureId, input.userId);
  }


  /** Save changed fields and old/new audit values in one repository transaction. */
  async update(id: number, structureId: number, values: Record<string, unknown>, userId: number | null, current: NodeRow) {
    return this.nodes.updateNode(id, structureId, values, userId, current);
  }


  /** Delete the node through the repository's audited transaction. */
  async delete(id: number, current: NodeRow, userId: number|null) {
    return this.nodes.deleteNode(id, current, userId); }


  /** Find a volume, optionally checking that its tree is linked to the given archive. */
  async volume(volumeId: number, archiveId?: number) {
    return this.nodes.volume(volumeId, archiveId); }


  /** Find a node without a structure-type filter for shared parent/delete workflows. */
  async node(id: number) {
    return this.nodes.node(id);}
}
