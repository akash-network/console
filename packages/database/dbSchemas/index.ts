import { Model, ModelCtor } from "sequelize-typescript";

import { activeChain, chainDefinitions } from "../chainDefinitions";
import {
  AddressReference,
  Block as BaseBlock,
  Day,
  Message as BaseMessage,
  MonitoredValue,
  Transaction,
  Validator,
  TransactionEvent,
  TransactionEventAttribute
} from "./base";
import { Template, TemplateFavorite, UserSetting } from "./user";

function getFilteredBaseModel(): ModelCtor<Model<any, any>>[] {
  let models: ModelCtor<Model<any, any>>[] = baseModels;
  if (activeChain.customBlockModel) {
    models = models.filter(model => model !== BaseBlock);
  }
  if (activeChain.customMessageModel) {
    models = models.filter(model => model !== BaseMessage);
  }

  return models;
}

const baseModels: ModelCtor<Model<any, any>>[] = [
  AddressReference,
  BaseBlock,
  Day,
  BaseMessage,
  Transaction,
  TransactionEvent,
  TransactionEventAttribute,
  Validator,
  MonitoredValue
];

export function getChainModels(chainName: string) {
  let models: ModelCtor<Model<any, any>>[] = baseModels;
  if (chainDefinitions[chainName].customBlockModel) {
    models = models.filter(model => model !== BaseBlock);
  }
  if (chainDefinitions[chainName].customMessageModel) {
    models = models.filter(model => model !== BaseMessage);
  }

  return [...models, ...(chainDefinitions[chainName].customModels ?? [])];
}

export const chainModels = [...getFilteredBaseModel(), ...(activeChain.customModels ?? [])];
export const userModels: ModelCtor<Model<any, any>>[] = [UserSetting, Template, TemplateFavorite];
export const Block = activeChain.customBlockModel || BaseBlock;
export const Message = activeChain.customMessageModel || BaseMessage;
