import { sql } from "drizzle-orm";
import { boolean, integer, jsonb, pgEnum, pgTable, text, uuid } from "drizzle-orm/pg-core";

import { timestamps } from "@src/lib/db/timestamps";
import { ContactPoint } from "@src/modules/alert/model-schemas/contact-point.schema";

export const AlertStatus = pgEnum("alert_status", ["NORMAL", "FIRING", "FIRED"]);
export const AlertType = pgEnum("alert_type", ["CHAIN_MESSAGE", "DEPLOYMENT_BALANCE"]);

export const Alert = pgTable("alerts", {
  id: uuid("id")
    .primaryKey()
    .notNull()
    .default(sql`uuid_generate_v4()`),
  userId: uuid("user_id").notNull(),
  contactPointId: uuid("contact_point_id")
    .notNull()
    .references(() => ContactPoint.id),
  name: text("name").notNull(),
  summary: text("summary").notNull(),
  description: text("description").notNull(),
  conditions: jsonb("conditions").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  type: AlertType("type").notNull(),
  status: AlertStatus("status").notNull().default("NORMAL"),
  params: jsonb("params"),
  minBlockHeight: integer("min_block_height").notNull().default(0),

  ...timestamps
});
