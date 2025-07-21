import { faker } from "@faker-js/faker";
import type z from "zod";

import type { GeneralAlertOutput } from "@src/modules/alert/repositories/alert/alert.repository";
import type { generalAlertConditionsSchema } from "@src/modules/alert/repositories/alert/alert-json-fields.schema";

export const generateGeneralAlert = ({
  id = faker.string.uuid(),
  type = "CHAIN_MESSAGE",
  userId = faker.string.uuid(),
  notificationChannelId = faker.string.uuid(),
  name = faker.lorem.word(),
  summary = "Default summary {{type}}",
  description = "Default description {{type}}",
  conditions = {
    field: "type",
    value: "default",
    operator: "eq"
  } as z.infer<typeof generalAlertConditionsSchema>,
  params,
  enabled = true,
  createdAt = faker.date.recent(),
  updatedAt = faker.date.recent()
}: Partial<GeneralAlertOutput>): GeneralAlertOutput => {
  return {
    type,
    id,
    userId,
    notificationChannelId,
    name,
    summary,
    description,
    conditions,
    enabled,
    status: "OK",
    minBlockHeight: 0,
    params,
    createdAt,
    updatedAt
  };
};
