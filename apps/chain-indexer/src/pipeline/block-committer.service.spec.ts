import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import { Blocks, IndexerState, Messages, MessageTypes } from "@src/db/schema";
import { BlockCommitterService } from "@src/pipeline/block-committer.service";
import type { DecodedBlock } from "@src/pipeline/decoded-block";
import type { ChainDatabase } from "@src/providers/db.provider";

const MSG_SEND = "/cosmos.bank.v1beta1.MsgSend";

describe(BlockCommitterService.name, () => {
  it("reuses ids of message types that already exist instead of inserting them", async () => {
    const { committer, insertedRows } = setup({ selectResults: [[{ id: 7, type: MSG_SEND }]] });

    await committer.commit(buildBlock([MSG_SEND]));

    expect(insertedRows.filter(call => call.table === MessageTypes)).toEqual([]);
    expect(insertedRows.find(call => call.table === Messages)?.rows).toEqual([expect.objectContaining({ typeId: 7 })]);
  });

  it("inserts only the message types missing from the database and caches returned ids", async () => {
    const { committer, insertedRows } = setup({
      selectResults: [[{ id: 7, type: MSG_SEND }]],
      insertReturning: [{ id: 8, type: "/akash.deployment.v1beta4.MsgCreateDeployment" }]
    });

    await committer.commit(buildBlock([MSG_SEND, "/akash.deployment.v1beta4.MsgCreateDeployment"]));

    const messageTypeInserts = insertedRows.filter(call => call.table === MessageTypes);
    expect(messageTypeInserts).toEqual([{ table: MessageTypes, rows: [{ type: "/akash.deployment.v1beta4.MsgCreateDeployment" }] }]);
    expect(insertedRows.find(call => call.table === Messages)?.rows).toEqual([expect.objectContaining({ typeId: 7 }), expect.objectContaining({ typeId: 8 })]);
  });

  it("resolves ids inserted concurrently by another process via a follow-up select", async () => {
    const { committer, insertedRows } = setup({
      selectResults: [[], [{ id: 9, type: MSG_SEND }]],
      insertReturning: []
    });

    await committer.commit(buildBlock([MSG_SEND]));

    expect(insertedRows.find(call => call.table === Messages)?.rows).toEqual([expect.objectContaining({ typeId: 9 })]);
  });

  it("advances the sync stream checkpoint when committing a single block", async () => {
    const { committer, insertedRows } = setup({ selectResults: [[{ id: 7, type: MSG_SEND }]] });

    await committer.commit(buildBlock([MSG_SEND]));

    expect(insertedRows.find(call => call.table === IndexerState)?.rows).toEqual(expect.objectContaining({ stream: "sync", lastHeight: 10 }));
  });

  describe("commitBatch", () => {
    it("commits all blocks and advances the given stream checkpoint to the batch's last height", async () => {
      const { committer, insertedRows } = setup({ selectResults: [[{ id: 7, type: MSG_SEND }]] });

      await committer.commitBatch([buildBlock([MSG_SEND], 10), buildBlock([MSG_SEND], 11), buildBlock([MSG_SEND], 12)], { stream: "backfill:10-12" });

      expect(insertedRows.find(call => call.table === Blocks)?.rows).toHaveLength(3);
      expect(insertedRows.find(call => call.table === IndexerState)?.rows).toEqual(expect.objectContaining({ stream: "backfill:10-12", lastHeight: 12 }));
    });

    it("throws on a non-contiguous batch before writing anything", async () => {
      const { committer, insertedRows } = setup();

      await expect(committer.commitBatch([buildBlock([MSG_SEND], 10), buildBlock([MSG_SEND], 12)], { stream: "backfill:10-12" })).rejects.toThrow(
        "Non-contiguous batch: expected height 11 at position 1, got 12"
      );
      expect(insertedRows).toEqual([]);
    });

    it("does nothing for an empty batch", async () => {
      const { committer, insertedRows } = setup();

      await committer.commitBatch([], { stream: "backfill:10-12" });

      expect(insertedRows).toEqual([]);
    });

    it("only ever moves the checkpoint forward on conflict, so concurrent writers cannot regress it", async () => {
      const { committer, conflictUpdates } = setup({ selectResults: [[{ id: 7, type: MSG_SEND }]] });

      await committer.commitBatch([buildBlock([MSG_SEND], 10)], { stream: "backfill:10-10" });

      const checkpointSet = conflictUpdates.find(call => call.table === IndexerState)?.config.set as { lastHeight: SQL };
      expect(new PgDialect().sqlToQuery(checkpointSet.lastHeight).sql).toBe('GREATEST("indexer_state"."last_height", EXCLUDED.last_height)');
    });

    it("splits large row sets into multiple inserts within the same transaction", async () => {
      const { committer, insertedRows } = setup({ selectResults: [[{ id: 7, type: MSG_SEND }]] });
      const manyMessages = Array.from({ length: 2_001 }, () => MSG_SEND);

      await committer.commitBatch([buildBlock(manyMessages, 10)], { stream: "backfill:10-10" });

      const messageInserts = insertedRows.filter(call => call.table === Messages);
      expect(messageInserts).toHaveLength(2);
      expect(messageInserts.map(call => (call.rows as unknown[]).length)).toEqual([2_000, 1]);
    });
  });

  function setup(input?: { selectResults?: Array<Array<{ id: number; type: string }>>; insertReturning?: Array<{ id: number; type: string }> }) {
    const selectResults = [...(input?.selectResults ?? [[]])];
    const insertedRows: Array<{ table: unknown; rows: unknown }> = [];
    const conflictUpdates: Array<{ table: unknown; config: { set: unknown } }> = [];

    const dbFake = {
      select: () => ({ from: () => ({ where: () => Promise.resolve(selectResults.shift() ?? []) }) }),
      insert: (table: unknown) => ({
        values: (rows: unknown) => {
          insertedRows.push({ table, rows });
          return {
            onConflictDoNothing: () =>
              Object.assign(Promise.resolve(), {
                returning: () => Promise.resolve(input?.insertReturning ?? [])
              }),
            onConflictDoUpdate: (config: { set: unknown }) => {
              conflictUpdates.push({ table, config });
              return Promise.resolve();
            }
          };
        }
      }),
      transaction: (callback: (tx: unknown) => Promise<void>) => callback(dbFake)
    };

    const committer = new BlockCommitterService(dbFake as unknown as ChainDatabase);
    return { committer, insertedRows, conflictUpdates };
  }

  function buildBlock(typeUrls: string[], height = 10): DecodedBlock {
    return {
      height,
      datetime: new Date("2026-08-11T00:00:00Z"),
      hash: Buffer.from("aa".repeat(32), "hex"),
      parentHash: null,
      proposerAddress: "PROPOSER",
      transactions: [
        {
          index: 0,
          hash: Buffer.from("bb".repeat(32), "hex"),
          code: 0,
          gasUsed: 0,
          gasWanted: 0,
          fee: [],
          messages: typeUrls.map((typeUrl, index) => ({ index, typeUrl, body: null }))
        }
      ]
    };
  }
});
