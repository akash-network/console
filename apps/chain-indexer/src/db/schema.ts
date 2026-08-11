import { bigint, index, integer, jsonb, pgSchema, pgTable, primaryKey, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

import { bytea } from "@src/db/bytea";

export const cosmosSchema = pgSchema("cosmos");

export const Blocks = cosmosSchema.table("blocks", {
  height: bigint("height", { mode: "number" }).primaryKey(),
  datetime: timestamp("datetime", { withTimezone: true }).notNull(),
  hash: bytea("hash").notNull(),
  parentHash: bytea("parent_hash"),
  proposerAddress: text("proposer_address").notNull(),
  txCount: integer("tx_count").notNull()
});

export interface FeeCoin {
  denom: string;
  amount: string;
}

export const Transactions = cosmosSchema.table(
  "transactions",
  {
    height: bigint("height", { mode: "number" }).notNull(),
    index: integer("index").notNull(),
    hash: bytea("hash").notNull(),
    code: integer("code").notNull(),
    gasUsed: bigint("gas_used", { mode: "number" }).notNull(),
    gasWanted: bigint("gas_wanted", { mode: "number" }).notNull(),
    fee: jsonb("fee").$type<FeeCoin[]>().notNull()
  },
  t => [primaryKey({ columns: [t.height, t.index] }), index("transactions_hash_idx").on(t.hash)]
);

export const MessageTypes = cosmosSchema.table(
  "message_types",
  {
    id: serial("id").primaryKey(),
    type: text("type").notNull()
  },
  t => [uniqueIndex("message_types_type_idx").on(t.type)]
);

export const Messages = cosmosSchema.table(
  "messages",
  {
    height: bigint("height", { mode: "number" }).notNull(),
    txIndex: integer("tx_index").notNull(),
    index: integer("index").notNull(),
    typeId: integer("type_id")
      .notNull()
      .references(() => MessageTypes.id),
    body: jsonb("body")
  },
  t => [primaryKey({ columns: [t.height, t.txIndex, t.index] }), index("messages_type_id_idx").on(t.typeId)]
);

export const IndexerState = pgTable("indexer_state", {
  stream: text("stream").primaryKey(),
  lastHeight: bigint("last_height", { mode: "number" }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull()
});
