import { StakingUnbonding } from "@akashnetwork/database/dbSchemas/akash";
import type { Transaction, TransactionEvent, TransactionEventAttribute } from "@akashnetwork/database/dbSchemas/base";
import type { LoggerService } from "@akashnetwork/logging";
import type { DecodedTxRaw } from "@cosmjs/proto-signing";
import type { Transaction as DbTransaction } from "sequelize";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { StakingUnbondingIndexer } from "./stakingUnbondingIndexer";

const DELEGATOR = "akash1353ewfc0v7pnn3xre6v9lraghxrhenswly2yfs";
const VALIDATOR = "akashvaloper17rzdt88vawuuq797jffk0dc9daw4vkgpumh60w";

describe(StakingUnbondingIndexer.name, () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("is selected by the chain definitions under its own name and reads events of successful transactions only", () => {
    const { indexer } = setup();

    expect(indexer.name).toBe("StakingUnbondingIndexer");
    expect(indexer.runForEveryBlocks).toBe(false);
    expect(indexer.processFailedTxs).toBe(false);
    expect(indexer.msgHandlers).toEqual({});
  });

  describe("afterEveryTransaction", () => {
    it("stores each unbond and cancellation under the transaction height", async () => {
      const { indexer, dbTransaction, upsert } = setup();
      const events = [
        unbondingEvent({ id: "event-1", type: "unbond", attributes: { amount: "70624617uakt", completion_time: "2026-12-04T14:50:09Z" } }),
        unbondingEvent({ id: "event-2", type: "cancel_unbonding_delegation", attributes: { amount: "5000000uakt", creation_height: "29500000" } })
      ];

      await indexer.afterEveryTransaction(mock<DecodedTxRaw>(), transaction({ height: 29500504 }), dbTransaction, events);

      expect(upsert).toHaveBeenCalledTimes(2);
      expect(upsert).toHaveBeenNthCalledWith(
        1,
        {
          transactionEventId: "event-1",
          height: 29500504,
          type: "unbond",
          delegator: DELEGATOR,
          validator: VALIDATOR,
          amount: "70624617",
          completionTime: new Date("2026-12-04T14:50:09Z"),
          creationHeight: null
        },
        { transaction: dbTransaction }
      );
      expect(upsert).toHaveBeenNthCalledWith(
        2,
        {
          transactionEventId: "event-2",
          height: 29500504,
          type: "cancel",
          delegator: DELEGATOR,
          validator: VALIDATOR,
          amount: "5000000",
          completionTime: null,
          creationHeight: 29500000
        },
        { transaction: dbTransaction }
      );
    });

    it("stores nothing for a transaction without unbonding events", async () => {
      const { indexer, dbTransaction, upsert, logger } = setup();
      const events = [mock<TransactionEvent>({ id: "event-1", type: "message", attributes: [] })];

      await indexer.afterEveryTransaction(mock<DecodedTxRaw>(), transaction({ height: 10 }), dbTransaction, events);

      expect(upsert).not.toHaveBeenCalled();
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it("stores nothing for a failed transaction", async () => {
      const { indexer, dbTransaction, upsert } = setup();
      const events = [unbondingEvent({ id: "event-1", type: "unbond", attributes: { amount: "1uakt", completion_time: "2026-12-04T14:50:09Z" } })];

      await indexer.afterEveryTransaction(mock<DecodedTxRaw>(), transaction({ height: 10, hasProcessingError: true }), dbTransaction, events);

      expect(upsert).not.toHaveBeenCalled();
    });

    it("skips a malformed event with a warning and still stores the valid ones", async () => {
      const { indexer, dbTransaction, upsert, logger } = setup();
      const events = [
        unbondingEvent({ id: "event-1", type: "unbond", attributes: { amount: "1uact", completion_time: "2026-12-04T14:50:09Z" } }),
        unbondingEvent({ id: "event-2", type: "unbond", attributes: { amount: "1uakt", completion_time: "2026-12-04T14:50:09Z" } })
      ];

      await indexer.afterEveryTransaction(mock<DecodedTxRaw>(), transaction({ height: 10 }), dbTransaction, events);

      expect(logger.warn).toHaveBeenCalledWith({ event: "STAKING_UNBONDING_EVENT_MALFORMED", height: 10, eventType: "unbond" });
      expect(upsert).toHaveBeenCalledTimes(1);
      expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ transactionEventId: "event-2" }), { transaction: dbTransaction });
    });
  });

  describe("afterEveryBlock", () => {
    it("stores nothing", async () => {
      const { indexer, upsert } = setup();

      await indexer.afterEveryBlock();

      expect(upsert).not.toHaveBeenCalled();
    });
  });

  describe("table lifecycle", () => {
    it("creates the table without dropping existing rows", async () => {
      const { indexer } = setup();
      const sync = vi.spyOn(StakingUnbonding, "sync").mockResolvedValue(mock<StakingUnbonding>());

      await indexer.createTables();

      expect(sync).toHaveBeenCalledWith({ force: false });
    });

    it("drops the table with its dependents", async () => {
      const { indexer } = setup();
      const drop = vi.spyOn(StakingUnbonding, "drop").mockResolvedValue();

      await indexer.dropTables();

      expect(drop).toHaveBeenCalledWith({ cascade: true });
    });
  });

  function transaction(input: { height: number; hasProcessingError?: boolean }) {
    return mock<Transaction>({ id: "tx-1", height: input.height, hasProcessingError: input.hasProcessingError ?? false });
  }

  function unbondingEvent(input: { id: string; type: string; attributes: Record<string, string> }) {
    const attributes = Object.entries({ validator: VALIDATOR, delegator: DELEGATOR, msg_index: "0", ...input.attributes }).map(([key, value]) =>
      mock<TransactionEventAttribute>({ key, value })
    );

    return mock<TransactionEvent>({ id: input.id, type: input.type, attributes });
  }

  function setup() {
    const logger = mock<LoggerService>();
    const indexer = new StakingUnbondingIndexer(logger);
    const dbTransaction = mock<DbTransaction>();
    const upsert = vi.spyOn(StakingUnbonding, "upsert").mockResolvedValue([mock<StakingUnbonding>(), null]);

    return { indexer, logger, dbTransaction, upsert };
  }
});
