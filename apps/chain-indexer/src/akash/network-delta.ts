import type { AkashBlockChanges } from "@src/akash/akash-changes";
import { isProviderChange } from "@src/akash/akash-changes";
import type { DeploymentAggState } from "@src/akash/deployment-reducer";
import { stateKey } from "@src/akash/deployment-reducer";

/**
 * One block's contribution to the network aggregates, measured as the change in the deployment
 * states across the reducer fold. `earnedDeltaByDenom` holds 18-decimal Dec atomics of the change
 * in cumulative provider earnings — Σ(withdrawn + balance) over leases — which is settlement-exact
 * and excludes the close-time fractional refund to the owner by construction.
 */
export interface NetworkBlockDelta {
  height: number;
  leasesCreated: number;
  activeLeaseDelta: number;
  cpuUnitsDelta: number;
  gpuUnitsDelta: number;
  memoryBytesDelta: number;
  ephemeralStorageBytesDelta: number;
  persistentStorageBytesDelta: number;
  earnedDeltaByDenom: Map<string, bigint>;
}

export interface DeploymentNetworkSnapshot {
  leaseCount: number;
  activeLeaseCount: number;
  cpuUnits: number;
  gpuUnits: number;
  memoryBytes: number;
  ephemeralStorageBytes: number;
  persistentStorageBytes: number;
  earnedByDenom: Map<string, bigint>;
}

/**
 * Captures the pre-apply aggregate contribution of every deployment the block's changes reference.
 * A deployment the reducer has not loaded (it is created by this block) snapshots as empty, so its
 * whole post-apply state counts as delta.
 */
export function snapshotNetworkState(states: Map<string, DeploymentAggState>, block: AkashBlockChanges): Map<string, DeploymentNetworkSnapshot> {
  const snapshots = new Map<string, DeploymentNetworkSnapshot>();
  for (const change of block.changes) {
    if (isProviderChange(change)) {
      continue;
    }
    const key = stateKey(change.key);
    if (!snapshots.has(key)) {
      snapshots.set(key, summarizeDeployment(states.get(key)));
    }
  }
  return snapshots;
}

export function diffNetworkDelta(
  before: Map<string, DeploymentNetworkSnapshot>,
  states: Map<string, DeploymentAggState>,
  block: AkashBlockChanges
): NetworkBlockDelta {
  const delta: NetworkBlockDelta = {
    height: block.height,
    leasesCreated: 0,
    activeLeaseDelta: 0,
    cpuUnitsDelta: 0,
    gpuUnitsDelta: 0,
    memoryBytesDelta: 0,
    ephemeralStorageBytesDelta: 0,
    persistentStorageBytesDelta: 0,
    earnedDeltaByDenom: new Map()
  };

  for (const [key, prior] of before) {
    const current = summarizeDeployment(states.get(key));
    delta.leasesCreated += current.leaseCount - prior.leaseCount;
    delta.activeLeaseDelta += current.activeLeaseCount - prior.activeLeaseCount;
    delta.cpuUnitsDelta += current.cpuUnits - prior.cpuUnits;
    delta.gpuUnitsDelta += current.gpuUnits - prior.gpuUnits;
    delta.memoryBytesDelta += current.memoryBytes - prior.memoryBytes;
    delta.ephemeralStorageBytesDelta += current.ephemeralStorageBytes - prior.ephemeralStorageBytes;
    delta.persistentStorageBytesDelta += current.persistentStorageBytes - prior.persistentStorageBytes;
    accumulateEarnedDelta(delta.earnedDeltaByDenom, current.earnedByDenom, prior.earnedByDenom);
  }

  return delta;
}

export function isEmptyNetworkDelta(delta: NetworkBlockDelta): boolean {
  return (
    delta.leasesCreated === 0 &&
    delta.activeLeaseDelta === 0 &&
    delta.cpuUnitsDelta === 0 &&
    delta.gpuUnitsDelta === 0 &&
    delta.memoryBytesDelta === 0 &&
    delta.ephemeralStorageBytesDelta === 0 &&
    delta.persistentStorageBytesDelta === 0 &&
    delta.earnedDeltaByDenom.size === 0
  );
}

function summarizeDeployment(state: DeploymentAggState | undefined): DeploymentNetworkSnapshot {
  const snapshot: DeploymentNetworkSnapshot = {
    leaseCount: 0,
    activeLeaseCount: 0,
    cpuUnits: 0,
    gpuUnits: 0,
    memoryBytes: 0,
    ephemeralStorageBytes: 0,
    persistentStorageBytes: 0,
    earnedByDenom: new Map()
  };
  if (!state) {
    return snapshot;
  }

  snapshot.leaseCount = state.leases.length;
  for (const lease of state.leases) {
    const earned = lease.withdrawn + lease.balance;
    if (earned !== 0n) {
      snapshot.earnedByDenom.set(lease.denom, (snapshot.earnedByDenom.get(lease.denom) ?? 0n) + earned);
    }
    if (lease.closedHeight !== null) {
      continue;
    }
    snapshot.activeLeaseCount += 1;
    snapshot.cpuUnits += lease.cpuUnits;
    snapshot.gpuUnits += lease.gpuUnits;
    snapshot.memoryBytes += lease.memoryBytes;
    snapshot.ephemeralStorageBytes += lease.ephemeralStorageBytes;
    snapshot.persistentStorageBytes += lease.persistentStorageBytes;
  }
  return snapshot;
}

function accumulateEarnedDelta(target: Map<string, bigint>, current: Map<string, bigint>, prior: Map<string, bigint>): void {
  for (const denom of new Set([...current.keys(), ...prior.keys()])) {
    const change = (current.get(denom) ?? 0n) - (prior.get(denom) ?? 0n);
    if (change === 0n) {
      continue;
    }
    const next = (target.get(denom) ?? 0n) + change;
    if (next === 0n) {
      target.delete(denom);
    } else {
      target.set(denom, next);
    }
  }
}
