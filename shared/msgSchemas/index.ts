import { PropertyTypes } from "../propertyTypes";
import { akashSchemas } from "./akashSchemas";
import { cosmosSchemas } from "./cosmosSchemas";
import { stargazeSchemas } from "./stargazeSchemas";

export type MessageSchemaProperty = PropertyTypes | { [key: string]: MessageSchemaProperty } | { [key: string]: MessageSchemaProperty }[];
export interface IMessageSchema {
  type: string;
  disableCustomAlerts?: boolean;
  showNoConditionWarning?: boolean;
  properties: { [key: string]: MessageSchemaProperty };
}

export const msgSchemas: IMessageSchema[] = [...cosmosSchemas, ...akashSchemas, ...stargazeSchemas];
