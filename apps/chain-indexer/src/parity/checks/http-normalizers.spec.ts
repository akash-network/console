import { describe, expect, it } from "vitest";

import {
  normalizeLegacyAddressTransactions,
  normalizeLegacyBlock,
  normalizeLegacyBlockSummaries,
  normalizeLegacyNetworkStats,
  normalizeV2AddressTransactions,
  normalizeV2Block,
  normalizeV2BlockSummaries,
  normalizeV2NetworkStats
} from "@src/parity/checks/http-normalizers";

describe("http normalizers", () => {
  it("reduces both block detail shapes to the same fields", () => {
    const legacy = normalizeLegacyBlock({
      height: 10,
      datetime: "2026-09-25T21:44:19.314Z",
      hash: "AB",
      gasUsed: 5,
      gasWanted: 7,
      proposer: { address: "P" },
      transactions: [{ hash: "T1", isSuccess: false, fee: 3, messages: [{ type: "/a.Msg", amount: 1 }] }]
    });
    const v2 = normalizeV2Block({
      height: 10,
      datetime: "2026-09-25T21:44:19.314Z",
      hash: "AB",
      parentHash: null,
      proposer: { address: "P", operatorAddress: null, moniker: null },
      transactionCount: 1,
      transactions: [{ index: 0, hash: "T1", code: 11, gasUsed: 5, gasWanted: 7, fee: [], messages: [{ index: 0, type: "/a.Msg" }] }]
    });

    expect(legacy).toEqual(v2);
    expect(v2).toEqual({
      height: 10,
      datetime: "2026-09-25T21:44:19.314Z",
      hash: "AB",
      gasUsed: 5,
      gasWanted: 7,
      transactions: [{ hash: "T1", isSuccess: false, messageTypes: ["/a.Msg"] }]
    });
  });

  it("sums a block's gas from its transactions on the v2 side", () => {
    const v2 = normalizeV2Block({
      height: 1,
      datetime: "d",
      hash: "H",
      parentHash: null,
      proposer: { address: "P", operatorAddress: null, moniker: null },
      transactionCount: 2,
      transactions: [
        { index: 0, hash: "A", code: 0, gasUsed: 1, gasWanted: 2, fee: [], messages: [] },
        { index: 1, hash: "B", code: 0, gasUsed: 10, gasWanted: 20, fee: [], messages: [] }
      ]
    });

    expect(v2).toMatchObject({ gasUsed: 11, gasWanted: 22 });
  });

  it("keys block summaries by height with their datetime and transaction count", () => {
    expect(normalizeLegacyBlockSummaries([{ height: 3, datetime: "d3", transactionCount: 2, totalTransactionCount: 9 }])).toEqual(
      new Map([[3, { height: 3, datetime: "d3", transactionCount: 2 }]])
    );
    expect(
      normalizeV2BlockSummaries([
        { height: 3, datetime: "d3", hash: "H", proposer: { address: "P", operatorAddress: null, moniker: null }, transactionCount: 2 }
      ])
    ).toEqual(new Map([[3, { height: 3, datetime: "d3", transactionCount: 2 }]]));
  });

  it("reduces both address history shapes to the same fields", () => {
    const legacy = normalizeLegacyAddressTransactions({ count: 4, results: [{ height: 9, hash: "T", isSuccess: true, messages: [{ type: "/x" }] }] });
    const v2 = normalizeV2AddressTransactions({
      total: 4,
      transactions: [
        { height: 9, datetime: "d", hash: "T", code: 0, gasUsed: 1, gasWanted: 1, fee: [], roles: ["signer"], messages: [{ index: 0, type: "/x" }] }
      ]
    });

    expect(legacy).toEqual(v2);
    expect(v2).toEqual({ total: 4, transactions: [{ height: 9, hash: "T", isSuccess: true, messageTypes: ["/x"] }] });
  });

  it("reduces both network stat shapes to whole u-denom and micro-USD spend and active resources", () => {
    const legacy = normalizeLegacyNetworkStats({
      height: 50,
      activeLeaseCount: 2,
      totalLeaseCount: 9,
      activeCPU: 1000,
      activeGPU: 1,
      activeMemory: 2048,
      activeStorage: 4096,
      totalUAktSpent: 123.4,
      totalUUsdcSpent: 10,
      totalUActSpent: 0,
      totalUUsdSpent: 1_234_567.8
    });
    const v2 = normalizeV2NetworkStats({
      height: 50,
      datetime: "d",
      activeLeaseCount: 2,
      totalLeaseCount: 9,
      activeProviderCount: 3,
      active: { cpuUnits: 1000, gpuUnits: 1, memoryBytes: 2048, ephemeralStorageBytes: 4000, persistentStorageBytes: 96 },
      totalSpent: { uakt: "123.400000000000000000", uusdc: "10", uact: "0" },
      totalUsdSpent: "1.234567800000000000",
      daily: []
    });

    expect(legacy).toEqual(v2);
    expect(v2).toEqual({
      height: 50,
      activeLeaseCount: 2,
      totalLeaseCount: 9,
      activeCpu: 1000,
      activeGpu: 1,
      activeMemory: 2048,
      activeStorage: 4096,
      totalUaktSpent: 123,
      totalUusdcSpent: 10,
      totalUactSpent: 0,
      totalUusdSpent: 1_234_567
    });
  });
});
