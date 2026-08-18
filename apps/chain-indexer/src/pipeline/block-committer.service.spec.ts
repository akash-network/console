import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AkashWriter } from "@src/akash/akash-writer.service";
import type { NetworkBlockDelta } from "@src/akash/network-delta";
import type { ProviderWriter } from "@src/akash/provider-writer.service";
import type { BmeWriter } from "@src/bme/bme-writer.service";
import { AccountTxs, Blocks, IndexerState, MessageDeadLetters, Messages, MessageTypes } from "@src/db/schema";
import type { GovWriter } from "@src/gov/gov-writer.service";
import type { NetworkStatsWriter } from "@src/network/network-stats-writer.service";
import type { AccountInterner } from "@src/pipeline/balance/account-interner.service";
import type { BalanceWriter } from "@src/pipeline/balance/balance-writer.service";
import { BlockCommitterService } from "@src/pipeline/block-committer.service";
import type { DecodedBlock, DecodedEvent, MessageDecodeFailure } from "@src/pipeline/decoded-block";
import type { ChainDatabase } from "@src/providers/db.provider";
import type { LoggerService } from "@src/providers/logging.provider";

const MSG_SEND = "/cosmos.bank.v1beta1.MsgSend";
const BALANCE_WRITE = Symbol("balance_write");

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

  describe("dead letters", () => {
    const UNKNOWN_TYPE = "/akash.unknown.v1.MsgMystery";

    it("dead-letters messages whose body failed to decode and reports them loudly", async () => {
      const { committer, insertedRows, logger } = setup({
        selectResults: [[{ id: 7, type: MSG_SEND }]],
        insertReturning: [{ id: 8, type: UNKNOWN_TYPE }],
        messagesWithNullBody: [{ height: 10, txIndex: 0, index: 1 }]
      });
      const failure = { raw: new Uint8Array([1, 2, 3]), error: "Unregistered type url: /akash.unknown.v1.MsgMystery" };

      await committer.commit(buildBlock([MSG_SEND, { typeUrl: UNKNOWN_TYPE, decodeFailure: failure }]));

      expect(insertedRows.find(call => call.table === MessageDeadLetters)?.rows).toEqual([
        { height: 10, txIndex: 0, index: 1, typeId: 8, raw: Buffer.from([1, 2, 3]), error: failure.error }
      ]);
      expect(logger.error).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalledWith({
        event: "MESSAGES_DEAD_LETTERED",
        stream: "sync",
        count: 1,
        byType: { [UNKNOWN_TYPE]: 1 },
        fromHeight: 10,
        toHeight: 10
      });
    });

    it("does not re-insert a dead letter when another writer already populated the body", async () => {
      const { committer, insertedRows, logger } = setup({
        selectResults: [[{ id: 7, type: MSG_SEND }]],
        insertReturning: [{ id: 8, type: UNKNOWN_TYPE }],
        messagesWithNullBody: []
      });
      const failure = { raw: new Uint8Array([1, 2, 3]), error: "Unregistered type url: /akash.unknown.v1.MsgMystery" };

      await committer.commit(buildBlock([MSG_SEND, { typeUrl: UNKNOWN_TYPE, decodeFailure: failure }]));

      expect(insertedRows.find(call => call.table === MessageDeadLetters)).toBeUndefined();
      expect(logger.error).not.toHaveBeenCalled();
    });

    it("dead-letters only the messages whose body is still null when the batch is mixed", async () => {
      const { committer, insertedRows, logger } = setup({
        selectResults: [[{ id: 7, type: MSG_SEND }]],
        insertReturning: [{ id: 8, type: UNKNOWN_TYPE }],
        messagesWithNullBody: [{ height: 10, txIndex: 0, index: 2 }]
      });
      const healed = { raw: new Uint8Array([1]), error: "Unregistered type url: /akash.unknown.v1.MsgMystery" };
      const stillUnknown = { raw: new Uint8Array([2]), error: "Unregistered type url: /akash.unknown.v1.MsgMystery" };

      await committer.commit(buildBlock([MSG_SEND, { typeUrl: UNKNOWN_TYPE, decodeFailure: healed }, { typeUrl: UNKNOWN_TYPE, decodeFailure: stillUnknown }]));

      expect(insertedRows.find(call => call.table === MessageDeadLetters)?.rows).toEqual([
        { height: 10, txIndex: 0, index: 2, typeId: 8, raw: Buffer.from([2]), error: stillUnknown.error }
      ]);
      expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ event: "MESSAGES_DEAD_LETTERED", count: 1, byType: { [UNKNOWN_TYPE]: 1 } }));
    });

    it("clears the batch's height range of dead letters so a clean replay heals them", async () => {
      const { committer, insertedRows, deletions, logger } = setup({ selectResults: [[{ id: 7, type: MSG_SEND }]] });

      await committer.commitBatch([buildBlock([MSG_SEND], 10), buildBlock([MSG_SEND], 11), buildBlock([MSG_SEND], 12)], { stream: "backfill:10-12" });

      const deletion = deletions.find(call => call.table === MessageDeadLetters);
      const rendered = new PgDialect().sqlToQuery(deletion?.where as SQL);
      expect(rendered.sql).toBe('"cosmos"."message_dead_letters"."height" between $1 and $2');
      expect(rendered.params).toEqual([10, 12]);
      expect(insertedRows.find(call => call.table === MessageDeadLetters)).toBeUndefined();
      expect(logger.error).not.toHaveBeenCalled();
    });

    it("heals null message bodies on conflict without touching decoded ones", async () => {
      const { committer, conflictUpdates } = setup({ selectResults: [[{ id: 7, type: MSG_SEND }]] });

      await committer.commit(buildBlock([MSG_SEND]));

      const messagesUpsert = conflictUpdates.find(call => call.table === Messages);
      expect(new PgDialect().sqlToQuery(messagesUpsert?.config.set.body as SQL).sql).toBe("excluded.body");
      expect(new PgDialect().sqlToQuery(messagesUpsert?.config.setWhere as SQL).sql).toBe('"cosmos"."messages"."body" IS NULL AND excluded.body IS NOT NULL');
    });
  });

  describe("balance ledger and activity log", () => {
    it("writes balances then the activity log inside the transaction, after messages and before the checkpoint", async () => {
      const { committer, insertedRows } = setup({ selectResults: [[{ id: 7, type: MSG_SEND }]] });

      await committer.commit(buildBlock([MSG_SEND], 10, { signerAddresses: ["akash1signer"], events: [transfer("akash1signer", "akash1b", "1uakt")] }));

      const order = insertedRows.map(call => call.table);
      expect(order.indexOf(Messages)).toBeLessThan(order.indexOf(BALANCE_WRITE));
      expect(order.indexOf(BALANCE_WRITE)).toBeLessThan(order.indexOf(AccountTxs));
      expect(order.indexOf(AccountTxs)).toBeLessThan(order.indexOf(IndexerState));
    });

    it("passes balance intents with interned account ids to the balance writer", async () => {
      const { committer, balanceWriter } = setup({ selectResults: [[{ id: 7, type: MSG_SEND }]] });

      await committer.commit(buildBlock([MSG_SEND], 10, { events: [coinSpent("akash1a", "100uakt")] }));

      expect(balanceWriter.write.mock.calls[0][1]).toEqual([
        expect.objectContaining({ accountId: 1, counterpartyAccountId: null, denom: "uakt", delta: -100n, height: 10 })
      ]);
    });

    it("interns signers, spenders, receivers and counterparties in one pass", async () => {
      const { committer, interner } = setup({ selectResults: [[{ id: 7, type: MSG_SEND }]] });

      await committer.commit(
        buildBlock([MSG_SEND], 10, {
          signerAddresses: ["akash1signer"],
          events: [coinSpent("akash1a", "1uakt"), coinReceived("akash1b", "1uakt"), transfer("akash1a", "akash1b", "1uakt")]
        })
      );

      const interned = new Set([...interner.resolve.mock.calls[0][0]]);
      expect(interned).toEqual(new Set(["akash1a", "akash1b", "akash1signer"]));
    });
  });

  describe("governance", () => {
    it("hands the governance writer the batch blocks and interned account ids inside the transaction", async () => {
      const { committer, insertedRows, govWriter } = setup({ selectResults: [[{ id: 7, type: MSG_SEND }]] });

      await committer.commit(buildBlock([MSG_SEND], 10, { signerAddresses: ["akash1voter"] }));

      expect(govWriter.writeForBlocks).toHaveBeenCalledWith(expect.anything(), [expect.objectContaining({ height: 10 })], expect.any(Map));
      const accountIds = govWriter.writeForBlocks.mock.calls[0][2];
      expect(accountIds.get("akash1voter")).toBeDefined();
      const order = insertedRows.map(call => call.table);
      expect(order.indexOf(AccountTxs)).toBeLessThan(order.indexOf(IndexerState));
    });

    it("hands the akash writer the derived changes and interns the addresses they reference", async () => {
      const { committer, akashWriter } = setup({ selectResults: [[{ id: 7, type: MSG_SEND }]] });

      await committer.commit(
        buildBlock([MSG_SEND], 10, {
          events: [{ type: "akash.deployment.v1.EventDeploymentClosed", attributes: { id: '{"owner":"akash1owner","dseq":"42"}' } }]
        })
      );

      expect(akashWriter.write).toHaveBeenCalledWith(
        expect.anything(),
        [expect.objectContaining({ height: 10, changes: [expect.objectContaining({ kind: "deploymentClosedEvent" })] })],
        expect.any(Map)
      );
      const accountIds = akashWriter.write.mock.calls[0][2];
      expect(accountIds.get("akash1owner")).toBeDefined();
    });

    it("hands the provider writer the same derived changes and account ids as the akash writer", async () => {
      const { committer, akashWriter, providerWriter } = setup({ selectResults: [[{ id: 7, type: MSG_SEND }]] });

      await committer.commit(
        buildBlock([MSG_SEND], 10, {
          events: [{ type: "akash.deployment.v1.EventDeploymentClosed", attributes: { id: '{"owner":"akash1owner","dseq":"42"}' } }]
        })
      );

      expect(providerWriter.write).toHaveBeenCalledWith(expect.anything(), akashWriter.write.mock.calls[0][1], akashWriter.write.mock.calls[0][2]);
    });

    it("hands the bme writer the derived changes and interns the record parties", async () => {
      const { committer, bmeWriter } = setup({ selectResults: [[{ id: 7, type: MSG_SEND }]] });

      await committer.commit(
        buildBlock([MSG_SEND], 10, {
          events: [
            {
              type: "akash.bme.v1.EventLedgerRecordExecuted",
              attributes: {
                id: '{"denom":"uakt","to_denom":"uact","source":"bme","height":9,"sequence":1}',
                burned_from: '"akash1bmeburner"',
                minted_to: '"akash1bmeminter"',
                minted: '{"coin":{"denom":"uact","amount":"100"},"price":"1.000000000000000000"}'
              }
            }
          ]
        })
      );

      expect(bmeWriter.write).toHaveBeenCalledWith(
        expect.anything(),
        [expect.objectContaining({ height: 10, changes: [expect.objectContaining({ kind: "ledgerRecordExecuted" })] })],
        expect.any(Map)
      );
      const accountIds = bmeWriter.write.mock.calls[0][2];
      expect(accountIds.get("akash1bmeburner")).toBeDefined();
      expect(accountIds.get("akash1bmeminter")).toBeDefined();
    });

    it("hands the network stats writer the batch blocks and the akash writer's deltas", async () => {
      const { committer, akashWriter, networkStatsWriter } = setup({ selectResults: [[{ id: 7, type: MSG_SEND }]] });
      const deltas = [mock<NetworkBlockDelta>({ height: 10 })];
      akashWriter.write.mockResolvedValue({ networkDeltas: deltas });

      const block = buildBlock([MSG_SEND], 10);
      await committer.commit(block);

      expect(networkStatsWriter.write).toHaveBeenCalledWith(expect.anything(), [block], deltas);
    });
  });

  function setup(input?: {
    selectResults?: Array<Array<{ id: number; type: string }>>;
    insertReturning?: Array<{ id: number; type: string }>;
    messagesWithNullBody?: Array<{ height: number; txIndex: number; index: number }>;
  }) {
    const selectResults = [...(input?.selectResults ?? [[]])];
    const insertedRows: Array<{ table: unknown; rows: unknown }> = [];
    const conflictUpdates: Array<{ table: unknown; config: { set: Record<string, unknown>; setWhere?: unknown } }> = [];
    const deletions: Array<{ table: unknown; where: unknown }> = [];

    const dbFake = {
      select: () => ({
        from: (table: unknown) => ({
          where: () => Promise.resolve(table === Messages ? input?.messagesWithNullBody ?? [] : selectResults.shift() ?? [])
        })
      }),
      insert: (table: unknown) => ({
        values: (rows: unknown) => {
          insertedRows.push({ table, rows });
          return {
            onConflictDoNothing: () =>
              Object.assign(Promise.resolve(), {
                returning: () => Promise.resolve(input?.insertReturning ?? [])
              }),
            onConflictDoUpdate: (config: { set: Record<string, unknown>; setWhere?: unknown }) => {
              conflictUpdates.push({ table, config });
              return Promise.resolve();
            }
          };
        }
      }),
      delete: (table: unknown) => ({
        where: (where: unknown) => {
          deletions.push({ table, where });
          return Promise.resolve();
        }
      }),
      transaction: (callback: (tx: unknown) => Promise<void>) => callback(dbFake)
    };

    const interner = mock<AccountInterner>();
    interner.resolve.mockImplementation(async addresses => new Map([...addresses].map((address, index) => [address, index + 1])));

    const balanceWriter = mock<BalanceWriter>();
    balanceWriter.write.mockImplementation(async () => {
      insertedRows.push({ table: BALANCE_WRITE, rows: [] });
    });

    const govWriter = mock<GovWriter>();
    const akashWriter = mock<AkashWriter>();
    akashWriter.write.mockResolvedValue({ networkDeltas: [] });
    const providerWriter = mock<ProviderWriter>();
    const bmeWriter = mock<BmeWriter>();
    const networkStatsWriter = mock<NetworkStatsWriter>();
    const logger = mock<LoggerService>();
    const committer = new BlockCommitterService(
      dbFake as unknown as ChainDatabase,
      interner,
      balanceWriter,
      govWriter,
      akashWriter,
      providerWriter,
      bmeWriter,
      networkStatsWriter,
      logger
    );
    return {
      committer,
      insertedRows,
      conflictUpdates,
      deletions,
      interner,
      balanceWriter,
      govWriter,
      akashWriter,
      providerWriter,
      bmeWriter,
      networkStatsWriter,
      logger
    };
  }

  function buildBlock(
    typeUrls: Array<string | { typeUrl: string; decodeFailure: MessageDecodeFailure }>,
    height = 10,
    tx?: { events?: DecodedEvent[]; signerAddresses?: string[]; blockEvents?: DecodedEvent[] }
  ): DecodedBlock {
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
          messages: typeUrls.map((entry, index) =>
            typeof entry === "string"
              ? { index, typeUrl: entry, body: null }
              : { index, typeUrl: entry.typeUrl, body: null, decodeFailure: entry.decodeFailure }
          ),
          events: tx?.events ?? [],
          signerAddresses: tx?.signerAddresses ?? []
        }
      ],
      blockEvents: tx?.blockEvents ?? []
    };
  }

  function coinSpent(spender: string, amount: string): DecodedEvent {
    return { type: "coin_spent", attributes: { spender, amount } };
  }

  function coinReceived(receiver: string, amount: string): DecodedEvent {
    return { type: "coin_received", attributes: { receiver, amount } };
  }

  function transfer(sender: string, recipient: string, amount: string): DecodedEvent {
    return { type: "transfer", attributes: { sender, recipient, amount } };
  }
});
