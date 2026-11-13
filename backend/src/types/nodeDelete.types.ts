/** F3.1 – delete a node that has no children. */
export interface DeleteNodeRequest {
  nodeId: number;
  /** Taken from the logged-in user by the controller – never from the request body. */
  deletedBy: number | null;
}

/** What the caller gets back: enough to update the UI, since the node no longer exists. */
export interface DeletedNode {
  id: number;
  structureId: number;
  title: string;
}
