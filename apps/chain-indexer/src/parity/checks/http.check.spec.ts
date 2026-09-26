import { describe, expect, it } from "vitest";

import { HttpCheck } from "@src/parity/checks/http.check";
import type { Fetch } from "@src/providers/fetch.provider";

const LEGACY = "https://legacy.test";
const V2 = "https://v2.test";

describe(HttpCheck.name, () => {
  it("passes when block detail, the block list, address history and network stats all agree", async () => {
    const { check } = setup({ heights: [10], addresses: ["akash1a"] });

    const result = await check.run();

    expect(result).toEqual({
      name: "http",
      status: "pass",
      summary: "block-detail: 1 height agrees; blocks-list: 2 shared heights agree; address-transactions: 1 address agrees; network-stats: agree at height 12",
      mismatches: []
    });
  });

  it("fails with the path of each field that differs", async () => {
    const { check } = setup({
      heights: [10],
      v2Overrides: {
        [`${V2}/v1/blocks/10`]: {
          data: v2Block(10, ["T1", "T2"], {
            transactions: [
              { hash: "T1", code: 0 },
              { hash: "ZZ", code: 5 }
            ]
          })
        }
      }
    });

    const result = await check.run();

    expect(result.status).toBe("fail");
    expect(result.mismatches).toEqual([
      { subject: "block 10.transactions[1].hash", expected: "T2", actual: "ZZ" },
      { subject: "block 10.transactions[1].isSuccess", expected: true, actual: false }
    ]);
  });

  it("reports a block one side does not serve", async () => {
    const { check } = setup({ heights: [10], v2Overrides: { [`${V2}/v1/blocks/10`]: { status: 404, body: { error: "not found" } } } });

    const result = await check.run();

    expect(result.mismatches).toEqual([{ subject: "block 10", expected: { status: 200 }, actual: { status: 404 } }]);
  });

  it("counts a height neither side has reached as not comparable instead of agreeing", async () => {
    const { check } = setup({
      heights: [10, 99],
      legacyOverrides: { [`${LEGACY}/v1/blocks/99`]: { status: 404, body: {} } },
      v2Overrides: { [`${V2}/v1/blocks/99`]: { status: 404, body: {} } }
    });

    const result = await check.run();

    expect(result.status).toBe("pass");
    expect(result.summary).toContain("block-detail: 1 height agrees, 1 not reached on both sides");
  });

  it("skips block detail when no configured height is reached on both sides", async () => {
    const { check } = setup({
      heights: [99],
      legacyOverrides: { [`${LEGACY}/v1/blocks/99`]: { status: 404, body: {} } },
      v2Overrides: { [`${V2}/v1/blocks/99`]: { status: 404, body: {} } }
    });

    const result = await check.run();

    expect(result.summary).toContain("block-detail: skipped (no configured height reached on both sides)");
  });

  it("keeps the other parts' results when one part's endpoint fails", async () => {
    const { check } = setup({ heights: [10], legacyOverrides: { [`${LEGACY}/v1/blocks?limit=2`]: { status: 500, body: {} } } });

    const result = await check.run();

    expect(result.status).toBe("fail");
    expect(result.summary).toContain("block-detail: 1 height agrees");
    expect(result.summary).toContain("blocks-list: threw:");
    expect(result.mismatches).toEqual([
      { subject: "blocks-list", expected: "HTTP 200 from both sides", actual: `${LEGACY}/v1/blocks?limit=2 returned HTTP 500` }
    ]);
  });

  it("compares the block list only over the heights both sides return", async () => {
    const { check } = setup({ legacyOverrides: { [`${LEGACY}/v1/blocks?limit=2`]: [legacySummary(13, 4), legacySummary(12, 1)] } });

    const result = await check.run();

    expect(result.status).toBe("pass");
    expect(result.summary).toContain("blocks-list: 1 shared height agrees");
  });

  it("aligns address history on the newest shared height before comparing totals and entries", async () => {
    const { check } = setup({
      addresses: ["akash1a"],
      v2Overrides: {
        [`${V2}/v1/addresses/akash1a/transactions?skip=0&limit=2`]: { data: { total: 6, transactions: [v2Tx(13, "N1"), v2Tx(12, "T9")] } }
      }
    });

    const result = await check.run();

    expect(result.status).toBe("pass");
    expect(result.summary).toContain("address-transactions: 1 address agrees");
  });

  it("reports an extra transaction on one side once instead of shifting every entry after it", async () => {
    const { check } = setup({
      addresses: ["akash1a"],
      v2Overrides: {
        [`${V2}/v1/addresses/akash1a/transactions?skip=0&limit=2`]: { data: { total: 6, transactions: [v2Tx(12, "T9"), v2Tx(11, "X1"), v2Tx(11, "T8")] } }
      }
    });

    const result = await check.run();

    expect(result.mismatches).toEqual([
      { subject: "address akash1a.total", expected: 5, actual: 6 },
      { subject: "address akash1a.transactions[X1]", expected: "missing", actual: "present at height 11" }
    ]);
  });

  it("reports one address the api role does not serve without losing the other addresses' results", async () => {
    const { check } = setup({
      addresses: ["akash1a", "akash1b"],
      legacyOverrides: { [`${LEGACY}/v1/addresses/akash1b/transactions/0/2`]: { count: 0, results: [] } },
      v2Overrides: { [`${V2}/v1/addresses/akash1b/transactions?skip=0&limit=2`]: { status: 400, body: { error: "invalid address" } } }
    });

    const result = await check.run();

    expect(result.status).toBe("fail");
    expect(result.summary).toContain("address-transactions: 2 addresses compared, 1 difference");
    expect(result.mismatches).toEqual([{ subject: "address akash1b", expected: { status: 200 }, actual: { status: 400 } }]);
  });

  it("counts an address neither side serves as not comparable", async () => {
    const { check } = setup({
      addresses: ["akash1a", "akash1b"],
      legacyOverrides: { [`${LEGACY}/v1/addresses/akash1b/transactions/0/2`]: { status: 404, body: {} } },
      v2Overrides: { [`${V2}/v1/addresses/akash1b/transactions?skip=0&limit=2`]: { status: 404, body: {} } }
    });

    const result = await check.run();

    expect(result.status).toBe("pass");
    expect(result.summary).toContain("address-transactions: 1 address agrees, 1 not comparable");
  });

  it("fails when the aligned address totals differ", async () => {
    const { check } = setup({
      addresses: ["akash1a"],
      v2Overrides: { [`${V2}/v1/addresses/akash1a/transactions?skip=0&limit=2`]: { data: { total: 7, transactions: [v2Tx(12, "T9"), v2Tx(11, "T8")] } } }
    });

    const result = await check.run();

    expect(result.mismatches).toEqual([{ subject: "address akash1a.total", expected: 5, actual: 7 }]);
  });

  it("skips network stats when the two sides are at different heights", async () => {
    const { check } = setup({ v2Overrides: { [`${V2}/v1/network-stats?days=0`]: { data: v2Stats(11) } } });

    const result = await check.run();

    expect(result.status).toBe("pass");
    expect(result.summary).toContain("network-stats: skipped (legacy at 12, v2 at 11)");
  });

  it("fails when the USD totals differ at the same height", async () => {
    const { check } = setup({ v2Overrides: { [`${V2}/v1/network-stats?days=0`]: { data: { ...v2Stats(12), totalUsdSpent: "9.75" } } } });

    const result = await check.run();

    expect(result.status).toBe("fail");
    expect(result.mismatches).toEqual([{ subject: "network-stats@12.totalUusdSpent", expected: 9_500_000, actual: 9_750_000 }]);
  });

  it("is skipped when nothing could be compared", async () => {
    const { check } = setup({
      legacyOverrides: { [`${LEGACY}/v1/blocks?limit=2`]: [legacySummary(30, 0), legacySummary(29, 0)] },
      v2Overrides: { [`${V2}/v1/network-stats?days=0`]: { data: v2Stats(11) } }
    });

    const result = await check.run();

    expect(result.status).toBe("skipped");
  });

  function legacySummary(height: number, transactionCount: number) {
    return { height, datetime: `d${height}`, transactionCount, totalTransactionCount: 0, proposer: { address: "P" } };
  }

  function v2Summary(height: number, transactionCount: number) {
    return { height, datetime: `d${height}`, hash: `H${height}`, proposer: { address: "P", operatorAddress: null, moniker: null }, transactionCount };
  }

  function legacyBlock(height: number, txHashes: string[]) {
    return {
      height,
      datetime: `d${height}`,
      hash: `H${height}`,
      gasUsed: 10,
      gasWanted: 20,
      proposer: { address: "P" },
      transactions: txHashes.map(hash => ({ hash, isSuccess: true, fee: 1, messages: [{ type: "/m" }] }))
    };
  }

  function v2Block(height: number, txHashes: string[], overrides: { transactions?: { hash: string; code: number }[] } = {}) {
    const transactions = overrides.transactions ?? txHashes.map(hash => ({ hash, code: 0 }));
    return {
      ...v2Summary(height, transactions.length),
      parentHash: null,
      transactions: transactions.map((tx, index) => ({
        index,
        hash: tx.hash,
        code: tx.code,
        gasUsed: 5,
        gasWanted: 10,
        fee: [],
        messages: [{ index: 0, type: "/m" }]
      }))
    };
  }

  function legacyTx(height: number, hash: string) {
    return { height, hash, isSuccess: true, messages: [{ type: "/m" }] };
  }

  function v2Tx(height: number, hash: string) {
    return { height, datetime: `d${height}`, hash, code: 0, gasUsed: 1, gasWanted: 1, fee: [], roles: ["signer"], messages: [{ index: 0, type: "/m" }] };
  }

  function legacyStats(height: number) {
    return {
      height,
      activeLeaseCount: 1,
      totalLeaseCount: 2,
      activeCPU: 3,
      activeGPU: 0,
      activeMemory: 4,
      activeStorage: 5,
      totalUAktSpent: 6,
      totalUUsdcSpent: 7,
      totalUActSpent: 8,
      totalUUsdSpent: 9_500_000
    };
  }

  function v2Stats(height: number) {
    return {
      height,
      datetime: `d${height}`,
      activeLeaseCount: 1,
      totalLeaseCount: 2,
      activeProviderCount: 1,
      active: { cpuUnits: 3, gpuUnits: 0, memoryBytes: 4, ephemeralStorageBytes: 5, persistentStorageBytes: 0 },
      totalSpent: { uakt: "6", uusdc: "7", uact: "8" },
      totalUsdSpent: "9.5",
      daily: []
    };
  }

  function setup(input: { heights?: number[]; addresses?: string[]; legacyOverrides?: Record<string, unknown>; v2Overrides?: Record<string, unknown> }) {
    const responses: Record<string, unknown> = {
      [`${LEGACY}/v1/blocks?limit=2`]: [legacySummary(12, 1), legacySummary(11, 0)],
      [`${LEGACY}/v1/blocks/10`]: legacyBlock(10, ["T1", "T2"]),
      [`${LEGACY}/v1/addresses/akash1a/transactions/0/2`]: { count: 5, results: [legacyTx(12, "T9"), legacyTx(11, "T8")] },
      [`${LEGACY}/v1/dashboard-data`]: { now: legacyStats(12), chainStats: { height: 12 } },
      [`${V2}/v1/blocks?limit=2`]: { data: [v2Summary(12, 1), v2Summary(11, 0)] },
      [`${V2}/v1/blocks/10`]: { data: v2Block(10, ["T1", "T2"]) },
      [`${V2}/v1/addresses/akash1a/transactions?skip=0&limit=2`]: { data: { total: 5, transactions: [v2Tx(12, "T9"), v2Tx(11, "T8")] } },
      [`${V2}/v1/network-stats?days=0`]: { data: v2Stats(12) },
      ...input.legacyOverrides,
      ...input.v2Overrides
    };
    const requested: string[] = [];
    const fetch: Fetch = async url => {
      requested.push(String(url));
      const response = responses[String(url)];
      if (response === undefined) return new Response("missing stub", { status: 500 });
      const { status, body } = isStatusStub(response) ? response : { status: 200, body: response };
      return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
    };
    const check = new HttpCheck(fetch, {
      legacyBaseUrl: LEGACY,
      v2BaseUrl: V2,
      heights: input.heights ?? [],
      addresses: input.addresses ?? [],
      sampleLimit: 2
    });
    return { check, requested };
  }

  function isStatusStub(value: unknown): value is { status: number; body: unknown } {
    return typeof value === "object" && value !== null && "status" in value && "body" in value;
  }
});
