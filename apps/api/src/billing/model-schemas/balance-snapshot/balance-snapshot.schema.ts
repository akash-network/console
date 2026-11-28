import { sql } from "drizzle-orm";
import { bigint, date, index, integer, pgEnum, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";

/** `running` while its grants are being read, `complete` once every grant read at its height is stored, `failed` when the read stopped partway. */
export const balanceSnapshotStatusEnum = pgEnum("balance_snapshot_status", ["running", "complete", "failed"]);

export type BalanceSnapshotStatus = (typeof balanceSnapshotStatusEnum.enumValues)[number];

/** One row per network and UTC day; keyed by network because mainnet and sandbox share this database. */
export const BalanceSnapshots = pgTable(
  "balance_snapshots",
  {
    id: uuid("id")
      .primaryKey()
      .notNull()
      .default(sql`uuid_generate_v4()`),
    network: varchar("network", { length: 32 }).notNull(),
    takenOn: date("taken_on", { mode: "string" }).notNull(),
    status: balanceSnapshotStatusEnum("status").notNull(),
    /** Every grant under this snapshot was read at this height, so what the chain did to a grant afterwards is what a rebuild has to replay. */
    height: bigint("height", { mode: "number" }).notNull(),
    grantsCount: integer("grants_count"),
    failure: text("failure"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
  },
  table => ({
    oneSnapshotPerDay: uniqueIndex("balance_snapshots_network_taken_on_unique").on(table.network, table.takenOn)
  })
);

/** What one funding wallet still owed one user wallet in one denom: the remaining limit of its deposit grant. */
export const BalanceSnapshotGrants = pgTable(
  "balance_snapshot_grants",
  {
    snapshotId: uuid("snapshot_id")
      .references(() => BalanceSnapshots.id, { onDelete: "cascade" })
      .notNull(),
    granter: varchar("granter", { length: 128 }).notNull(),
    grantee: varchar("grantee", { length: 128 }).notNull(),
    denom: varchar("denom", { length: 32 }).notNull(),
    amount: bigint("amount", { mode: "number" }).notNull()
  },
  table => ({
    grantPk: primaryKey({ name: "balance_snapshot_grants_pk", columns: [table.snapshotId, table.granter, table.grantee, table.denom] }),
    granteeIdx: index("balance_snapshot_grants_grantee_idx").on(table.grantee)
  })
);
