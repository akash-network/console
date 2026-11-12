import { SinkTotalsSnapshot, SinkTransfer } from "@akashnetwork/database/dbSchemas/akash";
import type { Block, Transaction, TransactionEvent, TransactionEventAttribute } from "@akashnetwork/database/dbSchemas/base";
import type { LoggerService } from "@akashnetwork/logging";
import type { DecodedTxRaw } from "@cosmjs/proto-signing";
import type { Transaction as DbTransaction } from "sequelize";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { BlockResultsReader } from "@src/chain/blockResultsReader";
import type { BlockResultType, EventType } from "@src/shared/types";
import { SinkIndexer } from "./sinkIndexer";
import { SINK_TOTALS_UPDATED_EVENT_TYPE } from "./sinkIndexer.helpers";

describe(SinkIndexer.name, () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("is selected by the chain definitions under its own name and runs for every block", () => {
    const { indexer } = setup();

    expect(indexer.name).toBe("SinkIndexer");
    expect(indexer.runForEveryBlocks).toBe(true);
    expect(indexer.processFailedTxs).toBe(false);
    expect(indexer.msgHandlers).toEqual({});
  });

  describe("afterEveryTransaction", () => {
    it("stores the totals of the last sink totals event under the transaction height", async () => {
      const { indexer, dbTransaction, upsert } = setup();
      const events = [
        totalsEvent({ index: 2, mintedAmount: "100", mintedCount: 1 }),
        mock<TransactionEvent>({ type: "akash.sink.v1.EventTransferCreated", index: 3, attributes: [] }),
        totalsEvent({ index: 5, mintedAmount: "250", mintedCount: 2 })
      ];

      await indexer.afterEveryTransaction(mock<DecodedTxRaw>(), transaction({ height: 29448411 }), dbTransaction, events);

      expect(upsert).toHaveBeenCalledTimes(1);
      expect(upsert).toHaveBeenCalledWith(
        {
          height: 29448411,
          pendingAmount: "10000000",
          pendingCount: 1,
          mintedAmount: "250",
          mintedCount: 2,
          voidedAmount: "0",
          voidedCount: 0,
          refundPendingAmount: "0",
          refundPendingCount: 0,
          refundedAmount: "0",
          refundedCount: 0
        },
        { transaction: dbTransaction }
      );
    });

    it("stores nothing for a transaction without a sink totals event", async () => {
      const { indexer, dbTransaction, upsert, logger } = setup();
      const events = [mock<TransactionEvent>({ type: "message", index: 0, attributes: [] })];

      await indexer.afterEveryTransaction(mock<DecodedTxRaw>(), transaction({ height: 10 }), dbTransaction, events);

      expect(upsert).not.toHaveBeenCalled();
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it("stores nothing for a failed transaction", async () => {
      const { indexer, dbTransaction, upsert } = setup();
      const events = [totalsEvent({ index: 1, mintedAmount: "100", mintedCount: 1 })];

      await indexer.afterEveryTransaction(mock<DecodedTxRaw>(), transaction({ height: 10, hasProcessingError: true }), dbTransaction, events);

      expect(upsert).not.toHaveBeenCalled();
    });

    it("skips a malformed totals event with a warning instead of halting the block group", async () => {
      const { indexer, dbTransaction, upsert, logger } = setup();
      const events = [totalsEvent({ index: 1, mintedAmount: "not-a-number", mintedCount: 1 })];

      await indexer.afterEveryTransaction(mock<DecodedTxRaw>(), transaction({ height: 10 }), dbTransaction, events);

      expect(upsert).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith({ event: "SINK_TOTALS_EVENT_MALFORMED", height: 10, transactionId: "tx-id" });
    });

    it("skips a totals event whose attributes were not loaded", async () => {
      const { indexer, dbTransaction, upsert, logger } = setup();
      const events = [mock<TransactionEvent>({ type: SINK_TOTALS_UPDATED_EVENT_TYPE, index: 1, attributes: undefined })];

      await indexer.afterEveryTransaction(mock<DecodedTxRaw>(), transaction({ height: 10 }), dbTransaction, events);

      expect(upsert).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledTimes(1);
    });

    it("stores a created transfer as pending under its chain id", async () => {
      const { indexer, dbTransaction, upsertTransfer, findTransfer } = setup();
      const events = [transferEvent({ index: 4, name: "EventTransferCreated", attributes: creationAttributeValues() })];

      await indexer.afterEveryTransaction(mock<DecodedTxRaw>(), transaction({ height: 29448411 }), dbTransaction, events);

      expect(upsertTransfer).toHaveBeenCalledTimes(1);
      expect(upsertTransfer).toHaveBeenCalledWith(
        {
          height: 29448411,
          sequence: 1,
          owner: "akash1z6ql8ryp2sjdw2wgvrrwc0sm5u2yn4ghqxj4rl",
          recipient: "CA7haEbmqKYBY7XtQLQzhDYHH1fNrf7Gop3Xshq7Qa8v",
          amount: "10000000",
          status: "pending",
          hasVoidOrder: false,
          statusHeight: 29448411
        },
        { transaction: dbTransaction }
      );
      expect(findTransfer).not.toHaveBeenCalled();
    });

    it("moves a stored transfer to its new status at the transaction height", async () => {
      const { indexer, dbTransaction, findTransfer, updateTransfer, upsertTransfer } = setup({
        storedTransfer: { status: "pending", hasVoidOrder: false, statusHeight: 29448411 }
      });
      const events = [transferEvent({ index: 2, name: "EventMintConfirmed" }), transferEvent({ index: 4, name: "EventOutcomeReported" })];

      await indexer.afterEveryTransaction(mock<DecodedTxRaw>(), transaction({ height: 29448435 }), dbTransaction, events);

      expect(findTransfer).toHaveBeenCalledTimes(1);
      expect(findTransfer).toHaveBeenCalledWith({ where: { height: 29448411, sequence: 1 }, transaction: dbTransaction });
      expect(updateTransfer).toHaveBeenCalledTimes(1);
      expect(updateTransfer).toHaveBeenCalledWith(
        { status: "minted", hasVoidOrder: false, statusHeight: 29448435 },
        { where: { height: 29448411, sequence: 1 }, transaction: dbTransaction }
      );
      expect(upsertTransfer).not.toHaveBeenCalled();
    });

    it("keeps the height of the last status change when only the void order changes", async () => {
      const { indexer, dbTransaction, updateTransfer } = setup({ storedTransfer: { status: "minted", hasVoidOrder: false, statusHeight: 29448435 } });
      const events = [transferEvent({ index: 2, name: "EventVoidOrdered" })];

      await indexer.afterEveryTransaction(mock<DecodedTxRaw>(), transaction({ height: 29500000 }), dbTransaction, events);

      expect(updateTransfer).toHaveBeenCalledWith(
        { status: "minted", hasVoidOrder: true, statusHeight: 29448435 },
        { where: { height: 29448411, sequence: 1 }, transaction: dbTransaction }
      );
    });

    it("writes nothing when an event leaves the stored transfer unchanged", async () => {
      const { indexer, dbTransaction, updateTransfer, logger } = setup({ storedTransfer: { status: "pending", hasVoidOrder: false, statusHeight: 29448411 } });
      const events = [transferEvent({ index: 2, name: "EventOutcomeReported" })];

      await indexer.afterEveryTransaction(mock<DecodedTxRaw>(), transaction({ height: 29448420 }), dbTransaction, events);

      expect(updateTransfer).not.toHaveBeenCalled();
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it("writes a change of status that keeps the void order", async () => {
      const { indexer, dbTransaction, updateTransfer } = setup({ storedTransfer: { status: "voided", hasVoidOrder: true, statusHeight: 29448420 } });
      const events = [transferEvent({ index: 2, name: "EventVoidConfirmed" })];

      await indexer.afterEveryTransaction(mock<DecodedTxRaw>(), transaction({ height: 29448500 }), dbTransaction, events);

      expect(updateTransfer).toHaveBeenCalledWith(
        { status: "refund_pending", hasVoidOrder: true, statusHeight: 29448500 },
        { where: { height: 29448411, sequence: 1 }, transaction: dbTransaction }
      );
    });

    it("skips a status event of a transfer that was never stored with a warning", async () => {
      const { indexer, dbTransaction, updateTransfer, logger } = setup({ storedTransfer: null });
      const events = [transferEvent({ index: 2, name: "EventMintConfirmed" })];

      await indexer.afterEveryTransaction(mock<DecodedTxRaw>(), transaction({ height: 29448435 }), dbTransaction, events);

      expect(updateTransfer).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith({
        event: "SINK_TRANSFER_NOT_FOUND",
        height: 29448435,
        change: "mintConfirmed",
        transfer: { height: 29448411, sequence: 1 }
      });
    });

    it("skips a malformed transfer event with a warning and applies the events after it", async () => {
      const { indexer, dbTransaction, updateTransfer, upsertTransfer, logger } = setup({
        storedTransfer: { status: "refund_pending", hasVoidOrder: true, statusHeight: 29448500 }
      });
      const events = [
        transferEvent({ index: 1, name: "EventTransferCreated", attributes: { ...creationAttributeValues(), amount: '"ten"' } }),
        transferEvent({ index: 2, name: "EventTransferRefunded" })
      ];

      await indexer.afterEveryTransaction(mock<DecodedTxRaw>(), transaction({ height: 29600000 }), dbTransaction, events);

      expect(upsertTransfer).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith({
        event: "SINK_TRANSFER_EVENT_MALFORMED",
        height: 29600000,
        eventType: "akash.sink.v1.EventTransferCreated"
      });
      expect(updateTransfer).toHaveBeenCalledWith(
        { status: "refunded", hasVoidOrder: true, statusHeight: 29600000 },
        { where: { height: 29448411, sequence: 1 }, transaction: dbTransaction }
      );
    });

    it("stores no transfer for a failed transaction", async () => {
      const { indexer, dbTransaction, upsertTransfer, findTransfer } = setup();
      const events = [
        transferEvent({ index: 1, name: "EventTransferCreated", attributes: creationAttributeValues() }),
        transferEvent({ index: 2, name: "EventMintConfirmed" })
      ];

      await indexer.afterEveryTransaction(mock<DecodedTxRaw>(), transaction({ height: 10, hasProcessingError: true }), dbTransaction, events);

      expect(upsertTransfer).not.toHaveBeenCalled();
      expect(findTransfer).not.toHaveBeenCalled();
    });

    it("applies the transfer events of a transaction without a totals event", async () => {
      const { indexer, dbTransaction, upsert, updateTransfer } = setup({ storedTransfer: { status: "minted", hasVoidOrder: false, statusHeight: 29448435 } });
      const events = [transferEvent({ index: 2, name: "EventVoidOrdered" })];

      await indexer.afterEveryTransaction(mock<DecodedTxRaw>(), transaction({ height: 29500000 }), dbTransaction, events);

      expect(upsert).not.toHaveBeenCalled();
      expect(updateTransfer).toHaveBeenCalledTimes(1);
    });
  });

  describe("afterEveryBlock", () => {
    it("replaces the block's snapshot with the totals of its last end-block event", async () => {
      const { indexer, dbTransaction, upsert, bulkCreate, readBlockResults } = setup({
        finalizeBlockEvents: [
          blockTotalsEvent({ mode: "EndBlock", mintedAmount: "100", mintedCount: 1 }),
          { type: "akash.sink.v1.EventVoidOrdered", attributes: [{ key: "mode", value: "EndBlock", index: true }] },
          blockTotalsEvent({ mode: "EndBlock", mintedAmount: "250", mintedCount: 2 })
        ]
      });

      await indexer.afterEveryBlock(block({ height: 29500000 }), null, dbTransaction);

      expect(readBlockResults).toHaveBeenCalledWith(29500000);
      expect(upsert).toHaveBeenCalledTimes(1);
      expect(upsert).toHaveBeenCalledWith(snapshot({ height: 29500000, mintedAmount: "250", mintedCount: 2 }), { transaction: dbTransaction });
      expect(bulkCreate).not.toHaveBeenCalled();
    });

    it("stores begin-block totals only when no transaction wrote a snapshot for the block", async () => {
      const { indexer, dbTransaction, upsert, bulkCreate } = setup({
        finalizeBlockEvents: [blockTotalsEvent({ mode: "BeginBlock", mintedAmount: "100", mintedCount: 1 })]
      });

      await indexer.afterEveryBlock(block({ height: 29500000 }), null, dbTransaction);

      expect(bulkCreate).toHaveBeenCalledTimes(1);
      expect(bulkCreate).toHaveBeenCalledWith([snapshot({ height: 29500000, mintedAmount: "100", mintedCount: 1 })], {
        ignoreDuplicates: true,
        transaction: dbTransaction
      });
      expect(upsert).not.toHaveBeenCalled();
    });

    it("prefers end-block totals over begin-block totals of the same block", async () => {
      const { indexer, dbTransaction, upsert, bulkCreate } = setup({
        finalizeBlockEvents: [
          blockTotalsEvent({ mode: "BeginBlock", mintedAmount: "100", mintedCount: 1 }),
          blockTotalsEvent({ mode: "EndBlock", mintedAmount: "250", mintedCount: 2 })
        ]
      });

      await indexer.afterEveryBlock(block({ height: 29500000 }), null, dbTransaction);

      expect(upsert).toHaveBeenCalledWith(snapshot({ height: 29500000, mintedAmount: "250", mintedCount: 2 }), { transaction: dbTransaction });
      expect(bulkCreate).not.toHaveBeenCalled();
    });

    it("stores nothing for a block without a block-level sink totals event", async () => {
      const { indexer, dbTransaction, upsert, bulkCreate, logger } = setup({
        finalizeBlockEvents: [{ type: "coin_spent", attributes: [{ key: "mode", value: "BeginBlock", index: true }] }]
      });

      await indexer.afterEveryBlock(block({ height: 10 }), null, dbTransaction);

      expect(upsert).not.toHaveBeenCalled();
      expect(bulkCreate).not.toHaveBeenCalled();
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it("stores nothing for a block whose results predate finalize block events", async () => {
      const { indexer, dbTransaction, upsert, bulkCreate } = setup({ finalizeBlockEvents: undefined });

      await indexer.afterEveryBlock(block({ height: 10 }), null, dbTransaction);

      expect(upsert).not.toHaveBeenCalled();
      expect(bulkCreate).not.toHaveBeenCalled();
    });

    it("stores nothing for a block whose node reports null finalize block events", async () => {
      const { indexer, dbTransaction, upsert, bulkCreate } = setup({ finalizeBlockEvents: null });

      await indexer.afterEveryBlock(block({ height: 10 }), null, dbTransaction);

      expect(upsert).not.toHaveBeenCalled();
      expect(bulkCreate).not.toHaveBeenCalled();
    });

    it("skips a malformed block-level totals event with a warning instead of halting the block group", async () => {
      const { indexer, dbTransaction, upsert, bulkCreate, logger } = setup({
        finalizeBlockEvents: [blockTotalsEvent({ mode: "EndBlock", mintedAmount: "not-a-number", mintedCount: 1 })]
      });

      await indexer.afterEveryBlock(block({ height: 10 }), null, dbTransaction);

      expect(upsert).not.toHaveBeenCalled();
      expect(bulkCreate).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith({ event: "SINK_TOTALS_EVENT_MALFORMED", height: 10 });
    });

    it("applies a governance resolution emitted at the end of the block", async () => {
      const { indexer, dbTransaction, findTransfer, updateTransfer } = setup({
        finalizeBlockEvents: [
          blockTotalsEvent({ mode: "EndBlock", mintedAmount: "250", mintedCount: 2 }),
          blockTransferEvent({ name: "EventTransferResolved", attributes: { decision: '"DECISION_CONFIRM_MINT"' } })
        ],
        storedTransfer: { status: "pending", hasVoidOrder: false, statusHeight: 29448411 }
      });

      await indexer.afterEveryBlock(block({ height: 29500000 }), null, dbTransaction);

      expect(findTransfer).toHaveBeenCalledWith({ where: { height: 29448411, sequence: 1 }, transaction: dbTransaction });
      expect(updateTransfer).toHaveBeenCalledWith(
        { status: "minted", hasVoidOrder: false, statusHeight: 29500000 },
        { where: { height: 29448411, sequence: 1 }, transaction: dbTransaction }
      );
    });

    it("applies block-level transfer events of a block without a totals event", async () => {
      const { indexer, dbTransaction, updateTransfer, upsert, bulkCreate } = setup({
        finalizeBlockEvents: [blockTransferEvent({ name: "EventVoidOrdered" })],
        storedTransfer: { status: "minted", hasVoidOrder: false, statusHeight: 29448435 }
      });

      await indexer.afterEveryBlock(block({ height: 29500000 }), null, dbTransaction);

      expect(updateTransfer).toHaveBeenCalledWith(
        { status: "minted", hasVoidOrder: true, statusHeight: 29448435 },
        { where: { height: 29448411, sequence: 1 }, transaction: dbTransaction }
      );
      expect(upsert).not.toHaveBeenCalled();
      expect(bulkCreate).not.toHaveBeenCalled();
    });

    it("applies block-level transfer events after a malformed block-level totals event", async () => {
      const { indexer, dbTransaction, updateTransfer } = setup({
        finalizeBlockEvents: [
          blockTotalsEvent({ mode: "EndBlock", mintedAmount: "not-a-number", mintedCount: 1 }),
          blockTransferEvent({ name: "EventVoidOrdered" })
        ],
        storedTransfer: { status: "pending", hasVoidOrder: false, statusHeight: 29448411 }
      });

      await indexer.afterEveryBlock(block({ height: 29500000 }), null, dbTransaction);

      expect(updateTransfer).toHaveBeenCalledWith(
        { status: "voided", hasVoidOrder: true, statusHeight: 29500000 },
        { where: { height: 29448411, sequence: 1 }, transaction: dbTransaction }
      );
    });

    it("skips a malformed block-level transfer event with a warning", async () => {
      const { indexer, dbTransaction, findTransfer, logger } = setup({
        finalizeBlockEvents: [{ type: "akash.sink.v1.EventVoidOrdered", attributes: [{ key: "mode", value: "EndBlock", index: true }] }]
      });

      await indexer.afterEveryBlock(block({ height: 29500000 }), null, dbTransaction);

      expect(findTransfer).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith({ event: "SINK_TRANSFER_EVENT_MALFORMED", height: 29500000, eventType: "akash.sink.v1.EventVoidOrdered" });
    });
  });

  describe("createTables", () => {
    it("creates the snapshot and transfer tables without dropping existing ones", async () => {
      const { indexer } = setup();
      const syncSnapshots = vi.spyOn(SinkTotalsSnapshot, "sync").mockResolvedValue(mock<SinkTotalsSnapshot>());
      const syncTransfers = vi.spyOn(SinkTransfer, "sync").mockResolvedValue(mock<SinkTransfer>());

      await indexer.createTables();

      expect(syncSnapshots).toHaveBeenCalledWith({ force: false });
      expect(syncTransfers).toHaveBeenCalledWith({ force: false });
    });
  });

  describe("dropTables", () => {
    it("drops the snapshot and transfer tables", async () => {
      const { indexer } = setup();
      const dropSnapshots = vi.spyOn(SinkTotalsSnapshot, "drop").mockResolvedValue();
      const dropTransfers = vi.spyOn(SinkTransfer, "drop").mockResolvedValue();

      await indexer.dropTables();

      expect(dropSnapshots).toHaveBeenCalledWith({ cascade: true });
      expect(dropTransfers).toHaveBeenCalledWith({ cascade: true });
    });
  });

  it("keeps no state to initialize or seed", async () => {
    const { indexer } = setup();

    await expect(Promise.all([indexer.initCache(), indexer.seed()])).resolves.toEqual([undefined, undefined]);
  });

  function block(input: { height: number }) {
    return mock<Block>({ height: input.height });
  }

  function snapshot(input: { height: number; mintedAmount: string; mintedCount: number }) {
    return {
      height: input.height,
      pendingAmount: "10000000",
      pendingCount: 1,
      mintedAmount: input.mintedAmount,
      mintedCount: input.mintedCount,
      voidedAmount: "0",
      voidedCount: 0,
      refundPendingAmount: "0",
      refundPendingCount: 0,
      refundedAmount: "0",
      refundedCount: 0
    };
  }

  function blockTotalsEvent(input: { mode: string; mintedAmount: string; mintedCount: number }): EventType {
    const values = { ...totalsAttributeValues(input), mode: input.mode };

    return { type: SINK_TOTALS_UPDATED_EVENT_TYPE, attributes: Object.entries(values).map(([key, value]) => ({ key, value, index: true })) };
  }

  function transaction(input: { height: number; hasProcessingError?: boolean }) {
    return mock<Transaction>({ id: "tx-id", height: input.height, hasProcessingError: input.hasProcessingError ?? false });
  }

  function totalsEvent(input: { index: number; mintedAmount: string; mintedCount: number }) {
    return mock<TransactionEvent>({
      type: SINK_TOTALS_UPDATED_EVENT_TYPE,
      index: input.index,
      attributes: Object.entries(totalsAttributeValues(input)).map(([key, value], index) => mock<TransactionEventAttribute>({ key, value, index }))
    });
  }

  function totalsAttributeValues(input: { mintedAmount: string; mintedCount: number }) {
    return {
      minted_amount: JSON.stringify({ denom: "uakt", amount: input.mintedAmount }),
      minted_count: JSON.stringify(String(input.mintedCount)),
      pending_amount: JSON.stringify({ denom: "uakt", amount: "10000000" }),
      pending_count: '"1"',
      refund_pending_amount: JSON.stringify({ denom: "uakt", amount: "0" }),
      refund_pending_count: '"0"',
      refunded_amount: JSON.stringify({ denom: "uakt", amount: "0" }),
      refunded_count: '"0"',
      refunded_in_epoch: JSON.stringify({ denom: "uakt", amount: "0" }),
      voided_amount: JSON.stringify({ denom: "uakt", amount: "0" }),
      voided_count: '"0"',
      msg_index: "0"
    };
  }

  function transferEvent(input: { index: number; name: string; attributes?: Record<string, string> }) {
    const values = { ...transferIdAttributeValues(), ...input.attributes, msg_index: "0" };

    return mock<TransactionEvent>({
      type: `akash.sink.v1.${input.name}`,
      index: input.index,
      attributes: Object.entries(values).map(([key, value], index) => mock<TransactionEventAttribute>({ key, value, index }))
    });
  }

  function blockTransferEvent(input: { name: string; attributes?: Record<string, string> }): EventType {
    const values = { ...transferIdAttributeValues(), ...input.attributes, mode: "EndBlock" };

    return { type: `akash.sink.v1.${input.name}`, attributes: Object.entries(values).map(([key, value]) => ({ key, value, index: true })) };
  }

  function transferIdAttributeValues() {
    return { id: JSON.stringify({ owner: "akash1z6ql8ryp2sjdw2wgvrrwc0sm5u2yn4ghqxj4rl", height: "29448411", sequence: "1" }) };
  }

  function creationAttributeValues() {
    return {
      sender: '"akash1z6ql8ryp2sjdw2wgvrrwc0sm5u2yn4ghqxj4rl"',
      recipient: '"CA7haEbmqKYBY7XtQLQzhDYHH1fNrf7Gop3Xshq7Qa8v"',
      amount: JSON.stringify({ denom: "uakt", amount: "10000000" }),
      height: '"29448411"'
    };
  }

  function setup(
    input: {
      finalizeBlockEvents?: EventType[] | null;
      storedTransfer?: { status: string; hasVoidOrder: boolean; statusHeight: number } | null;
    } = {}
  ) {
    const logger = mock<LoggerService>();
    const readBlockResults = vi.fn<BlockResultsReader>().mockResolvedValue(mock<BlockResultType>({ finalize_block_events: input.finalizeBlockEvents }));
    const indexer = new SinkIndexer(readBlockResults, logger);
    const dbTransaction = mock<DbTransaction>();
    const upsert = vi.spyOn(SinkTotalsSnapshot, "upsert").mockResolvedValue([mock<SinkTotalsSnapshot>(), null]);
    const bulkCreate = vi.spyOn(SinkTotalsSnapshot, "bulkCreate").mockResolvedValue([]);
    const upsertTransfer = vi.spyOn(SinkTransfer, "upsert").mockResolvedValue([mock<SinkTransfer>(), null]);
    const findTransfer = vi.spyOn(SinkTransfer, "findOne").mockResolvedValue(input.storedTransfer ? mock<SinkTransfer>(input.storedTransfer) : null);
    const updateTransfer = vi.spyOn(SinkTransfer, "update").mockResolvedValue([1]);

    return { indexer, logger, dbTransaction, upsert, bulkCreate, readBlockResults, upsertTransfer, findTransfer, updateTransfer };
  }
});
