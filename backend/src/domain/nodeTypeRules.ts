import { NodeType } from "../models/node/nodeType";

export const isSeriesType = (t: NodeType): boolean => t.eadLevel === 'series';
export const isVolumeType = (t: NodeType): boolean => t.eadLevel === 'file';
