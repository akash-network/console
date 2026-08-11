import { describe, expect, it } from "vitest";

import { Messages, MessageTypes } from "@src/db/schema";
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

  function setup(input?: { selectResults?: Array<Array<{ id: number; type: string }>>; insertReturning?: Array<{ id: number; type: string }> }) {
    const selectResults = [...(input?.selectResults ?? [[]])];
    const insertedRows: Array<{ table: unknown; rows: unknown }> = [];

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
            onConflictDoUpdate: () => Promise.resolve()
          };
        }
      }),
      transaction: (callback: (tx: unknown) => Promise<void>) => callback(dbFake)
    };

    const committer = new BlockCommitterService(dbFake as unknown as ChainDatabase);
    return { committer, insertedRows };
  }

  function buildBlock(typeUrls: string[]): DecodedBlock {
    return {
      height: 10,
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
