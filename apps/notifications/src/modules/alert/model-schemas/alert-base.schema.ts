import { sql } from "drizzle-orm";
import { boolean, jsonb, text, uuid } from "drizzle-orm/pg-core";

import { timestamps } from "@src/lib/db/timestamps";
import { ContactPoint } from "./contact-point.schema";

export const getAlertBaseFields = () => ({
  id: uuid("id")
    .primaryKey()
    .notNull()
    .default(sql`uuid_generate_v4()`),
  userId: uuid("user_id").notNull().unique(),
  contactPointId: uuid("contact_point_id")
    .notNull()
    .references(() => ContactPoint.id),
  summary: text("summary").notNull(),
  description: text("description").notNull(),
  conditions: jsonb("conditions").notNull(),
  enabled: boolean("enabled").notNull().default(true),

  ...timestamps
});
