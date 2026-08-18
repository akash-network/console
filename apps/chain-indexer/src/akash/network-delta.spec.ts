import { describe, expect, it } from "vitest";

import type { AkashBlockChanges, AkashChangeBody, NormalizedGroup } from "@src/akash/akash-changes";
import { decFromInt } from "@src/akash/dec";
import type { DeploymentAggState } from "@src/akash/deployment-reducer";
import { applyBlockChanges } from "@src/akash/deployment-reducer";
import type { NetworkBlockDelta } from "@src/akash/network-delta";
import { diffNetworkDelta, isEmptyNetworkDelta, snapshotNetworkState } from "@src/akash/network-delta";

const OWNER = "akash1owner";
const PROVIDER = "akash1prov";
const KEY = { owner: OWNER, dseq: "42" };
const LEASE_KEY = { ...KEY, gseq: 1, oseq: 1, bseq: 0, provider: PROVIDER };
const BLOCK_TIME = new Date("2026-08-13T00:00:00Z");

describe("networkDelta", () => {
  it("counts a created lease with its own group's resource totals", () => {
    const { states, fold } = setup();
    fold(block(100, [create({ groups: twoGroups() }), bidCreated("10")]));

    const delta = fold(block(110, [leaseCreated()]));

    expect(delta).toEqual<NetworkBlockDelta>({
      height: 110,
      leasesCreated: 1,
      activeLeaseDelta: 1,
      cpuUnitsDelta: 1000 * 2,
      gpuUnitsDelta: 0 * 2,
      memoryBytesDelta: 1024 * 2,
      ephemeralStorageBytesDelta: 100 * 2,
      persistentStorageBytesDelta: 50 * 2,
      earnedDeltaByDenom: new Map()
    });
    expect(states.size).toBe(1);
  });

  it("removes resources and recognizes settled earnings when a lease closes", () => {
    const { fold } = setup();
    fold(block(100, [create({}), bidCreated("10")]));
    fold(block(110, [leaseCreated()]));

    const delta = fold(block(120, [{ kind: "leaseClosed", key: LEASE_KEY }]));

    expect(delta.leasesCreated).toBe(0);
    expect(delta.activeLeaseDelta).toBe(-1);
    expect(delta.cpuUnitsDelta).toBe(-2000);
    expect(delta.earnedDeltaByDenom).toEqual(new Map([["uakt", decFromInt(10 * 10)]]));
  });

  it("nets out resources but still counts the creation when a lease opens and closes in one block", () => {
    const { fold } = setup();
    fold(block(100, [create({}), bidCreated("10")]));

    const delta = fold(block(110, [leaseCreated(), { kind: "leaseClosed", key: LEASE_KEY }]));

    expect(delta.leasesCreated).toBe(1);
    expect(delta.activeLeaseDelta).toBe(0);
    expect(delta.cpuUnitsDelta).toBe(0);
    expect(delta.gpuUnitsDelta).toBe(0);
  });

  it("recognizes accrued earnings on withdrawal without touching resources", () => {
    const { fold } = setup();
    fold(block(100, [create({}), bidCreated("10")]));
    fold(block(110, [leaseCreated()]));

    const delta = fold(block(150, [{ kind: "leaseWithdrawn", key: LEASE_KEY }]));

    expect(delta.activeLeaseDelta).toBe(0);
    expect(delta.cpuUnitsDelta).toBe(0);
    expect(delta.earnedDeltaByDenom).toEqual(new Map([["uakt", decFromInt(40 * 10)]]));
  });

  it("excludes the close-time fractional refund from earnings", () => {
    const { fold } = setup();
    fold(block(100, [create({ deposit: "500000" }), bidCreated("2.349334")]));
    fold(block(110, [leaseCreated()]));

    const delta = fold(block(122, [{ kind: "leaseClosed", key: LEASE_KEY }]));

    expect(delta.earnedDeltaByDenom).toEqual(new Map([["uakt", decFromInt(28)]]));
  });

  it("keeps earnings of concurrent deployments separate per denom", () => {
    const { fold } = setup();
    const usdcKey = { owner: OWNER, dseq: "43" };
    const usdcLeaseKey = { ...usdcKey, gseq: 1, oseq: 1, bseq: 0, provider: PROVIDER };
    fold(
      block(100, [
        create({}),
        bidCreated("10"),
        { ...create({ denom: "ibc/170C677610AC31DF0904FFE09CD3B5C657492170E7E52372E48756B71E56F2F1" }), key: usdcKey },
        { kind: "bidCreated", key: usdcLeaseKey, price: "5", priceDenom: "uusdc" }
      ])
    );
    fold(block(110, [leaseCreated(), { kind: "leaseCreated", key: usdcLeaseKey }]));

    const delta = fold(
      block(120, [
        { kind: "leaseWithdrawn", key: LEASE_KEY },
        { kind: "leaseWithdrawn", key: usdcLeaseKey }
      ])
    );

    expect(delta.earnedDeltaByDenom).toEqual(
      new Map([
        ["uakt", decFromInt(100)],
        ["uusdc", decFromInt(50)]
      ])
    );
  });

  it("produces an empty delta for a provider-only block", () => {
    const { states } = setup();

    const before = snapshotNetworkState(states, block(100, [{ kind: "providerDeleted", owner: OWNER }]));
    applyBlockChanges(states, block(100, [{ kind: "providerDeleted", owner: OWNER }]));
    const delta = diffNetworkDelta(before, states, block(100, []));

    expect(before.size).toBe(0);
    expect(isEmptyNetworkDelta(delta)).toBe(true);
  });

  it("produces an empty delta when the watermark skips a replayed block", () => {
    const { fold } = setup();
    fold(block(100, [create({}), bidCreated("10")]));
    fold(block(110, [leaseCreated()]));

    const delta = fold(block(110, [leaseCreated()]));

    expect(isEmptyNetworkDelta(delta)).toBe(true);
  });

  function setup() {
    const states = new Map<string, DeploymentAggState>();
    const fold = (blockChanges: AkashBlockChanges): NetworkBlockDelta => {
      const before = snapshotNetworkState(states, blockChanges);
      applyBlockChanges(states, blockChanges);
      return diffNetworkDelta(before, states, blockChanges);
    };
    return { states, fold };
  }

  function block(height: number, bodies: AkashChangeBody[]): AkashBlockChanges {
    return {
      height,
      datetime: BLOCK_TIME,
      changes: bodies.map((body, index) => ({ ...body, txIndex: 0, msgIndex: index }))
    };
  }

  function create(input: { deposit?: string; denom?: string; groups?: NormalizedGroup[] }): AkashChangeBody {
    return {
      kind: "deploymentCreated",
      key: KEY,
      denom: input.denom ?? "uakt",
      deposit: input.deposit ?? "5000000",
      depositor: null,
      groups: input.groups ?? [group(1, { cpuUnits: 1000, count: 2 })]
    };
  }

  function bidCreated(price: string): AkashChangeBody {
    return { kind: "bidCreated", key: LEASE_KEY, price, priceDenom: "uakt" };
  }

  function leaseCreated(): AkashChangeBody {
    return { kind: "leaseCreated", key: LEASE_KEY };
  }

  function twoGroups(): NormalizedGroup[] {
    return [
      group(1, { cpuUnits: 1000, gpuUnits: 0, memoryBytes: 1024, ephemeralStorageBytes: 100, persistentStorageBytes: 50, count: 2 }),
      group(2, { cpuUnits: 500, gpuUnits: 1, memoryBytes: 2048, ephemeralStorageBytes: 200, persistentStorageBytes: 0, count: 3 })
    ];
  }

  function group(gseq: number, resource: Partial<NormalizedGroup["resources"][number]>): NormalizedGroup {
    return {
      gseq,
      resources: [
        {
          count: 1,
          cpuUnits: 0,
          gpuUnits: 0,
          gpuVendor: null,
          gpuModel: null,
          memoryBytes: 0,
          ephemeralStorageBytes: 0,
          persistentStorageBytes: 0,
          price: "1",
          priceDenom: "uakt",
          ...resource
        }
      ]
    };
  }
});
