export interface NodePropertyValues {
  id: number;
  nodeId: number;
  propertyDefinitionId: number;
  valueText?: string;
  valueNumber?: number;
  valueDate?: Date;
  valueBoolean: boolean | null;
  updatedAt?: Date;
  updatedBy?: number;
}
