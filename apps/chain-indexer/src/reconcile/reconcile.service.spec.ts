import { toBase64 } from "@cosmjs/encoding";
import { QueryAllBalancesResponse, QueryTotalSupplyResponse } from "cosmjs-types/cosmos/bank/v1beta1/query";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { IndexerState } from "@src/db/schema";
import type { ChainDatabase } from "@src/providers/db.provider";
import type { LoggerService } from "@src/providers/logging.provider";
import { ALL_BALANCES_PATH } from "@src/reconcile/bank-query";
import { ReconcileService } from "@src/reconcile/reconcile.service";
import type { RpcClientPool } from "@src/rpc/rpc-client-pool.service";

const coin = (denom: string, amount: string) => ({ denom, amount });

describe(ReconcileService.name, () => {
  it("returns true when every sampled account and the total supply match the chain", async () => {
    const { service, abciQuery } = setup({
      checkpoint: 100,
      balanceRows: [{ address: "akash1a", denom: "uakt", amount: "100" }],
      chainBalances: { akash1a: [coin("uakt", "100")] },
      chainSupply: [coin("uakt", "100")]
    });

    await expect(service.reconcile()).resolves.toBe(true);
    expect(abciQuery.mock.calls.every(call => call[2] === 100)).toBe(true);
  });

  it("returns false when a sampled account balance disagrees with the chain", async () => {
    const { service } = setup({
      checkpoint: 100,
      balanceRows: [{ address: "akash1a", denom: "uakt", amount: "100" }],
      chainBalances: { akash1a: [coin("uakt", "90")] },
      chainSupply: [coin("uakt", "100")]
    });

    await expect(service.reconcile()).resolves.toBe(false);
  });

  it("returns false when the total supply disagrees with the ledger", async () => {
    const { service } = setup({
      checkpoint: 100,
      balanceRows: [{ address: "akash1a", denom: "uakt", amount: "100" }],
      chainBalances: { akash1a: [coin("uakt", "100")] },
      chainSupply: [coin("uakt", "999")]
    });

    await expect(service.reconcile()).resolves.toBe(false);
  });

  it("returns false when there is no sync checkpoint to reconcile against", async () => {
    const { service } = setup({ checkpoint: undefined, balanceRows: [], chainBalances: {}, chainSupply: [] });

    await expect(service.reconcile()).resolves.toBe(false);
  });

  it("fails fast on a non-integer sample size instead of silently checking nothing", async () => {
    const { service, abciQuery } = setup({
      checkpoint: 100,
      balanceRows: [{ address: "akash1a", denom: "uakt", amount: "100" }],
      chainBalances: { akash1a: [coin("uakt", "100")] },
      chainSupply: [coin("uakt", "100")]
    });

    await expect(service.reconcile({ sampleSize: NaN })).resolves.toBe(false);
    expect(abciQuery).not.toHaveBeenCalled();
  });

  it("reads the checkpoint height and ledger balances from one repeatable-read snapshot", async () => {
    const { service, transaction, baseSelect, txSelect } = setup({
      checkpoint: 100,
      balanceRows: [{ address: "akash1a", denom: "uakt", amount: "100" }],
      chainBalances: { akash1a: [coin("uakt", "100")] },
      chainSupply: [coin("uakt", "100")]
    });

    await service.reconcile();

    expect(transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "repeatable read", accessMode: "read only" });
    expect(baseSelect).not.toHaveBeenCalled();
    expect(txSelect).toHaveBeenCalledTimes(2);
  });

  it("caps concurrent balance queries instead of issuing them one at a time", async () => {
    const balanceRows = Array.from({ length: 25 }, (_, index) => ({ address: `akash1a${index}`, denom: "uakt", amount: "100" }));
    const chainBalances = Object.fromEntries(balanceRows.map(row => [row.address, [coin("uakt", "100")]]));
    const { service, maxInFlight } = setup({ checkpoint: 100, balanceRows, chainBalances, chainSupply: [coin("uakt", "2500")] });

    await service.reconcile();

    expect(maxInFlight()).toBeGreaterThan(1);
    expect(maxInFlight()).toBeLessThan(balanceRows.length);
  });

  function setup(input: {
    checkpoint: number | undefined;
    balanceRows: { address: string; denom: string; amount: string }[];
    chainBalances: Record<string, { denom: string; amount: string }[]>;
    chainSupply: { denom: string; amount: string }[];
  }) {
    const buildSelect = () => ({
      from: (table: unknown) => {
        if (table === IndexerState) {
          return { where: () => Promise.resolve(input.checkpoint === undefined ? [] : [{ lastHeight: input.checkpoint }]) };
        }
        return { innerJoin: () => Promise.resolve(input.balanceRows) };
      }
    });

    const baseSelect = vi.fn(buildSelect);
    const txSelect = vi.fn(buildSelect);
    const transaction = vi.fn(async (callback: (tx: unknown) => unknown) => callback({ select: txSelect }));
    const dbFake = { select: baseSelect, transaction };

    let inFlight = 0;
    let maxInFlight = 0;
    const rpc = mock<RpcClientPool>();
    rpc.abciQuery.mockImplementation(async (path, dataHex) => {
      if (path === ALL_BALANCES_PATH) {
        inFlight++;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await Promise.resolve();
        inFlight--;
        const address = Object.keys(input.chainBalances).find(candidate => Buffer.from(dataHex, "hex").toString("utf8").includes(candidate));
        return { value: toBase64(QueryAllBalancesResponse.encode({ balances: input.chainBalances[address ?? ""] ?? [], pagination: undefined }).finish()) };
      }
      return { value: toBase64(QueryTotalSupplyResponse.encode({ supply: input.chainSupply, pagination: undefined }).finish()) };
    });

    const service = new ReconcileService(dbFake as unknown as ChainDatabase, rpc, mock<LoggerService>());
    return { service, abciQuery: rpc.abciQuery, transaction, baseSelect, txSelect, maxInFlight: () => maxInFlight };
  }
});
