import { bigint, pgTable, text } from "drizzle-orm/pg-core";

import { timestamps } from "@src/lib/db/timestamps";

export const BlockCursor = pgTable("block_cursor", {
  id: text("id").primaryKey().default("latest"),
  lastProcessedBlock: bigint("last_processed_block", {
    mode: "number"
  }).notNull(),
  ...timestamps
});
