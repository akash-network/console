export interface DeploymentKey {
  owner: string;
  dseq: string;
}

export interface LeaseKey extends DeploymentKey {
  gseq: number;
  oseq: number;
  bseq: number;
  provider: string;
}

/** A lease/bid's identity within its deployment: the order (gseq, oseq) and the specific bid (bseq, provider), without the owner/dseq. */
export type LeaseSlot = Pick<LeaseKey, "gseq" | "oseq" | "bseq" | "provider">;

/** The set of versioned type URLs for one akash message across proto eras, e.g. `/akash.market.v1beta5.MsgCreateBid`. */
export function akashTypeUrlSet(module: string, name: string, versions: readonly string[]): Set<string> {
  return new Set(versions.map(version => `/akash.${module}.${version}.${name}`));
}

export interface NormalizedResource {
  count: number;
  cpuUnits: number;
  gpuUnits: number;
  gpuVendor: string | null;
  gpuModel: string | null;
  memoryBytes: number;
  ephemeralStorageBytes: number;
  persistentStorageBytes: number;
  price: string;
  priceDenom: string;
}

export interface NormalizedGroup {
  gseq: number;
  resources: NormalizedResource[];
}

interface ChangeOrigin {
  txIndex: number | null;
  msgIndex: number | null;
}

export type AkashChangeBody =
  | { kind: "deploymentCreated"; key: DeploymentKey; denom: string; deposit: string; depositor: string | null; groups: NormalizedGroup[] }
  | { kind: "deploymentDeposited"; key: DeploymentKey; amount: string; depositor: string | null }
  | { kind: "deploymentUpdated"; key: DeploymentKey }
  | { kind: "deploymentClosed"; key: DeploymentKey }
  | { kind: "groupClosed"; key: DeploymentKey; gseq: number }
  | { kind: "groupPaused"; key: DeploymentKey; gseq: number }
  | { kind: "groupStarted"; key: DeploymentKey; gseq: number }
  | { kind: "bidCreated"; key: LeaseKey; price: string; priceDenom: string }
  | { kind: "bidClosed"; key: LeaseKey }
  | { kind: "leaseCreated"; key: LeaseKey }
  | { kind: "leaseClosed"; key: LeaseKey }
  | { kind: "leaseWithdrawn"; key: LeaseKey }
  | { kind: "deploymentClosedEvent"; key: DeploymentKey }
  | { kind: "leaseClosedEvent"; key: DeploymentKey; gseq: number; oseq: number; bseq: number | null; provider: string };

export type AkashChange = AkashChangeBody & ChangeOrigin;

export type AkashChangeKind = AkashChange["kind"];

/** Everything derived from one block, in the exact order the chain applied it (tx order, then message order, then that tx's close events). */
export interface AkashBlockChanges {
  height: number;
  datetime: Date;
  changes: AkashChange[];
}

/** Every address the batch's akash changes reference, for the committer's account interning. */
export function collectAkashAddresses(blocks: AkashBlockChanges[]): Set<string> {
  const addresses = new Set<string>();

  for (const block of blocks) {
    for (const change of block.changes) {
      addresses.add(change.key.owner);
      if ("provider" in change) {
        addresses.add(change.provider);
      } else if ("bseq" in change.key) {
        addresses.add(change.key.provider);
      }
      if ("depositor" in change && change.depositor) {
        addresses.add(change.depositor);
      }
    }
  }

  return addresses;
}
