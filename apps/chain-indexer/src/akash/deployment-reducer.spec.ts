import { describe, expect, it } from "vitest";

import type { AkashBlockChanges, AkashChangeBody, NormalizedGroup } from "@src/akash/akash-changes";
import { decFromInt } from "@src/akash/dec";
import type { DeploymentAggState } from "@src/akash/deployment-reducer";
import { applyBlockChanges, stateKey } from "@src/akash/deployment-reducer";

const OWNER = "akash1owner";
const PROVIDER = "akash1prov";
const KEY = { owner: OWNER, dseq: "42" };
const LEASE_KEY = { ...KEY, gseq: 1, oseq: 1, bseq: 0, provider: PROVIDER };
const BLOCK_TIME = new Date("2026-08-13T00:00:00Z");

describe("applyBlockChanges", () => {
  it("creates a deployment whose totals are the sum of its group resources", () => {
    const { states } = setup();

    applyBlockChanges(states, block(100, [create({ groups: twoGroups() })]));

    const state = get(states);
    expect(state.deposit).toBe(5000000n);
    expect(state.balance).toBe(decFromInt(5000000));
    expect(state.denom).toBe("uakt");
    expect(state.cpuUnits).toBe(1000 * 2 + 500 * 3);
    expect(state.gpuUnits).toBe(0 * 2 + 1 * 3);
    expect(state.memoryBytes).toBe(1024 * 2 + 2048 * 3);
    expect(state.ephemeralStorageBytes).toBe(100 * 2 + 200 * 3);
    expect(state.persistentStorageBytes).toBe(50 * 2 + 0 * 3);
    expect(state.groups).toHaveLength(2);
    expect(state.events).toEqual([{ height: 100, ordinal: 0, txIndex: 0, msgIndex: 0, type: "created", details: { deposit: "5000000", denom: "uakt" } }]);
  });

  it("maps an ibc funding denom and warns on an unknown one instead of throwing", () => {
    const { states } = setup();

    const warnings = applyBlockChanges(
      states,
      block(100, [
        create({ denom: "ibc/170C677610AC31DF0904FFE09CD3B5C657492170E7E52372E48756B71E56F2F1" }),
        { ...create({ denom: "ibc/deadbeef" }), key: { owner: OWNER, dseq: "43" } }
      ])
    );

    expect(get(states).denom).toBe("uusdc");
    expect(states.get(`${OWNER}/43`)?.denom).toBe("ibc/deadbeef");
    expect(warnings).toEqual([{ code: "AKASH_UNKNOWN_DENOM", kind: "deploymentCreated", owner: OWNER, dseq: "43", height: 100 }]);
  });

  it("runs the full lifecycle: create, bid, lease, withdraw, close", () => {
    const { states } = setup();

    applyBlockChanges(states, block(100, [create({}), bidCreated("10")]));
    applyBlockChanges(states, block(110, [leaseCreated()]));
    applyBlockChanges(states, block(150, [{ kind: "leaseWithdrawn", key: LEASE_KEY }]));
    applyBlockChanges(states, block(200, [{ kind: "deploymentClosed", key: KEY }]));

    const state = get(states);
    const lease = state.leases[0];
    expect(lease.price).toBe(decFromInt(10));
    expect(lease.cpuUnits).toBe(2000);
    expect(lease.withdrawn).toBe(decFromInt(90 * 10));
    expect(lease.closedHeight).toBe(200);
    expect(lease.closedAt).toBe(BLOCK_TIME);
    expect(state.withdrawn).toBe(decFromInt(900));
    expect(state.balance).toBe(decFromInt(5000000 - 900));
    expect(state.lastWithdrawHeight).toBe(200);
    expect(state.closedHeight).toBe(200);
    expect(state.closeReason).toBe("close_message");
    expect(state.bids[0].state).toBe("closed");
    expect(state.events.map(event => event.type)).toEqual(["created", "bid_created", "lease_created", "lease_withdrawn", "closed"]);
  });

  it("computes the lease predicted close height from the bid price and re-predicts on deposit", () => {
    const { states } = setup();

    applyBlockChanges(states, block(100, [create({ deposit: "1000" }), bidCreated("10")]));
    applyBlockChanges(states, block(110, [leaseCreated()]));

    expect(get(states).leases[0].predictedClosedHeight).toBe(110n + 100n);

    applyBlockChanges(states, block(120, [{ kind: "deploymentDeposited", key: KEY, amount: "1000", depositor: "akash1grantee" }]));

    const state = get(states);
    expect(state.deposit).toBe(2000n);
    expect(state.balance).toBe(decFromInt(2000));
    expect(state.leases[0].predictedClosedHeight).toBe(110n + 200n);
    expect(state.events.at(-1)).toMatchObject({ type: "deposited", details: { amount: "1000", denom: "uakt", depositor: "akash1grantee" } });
  });

  it("closes everything with reason overdrawn when a settlement exhausts the balance", () => {
    const { states } = setup();

    applyBlockChanges(states, block(100, [create({ deposit: "1000" }), bidCreated("10")]));
    applyBlockChanges(states, block(110, [leaseCreated()]));
    applyBlockChanges(states, block(300, [{ kind: "leaseWithdrawn", key: LEASE_KEY }]));

    const state = get(states);
    expect(state.balance).toBe(0n);
    expect(state.withdrawn).toBe(decFromInt(1000));
    expect(state.closedHeight).toBe(300);
    expect(state.closeReason).toBe("overdrawn");
    expect(state.leases[0].closedHeight).toBe(300);
    expect(state.leases[0].withdrawn).toBe(decFromInt(1000));
    expect(state.bids[0].state).toBe("closed");
    expect(state.events.map(event => event.type)).toEqual(["created", "bid_created", "lease_created", "closed", "lease_withdrawn"]);
  });

  it("keeps the deployment open when leases close and re-predicts the remaining ones", () => {
    const { states } = setup();
    const secondLease = { ...LEASE_KEY, gseq: 2 };

    applyBlockChanges(states, block(100, [create({ groups: twoGroups() }), bidCreated("10"), { ...bidCreated("30"), key: secondLease }]));
    applyBlockChanges(states, block(110, [leaseCreated(), { kind: "leaseCreated", key: secondLease }]));
    applyBlockChanges(states, block(120, [{ kind: "leaseClosed", key: secondLease }]));

    let state = get(states);
    expect(state.closedHeight).toBeNull();
    expect(state.leases.find(lease => lease.gseq === 2)).toMatchObject({ closedHeight: 120, withdrawn: decFromInt(300), balance: 0n });
    expect(state.balance).toBe(decFromInt(5000000 - 400));
    expect(state.leases[0].predictedClosedHeight).toBe(120n + 499960n);

    applyBlockChanges(states, block(130, [{ kind: "leaseClosed", key: LEASE_KEY }]));

    state = get(states);
    expect(state.closedHeight).toBeNull();
    expect(state.leases[0].closedHeight).toBe(130);
    expect(state.withdrawn).toBe(decFromInt(300 + 200));
  });

  it("truncates payouts to whole units and refunds the fraction to the deployment on lease close", () => {
    const { states } = setup();

    applyBlockChanges(states, block(100, [create({ deposit: "500000" }), bidCreated("2.349334")]));
    applyBlockChanges(states, block(110, [leaseCreated()]));
    applyBlockChanges(states, block(122, [{ kind: "leaseClosed", key: LEASE_KEY }]));

    const state = get(states);
    expect(state.leases[0].withdrawn).toBe(decFromInt(28));
    expect(state.leases[0].balance).toBe(0n);
    expect(state.withdrawn).toBe(decFromInt(28));
    expect(state.balance).toBe(decFromInt(500000 - 28));
  });

  it("skips a duplicate block per deployment via the watermark but applies later blocks", () => {
    const { states } = setup();

    applyBlockChanges(states, block(100, [create({}), bidCreated("10")]));
    applyBlockChanges(states, block(110, [leaseCreated()]));
    const snapshot = JSON.stringify(get(states), stringifyBigInt);

    applyBlockChanges(states, block(110, [leaseCreated()]));

    expect(JSON.stringify(get(states), stringifyBigInt)).toBe(snapshot);
    expect(get(states).leases).toHaveLength(1);

    applyBlockChanges(states, block(150, [{ kind: "leaseWithdrawn", key: LEASE_KEY }]));
    expect(get(states).lastWithdrawHeight).toBe(150);
  });

  it("reports orphan references without mutating state", () => {
    const { states } = setup();

    const warnings = applyBlockChanges(states, block(100, [{ kind: "deploymentDeposited", key: KEY, amount: "5", depositor: null }]));

    expect(states.size).toBe(0);
    expect(warnings).toEqual([{ code: "AKASH_ORPHAN_REFERENCE", kind: "deploymentDeposited", owner: OWNER, dseq: "42", height: 100 }]);
  });

  it("applies close-event fallbacks with settlement, only when not already closed", () => {
    const { states } = setup();

    applyBlockChanges(states, block(100, [create({ deposit: "10000" }), bidCreated("10")]));
    applyBlockChanges(states, block(110, [leaseCreated()]));
    applyBlockChanges(states, block(120, [{ kind: "leaseClosedEvent", key: KEY, gseq: 1, oseq: 1, bseq: null, provider: PROVIDER }]));

    let state = get(states);
    expect(state.leases[0].closedHeight).toBe(120);
    expect(state.leases[0].withdrawn).toBe(decFromInt(100));
    expect(state.closedHeight).toBeNull();

    applyBlockChanges(states, block(130, [{ kind: "deploymentClosedEvent", key: KEY }]));
    state = get(states);
    expect(state.closedHeight).toBe(130);
    expect(state.closeReason).toBe("close_event");

    applyBlockChanges(states, block(140, [{ kind: "deploymentClosedEvent", key: KEY }]));
    expect(get(states).closedHeight).toBe(130);
  });

  it("tracks group lifecycle transitions without reopening a closed group", () => {
    const { states } = setup();

    applyBlockChanges(states, block(100, [create({})]));
    applyBlockChanges(states, block(110, [{ kind: "groupPaused", key: KEY, gseq: 1 }]));
    expect(get(states).groups[0].state).toBe("paused");

    applyBlockChanges(states, block(120, [{ kind: "groupClosed", key: KEY, gseq: 1 }]));
    expect(get(states).groups[0]).toMatchObject({ state: "closed", closedHeight: 120 });

    applyBlockChanges(states, block(130, [{ kind: "groupStarted", key: KEY, gseq: 1 }]));
    expect(get(states).groups[0].state).toBe("closed");
  });

  it("assigns sequential event ordinals within a block", () => {
    const { states } = setup();

    applyBlockChanges(states, block(100, [create({}), { kind: "deploymentUpdated", key: KEY }, bidCreated("10")]));

    expect(get(states).events.map(event => [event.type, event.ordinal])).toEqual([
      ["created", 0],
      ["updated", 1],
      ["bid_created", 2]
    ]);
  });

  function setup() {
    return { states: new Map<string, DeploymentAggState>() };
  }

  function get(states: Map<string, DeploymentAggState>): DeploymentAggState {
    const state = states.get(stateKey(KEY));
    if (!state) {
      throw new Error("deployment state missing");
    }
    return state;
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

  function stringifyBigInt(_: string, value: unknown): unknown {
    return typeof value === "bigint" ? value.toString() : value;
  }
});
