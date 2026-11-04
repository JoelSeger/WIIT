import type { Node } from "./node";
import type { NodeType } from "./nodeType";
import type { NodePropertyValues } from "./nodePropertyValues";
import type { PropertyDefinition } from "../property/propertyDefinition";

export interface NodeValue extends NodePropertyValues {
  definition: PropertyDefinition;
}

// rowVersion is a Buffer used for optimistic locking, so it is left out of the tree
export interface TreeNode extends Omit<Node, "rowVersion"> {
  nodeType: NodeType;
  values: NodeValue[];
  children: TreeNode[];
}
