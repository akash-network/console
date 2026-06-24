import type { DeploymentGroup } from "@src/types/deployment";

/**
 * Confidential Compute (TEE) helpers for the deployment detail view.
 *
 * The declared TEE type is an on-chain group placement requirement: `group_spec.requirements.attributes`
 * carries a `tee/type` attribute (`cpu` | `cpu-gpu`) so only TEE-capable providers can bid/match. It is
 * therefore authoritative and available for every deployment (Console, CLI or otherwise) without the
 * stored SDL manifest. The constants below mirror the provider's attestation-sidecar resource footprint
 * (akash-network/provider PR #396, `cluster/kube/builder`) so we can show the tenant how much of their
 * declared per-pod budget the provider-injected sidecar reserves.
 */

export type TeeType = "cpu" | "cpu-gpu";

/** On-chain group placement attribute key carrying the declared TEE type. */
export const TEE_TYPE_ATTRIBUTE_KEY = "tee/type";

/** Exact container name the provider injects (akash-network/provider, webhook/sidecar.go). */
export const ATTESTATION_SIDECAR_SERVICE_NAME = "akash-attestation-sidecar";

const MEGABYTES = 1024 * 1024;

/** Sidecar resource limits the provider subtracts from the primary container (PR #396 builder constants). */
export const SIDECAR_CPU_LIMIT_MILLICORES = 100;
export const SIDECAR_MEMORY_LIMIT_BYTES: Record<TeeType, number> = {
  cpu: 64 * MEGABYTES,
  "cpu-gpu": 128 * MEGABYTES
};

/** Floors the provider applies to the primary container after subtraction. */
export const MIN_PRIMARY_CPU_MILLICORES = 10;
export const MIN_PRIMARY_MEMORY_BYTES = 16 * MEGABYTES;

const TEE_TYPES: readonly TeeType[] = ["cpu", "cpu-gpu"];

function isTeeType(value: unknown): value is TeeType {
  return typeof value === "string" && (TEE_TYPES as readonly string[]).includes(value);
}

/** Parses an on-chain integer-valued string (millicores, bytes, gpu units). Returns undefined on garbage. */
function parseIntegerVal(value: unknown): number | undefined {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value !== "string") return undefined;
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/** Returns the TEE type declared on a group's on-chain placement requirements, or undefined when none/unknown. */
export function getGroupTeeType(group: DeploymentGroup | undefined | null): TeeType | undefined {
  const attributes = group?.group_spec?.requirements?.attributes;
  if (!Array.isArray(attributes)) return undefined;
  const value = attributes.find(attribute => attribute?.key === TEE_TYPE_ATTRIBUTE_KEY)?.value;
  return isTeeType(value) ? value : undefined;
}

/**
 * Returns the distinct set of TEE types declared across all of a deployment's groups, in canonical order.
 * Never throws — a missing or malformed group list yields an empty array so the deployment view stays intact.
 */
export function getDeclaredTeeTypes(groups: DeploymentGroup[] | undefined | null): TeeType[] {
  const declared = new Set<TeeType>();

  if (Array.isArray(groups)) {
    for (const group of groups) {
      const teeType = getGroupTeeType(group);
      if (teeType) declared.add(teeType);
    }
  }

  return TEE_TYPES.filter(type => declared.has(type));
}

/**
 * Replicates the provider's resource split: the sidecar's fixed limits are reserved, and the
 * primary container keeps the remainder floored at the provider minimums. The lease's declared
 * (billed) resources are unchanged — this only describes how a single pod's budget is divided.
 */
export function computeSidecarCarveout(input: { cpuMillicores: number; memoryBytes: number; teeType: TeeType }): {
  reserved: { cpu: number; memory: number };
  container: { cpu: number; memory: number };
} {
  const reservedCpu = SIDECAR_CPU_LIMIT_MILLICORES;
  const reservedMemory = SIDECAR_MEMORY_LIMIT_BYTES[input.teeType];

  return {
    reserved: { cpu: reservedCpu, memory: reservedMemory },
    container: {
      cpu: Math.max(input.cpuMillicores - reservedCpu, MIN_PRIMARY_CPU_MILLICORES),
      memory: Math.max(input.memoryBytes - reservedMemory, MIN_PRIMARY_MEMORY_BYTES)
    }
  };
}

export interface TeeResourceCarveout {
  /** On-chain resource unit id, used as a stable React key. */
  id: string;
  teeType: TeeType;
  /** Number of pods (replicas) using this resource unit; each pod gets its own attestation sidecar. */
  count: number;
  /** GPU units per pod, used to disambiguate units when a lease declares more than one. */
  gpuUnits: number;
  /** Per-pod declared (billed) resources. */
  requested: { cpu: number; memory: number };
  /** Per-pod resources reserved by the attestation sidecar. */
  reserved: { cpu: number; memory: number };
  /** Per-pod resources left to the primary container after the sidecar reservation. */
  container: { cpu: number; memory: number };
}

/**
 * Builds the per-pod resource carve-out for every resource unit in a TEE group. The `tee/type` attribute
 * is a group-level placement requirement, so the provider injects the attestation sidecar into every pod
 * of the group — each resource unit (and each of its `count` replicas) reserves the same sidecar footprint.
 * Returns an empty array when the group declares no TEE type. Resource units whose on-chain cpu/memory
 * cannot be parsed are skipped; never throws on malformed input.
 */
export function getTeeResourceCarveouts(group: DeploymentGroup | undefined | null): TeeResourceCarveout[] {
  const teeType = getGroupTeeType(group);
  const resources = group?.group_spec?.resources;
  if (!teeType || !Array.isArray(resources)) return [];

  const carveouts: TeeResourceCarveout[] = [];

  resources.forEach((entry, index) => {
    const cpuMillicores = parseIntegerVal(entry?.resource?.cpu?.units?.val);
    const memoryBytes = parseIntegerVal(entry?.resource?.memory?.quantity?.val);
    if (cpuMillicores === undefined || memoryBytes === undefined) return;

    const { reserved, container } = computeSidecarCarveout({ cpuMillicores, memoryBytes, teeType });
    carveouts.push({
      id: String(entry?.resource?.id ?? index),
      teeType,
      count: entry?.count ?? 1,
      gpuUnits: parseIntegerVal(entry?.resource?.gpu?.units?.val) ?? 0,
      requested: { cpu: cpuMillicores, memory: memoryBytes },
      reserved,
      container
    });
  });

  return carveouts;
}

interface LeaseStatusLike {
  services: Record<string, unknown>;
  forwarded_ports?: Record<string, unknown>;
  ips?: Record<string, unknown> | null;
}

/**
 * Strips the attestation sidecar from a lease status. Defensive: under the current provider design
 * the sidecar is a pod container and never appears as a lease-status service, so this is a passthrough
 * (returns the same reference) today. It guards against a future provider reporting it as a service.
 */
export function omitAttestationSidecar<T extends LeaseStatusLike>(leaseStatus: T): T {
  if (!leaseStatus) return leaseStatus;

  // Detect by key presence (not truthiness) so a sidecar entry with a falsy value is still stripped,
  // staying consistent with the `omit` helper below.
  const hasSidecar = (record: Record<string, unknown> | null | undefined): boolean => !!record && ATTESTATION_SIDECAR_SERVICE_NAME in record;
  const present = hasSidecar(leaseStatus.services) || hasSidecar(leaseStatus.forwarded_ports) || hasSidecar(leaseStatus.ips);

  if (!present) return leaseStatus;

  const omit = <V>(record: Record<string, V> | null | undefined): Record<string, V> | null | undefined => {
    if (!record || !(ATTESTATION_SIDECAR_SERVICE_NAME in record)) return record;
    const { [ATTESTATION_SIDECAR_SERVICE_NAME]: _omitted, ...rest } = record;
    return rest;
  };

  return {
    ...leaseStatus,
    services: omit(leaseStatus.services) as T["services"],
    forwarded_ports: omit(leaseStatus.forwarded_ports),
    ips: omit(leaseStatus.ips)
  };
}

/** Human-readable label for a TEE type (bare "cpu" reads oddly as a TEE indicator). */
export function formatTeeTypeLabel(teeType: TeeType): string {
  return teeType === "cpu-gpu" ? "CPU + GPU" : "CPU";
}
