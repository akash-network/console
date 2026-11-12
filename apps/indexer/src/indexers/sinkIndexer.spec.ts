import { SinkTotalsSnapshot } from "@akashnetwork/database/dbSchemas/akash";
import type { Transaction, TransactionEvent, TransactionEventAttribute } from "@akashnetwork/database/dbSchemas/base";
import type { LoggerService } from "@akashnetwork/logging";
import type { DecodedTxRaw } from "@cosmjs/proto-signing";
import type { Transaction as DbTransaction } from "sequelize";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

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
  });

  describe("createTables", () => {
    it("creates the snapshot table without dropping an existing one", async () => {
      const { indexer } = setup();
      const sync = vi.spyOn(SinkTotalsSnapshot, "sync").mockResolvedValue(mock<SinkTotalsSnapshot>());

      await indexer.createTables();

      expect(sync).toHaveBeenCalledWith({ force: false });
    });
  });

  describe("dropTables", () => {
    it("drops the snapshot table", async () => {
      const { indexer } = setup();
      const drop = vi.spyOn(SinkTotalsSnapshot, "drop").mockResolvedValue();

      await indexer.dropTables();

      expect(drop).toHaveBeenCalledWith({ cascade: true });
    });
  });

  it("keeps no state to initialize, seed or update per block", async () => {
    const { indexer } = setup();

    await expect(Promise.all([indexer.initCache(), indexer.seed(), indexer.afterEveryBlock()])).resolves.toEqual([undefined, undefined, undefined]);
  });

  function transaction(input: { height: number; hasProcessingError?: boolean }) {
    return mock<Transaction>({ id: "tx-id", height: input.height, hasProcessingError: input.hasProcessingError ?? false });
  }

  function totalsEvent(input: { index: number; mintedAmount: string; mintedCount: number }) {
    const values = {
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

    return mock<TransactionEvent>({
      type: SINK_TOTALS_UPDATED_EVENT_TYPE,
      index: input.index,
      attributes: Object.entries(values).map(([key, value], index) => mock<TransactionEventAttribute>({ key, value, index }))
    });
  }

  function setup() {
    const logger = mock<LoggerService>();
    const indexer = new SinkIndexer(logger);
    const dbTransaction = mock<DbTransaction>();
    const upsert = vi.spyOn(SinkTotalsSnapshot, "upsert").mockResolvedValue([mock<SinkTotalsSnapshot>(), null]);

    return { indexer, logger, dbTransaction, upsert };
  }
});
