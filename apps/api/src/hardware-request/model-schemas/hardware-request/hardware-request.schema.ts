import { sql } from "drizzle-orm";
import { index, integer, jsonb, pgEnum, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

import { Users } from "@src/user/model-schemas";

export const MAX_GPU_MODEL_LENGTH = 100;
export const MAX_REGION_LENGTH = 100;
export const MAX_CONTACT_EMAIL_LENGTH = 255;

export const hardwareRequestCategoryEnum = pgEnum("hardware_request_category", ["gpu_model", "capacity", "region", "other"]);

export type HardwareRequestCategory = (typeof hardwareRequestCategoryEnum.enumValues)[number];

export type HardwareRequestConfiguration = {
  summary: string;
  cpu: number;
  memoryBytes: number;
  storageBytes: number;
  region: string | null;
  gpu?: { count: number; models: string[] };
};

export const HardwareRequests = pgTable(
  "hardware_requests",
  {
    id: uuid("id")
      .primaryKey()
      .notNull()
      .default(sql`uuid_generate_v4()`),
    userId: uuid("user_id")
      .references(() => Users.id, { onDelete: "cascade" })
      .notNull(),
    category: hardwareRequestCategoryEnum("category").notNull(),
    gpuModel: varchar("gpu_model", { length: MAX_GPU_MODEL_LENGTH }),
    quantity: integer("quantity"),
    region: varchar("region", { length: MAX_REGION_LENGTH }),
    details: text("details"),
    contactEmail: varchar("contact_email", { length: MAX_CONTACT_EMAIL_LENGTH }).notNull(),
    configuration: jsonb("configuration").$type<HardwareRequestConfiguration>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
  },
  table => ({
    userIdCreatedAtIdx: index("hardware_requests_user_id_created_at_idx").on(table.userId, table.createdAt)
  })
);
