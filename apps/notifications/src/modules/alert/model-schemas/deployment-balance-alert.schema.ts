import { integer, pgEnum, pgTable, varchar } from "drizzle-orm/pg-core";

import { getAlertBaseFields } from "@src/modules/alert/model-schemas/alert-base.schema";

export const AlertStatus = pgEnum("alert_status", ["normal", "firing"]);

export const DeploymentBalanceAlert = pgTable("deployment_balance_alerts", {
  ...getAlertBaseFields(),
  status: AlertStatus("status").notNull().default("normal"),
  dseq: varchar("dseq").notNull(),
  owner: varchar("owner").notNull(),
  minBlockHeight: integer("min_block_height")
});
