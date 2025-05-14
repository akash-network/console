import { pgTable } from "drizzle-orm/pg-core";

import { getAlertBaseFields } from "@src/modules/alert/model-schemas/alert-base.schema";

export const RawAlert = pgTable("raw_alerts", {
  ...getAlertBaseFields()
});
