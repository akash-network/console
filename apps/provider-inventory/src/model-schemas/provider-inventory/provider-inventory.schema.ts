import { sql } from "drizzle-orm";
import { bigint, boolean, index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { jsonbBigint } from "@src/lib/jsonb-bigint/jsonb-bigint.column";

export const providerInventory = pgTable(
  "provider_inventory",
  {
    owner: text("owner").primaryKey(),
    hostUri: text("host_uri").notNull(),
    isOnline: boolean("is_online").notNull().default(false),
    isOnlineSince: timestamp("is_online_since", { withTimezone: true }),

    inventory: jsonbBigint("inventory").notNull().default({}),

    totalAvailableCpu: bigint("total_available_cpu", { mode: "bigint" }).notNull().default(BigInt(0)),
    totalAvailableMemory: bigint("total_available_memory", { mode: "bigint" }).notNull().default(BigInt(0)),
    totalAvailableGpu: bigint("total_available_gpu", { mode: "bigint" }).notNull().default(BigInt(0)),
    totalAvailableEph: bigint("total_available_eph", { mode: "bigint" }).notNull().default(BigInt(0)),
    totalAvailablePersistent: bigint("total_available_persistent", { mode: "bigint" }).notNull().default(BigInt(0)),
    maxNodeFreeCpu: bigint("max_node_free_cpu", { mode: "bigint" }).notNull().default(BigInt(0)),
    maxNodeFreeMemory: bigint("max_node_free_memory", { mode: "bigint" }).notNull().default(BigInt(0)),
    maxNodeFreeGpu: bigint("max_node_free_gpu", { mode: "bigint" }).notNull().default(BigInt(0)),

    gpuModels: text("gpu_models").array().notNull().default([]),
    storageClasses: text("storage_classes").array().notNull().default([]),

    selfAttributes: jsonbBigint("self_attributes").notNull().default([]),
    signedAttributes: jsonbBigint("signed_attributes").notNull().default([]),
    auditedBy: text("audited_by").array().notNull().default([]),

    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  table => ({
    onlineIdx: index("idx_provider_inventory_online")
      .on(table.owner)
      .where(sql`is_online AND is_online_since IS NOT NULL`)
  })
);
