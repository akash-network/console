import { describe, expect, it, vi } from "vitest";

import type { ApiPgDatabase } from "@src/core/providers/postgres.provider";
import { TxService } from "./tx.service";

describe(TxService.name, () => {
  it("returns no connection outside of a transaction", () => {
    const { service } = setup();

    expect(service.getConnection()).toBeUndefined();
  });

  it("returns no pg transaction outside of a transaction", () => {
    const { service } = setup();

    expect(service.getPgTx()).toBeUndefined();
  });

  describe("transaction", () => {
    it("runs the callback within a single db transaction and returns its value", async () => {
      const { service, transaction } = setup();

      const result = await service.transaction(async () => "result");

      expect(result).toBe("result");
      expect(transaction).toHaveBeenCalledTimes(1);
    });

    it("exposes the running transaction via getPgTx while running", async () => {
      const { service } = setup();

      const txDuringRun = await service.transaction(async () => service.getPgTx());

      expect(txDuringRun).toBeDefined();
      expect(service.getPgTx()).toBeUndefined();
    });

    it("exposes the transaction connection while running", async () => {
      const { service, connection } = setup();

      const connectionDuringRun = await service.transaction(async () => service.getConnection());

      expect(connectionDuringRun).toBe(connection);
      expect(service.getConnection()).toBeUndefined();
    });

    it("reuses the ambient transaction for nested calls", async () => {
      const { service, transaction } = setup();

      await service.transaction(async () => {
        await service.transaction(async () => undefined);
      });

      expect(transaction).toHaveBeenCalledTimes(1);
    });
  });

  describe("afterCommit", () => {
    it("runs right away outside a transaction", () => {
      const { service } = setup();
      const run = vi.fn();

      service.afterCommit(run);

      expect(run).toHaveBeenCalledTimes(1);
    });

    it("runs once the transaction it was queued in commits", async () => {
      const { service, events } = setup();

      await service.transaction(async () => {
        service.afterCommit(() => events.push("ran"));
        events.push("queued");
      });

      expect(events).toEqual(["queued", "committed", "ran"]);
    });

    it("never runs for a transaction that rolls back", async () => {
      const { service } = setup();
      const run = vi.fn();
      const error = new Error("connection reset");

      await expect(
        service.transaction(async () => {
          service.afterCommit(run);
          throw error;
        })
      ).rejects.toBe(error);

      expect(run).not.toHaveBeenCalled();
    });

    it("waits for the outermost transaction when queued in a nested call", async () => {
      const { service, events } = setup();

      await service.transaction(async () => {
        await service.transaction(async () => {
          service.afterCommit(() => events.push("ran"));
        });
        events.push("inner returned");
      });

      expect(events).toEqual(["inner returned", "committed", "ran"]);
    });
  });

  function setup() {
    const connection = {};
    const tx = { _: { session: { client: connection } } };
    const events: string[] = [];
    const transaction = vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => {
      const result = await callback(tx);
      events.push("committed");
      return result;
    });
    const pg = { transaction } as unknown as ApiPgDatabase;
    const service = new TxService(pg);

    return { service, transaction, connection, events };
  }
});
