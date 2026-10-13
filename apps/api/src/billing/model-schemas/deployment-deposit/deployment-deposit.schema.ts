import { sql } from "drizzle-orm";
import { foreignKey, index, integer, numeric, pgEnum, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

import { Organizations } from "@src/organization/model-schemas/organization/organization.schema";
import { Projects } from "@src/organization/model-schemas/project/project.schema";
import { Users } from "@src/user/model-schemas/user/user.schema";

export const deploymentDepositKindEnum = pgEnum("deployment_deposit_kind", ["deployment_create", "top_up"]);

export type DeploymentDepositKind = (typeof deploymentDepositKindEnum.enumValues)[number];

/** A pending deposit may still land, so it counts as committed until the chain says otherwise. */
export const deploymentDepositStatusEnum = pgEnum("deployment_deposit_status", ["pending", "confirmed", "void"]);

export type DeploymentDepositStatus = (typeof deploymentDepositStatusEnum.enumValues)[number];

export const DeploymentDeposits = pgTable(
  "deployment_deposits",
  {
    id: uuid("id")
      .primaryKey()
      .notNull()
      .default(sql`uuid_generate_v4()`),
    organizationId: uuid("organization_id")
      .references(() => Organizations.id, { onDelete: "cascade" })
      .notNull(),
    projectId: uuid("project_id"),
    owner: varchar("owner", { length: 128 }).notNull(),
    dseq: varchar("dseq", { length: 64 }).notNull(),
    kind: deploymentDepositKindEnum("kind").notNull(),
    amount: numeric("amount", { precision: 30, scale: 0 }).notNull(),
    denom: varchar("denom", { length: 128 }).notNull(),
    amountCents: integer("amount_cents").notNull(),
    status: deploymentDepositStatusEnum("status").notNull().default("pending"),
    txHash: varchar("tx_hash", { length: 64 }),
    actorUserId: uuid("actor_user_id").references(() => Users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
  },
  table => ({
    organizationIdCreatedAtIdx: index("deployment_deposits_organization_id_created_at_idx").on(table.organizationId, table.createdAt),
    organizationIdProjectIdCreatedAtIdx: index("deployment_deposits_organization_id_project_id_created_at_idx").on(
      table.organizationId,
      table.projectId,
      table.createdAt
    ),
    pendingTxHashIdx: index("deployment_deposits_pending_tx_hash_idx")
      .on(table.txHash)
      .where(sql`${table.status} = 'pending' AND ${table.txHash} IS NOT NULL`),
    projectFk: foreignKey({
      name: "deployment_deposits_organization_id_project_id_fk",
      columns: [table.organizationId, table.projectId],
      foreignColumns: [Projects.organizationId, Projects.id]
    }).onDelete("cascade")
  })
);
