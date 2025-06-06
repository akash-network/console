import { faker } from "@faker-js/faker";
import type z from "zod";

import type { ChainMessageAlertOutput } from "@src/modules/alert/repositories/alert/alert.repository";
import type { chainMessageConditionsSchema } from "@src/modules/alert/repositories/alert/alert-json-fields.schema";

export const generateChainMessageAlert = ({
  id = faker.string.uuid(),
  userId = faker.string.uuid(),
  contactPointId = faker.string.uuid(),
  name = faker.lorem.word(),
  summary = "Default summary {{type}}",
  description = "Default description {{type}}",
  conditions = {
    field: "type",
    value: "default",
    operator: "eq"
  } as z.infer<typeof chainMessageConditionsSchema>,
  params,
  enabled = true,
  createdAt = faker.date.recent(),
  updatedAt = faker.date.recent()
}: Partial<ChainMessageAlertOutput>): ChainMessageAlertOutput => {
  return {
    type: "CHAIN_MESSAGE",
    id,
    userId,
    contactPointId,
    name,
    summary,
    description,
    conditions,
    enabled,
    status: "NORMAL",
    minBlockHeight: 0,
    params,
    createdAt,
    updatedAt
  };
};
