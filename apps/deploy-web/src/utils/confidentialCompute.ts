import yaml from "js-yaml";

import { parseSizeStr } from "./deploymentData/helpers";

/**
 * Confidential Compute (TEE) helpers for the deployment detail view.
 *
 * The declared TEE type lives only in the off-chain SDL manifest the user stored locally
 * (`services.<name>.params.tee`); it is not projected on-chain. The constants below mirror the
 * provider's attestation-sidecar resource footprint (akash-network/provider PR #396,
 * `cluster/kube/builder`) so we can show the tenant how much of their declared budget the
 * provider-injected sidecar reserves.
 */

export type TeeType = "cpu" | "cpu-gpu";

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Returns the distinct set of TEE types declared across all services, in canonical order.
 * Never throws — a malformed manifest yields an empty array so the deployment view stays intact.
 */
export function getDeclaredTeeTypes(parsedManifest: unknown): TeeType[] {
  const declared = new Set<TeeType>();

  if (isRecord(parsedManifest) && isRecord(parsedManifest.services)) {
    for (const service of Object.values(parsedManifest.services)) {
      const tee = isRecord(service) && isRecord(service.params) ? service.params.tee : undefined;
      if (isTeeType(tee)) declared.add(tee);
    }
  }

  return TEE_TYPES.filter(type => declared.has(type));
}

/**
 * Parses a stored SDL manifest (YAML string) and returns its declared TEE types. Never throws —
 * malformed YAML yields an empty array, keeping the deployment view safe (the feature has no flag).
 */
export function getDeclaredTeeTypesFromYaml(manifestYaml: string | null | undefined): TeeType[] {
  if (!manifestYaml) return [];
  try {
    return getDeclaredTeeTypes(yaml.load(manifestYaml));
  } catch {
    return [];
  }
}

/** Returns the TEE type declared by a single service, or undefined when none/unknown. */
export function getServiceTeeType(parsedManifest: unknown, serviceName: string): TeeType | undefined {
  if (!isRecord(parsedManifest) || !isRecord(parsedManifest.services)) return undefined;
  const service = parsedManifest.services[serviceName];
  const tee = isRecord(service) && isRecord(service.params) ? service.params.tee : undefined;
  return isTeeType(tee) ? tee : undefined;
}

function parseCpuToMillicores(units: unknown): number | undefined {
  if (typeof units === "number" && Number.isFinite(units)) return units * 1000;
  if (typeof units === "string") {
    const trimmed = units.trim();
    if (trimmed.endsWith("m")) {
      const millis = parseFloat(trimmed.slice(0, -1));
      return Number.isFinite(millis) ? millis : undefined;
    }
    const cores = parseFloat(trimmed);
    return Number.isFinite(cores) ? cores * 1000 : undefined;
  }
  return undefined;
}

/**
 * Resolves a service's per-container compute resources from its compute profile
 * (service name == compute-profile name, the console convention). Returns undefined when the
 * profile or resources cannot be resolved.
 */
export function getServiceComputeResources(parsedManifest: unknown, serviceName: string): { cpuMillicores: number; memoryBytes: number } | undefined {
  if (!isRecord(parsedManifest) || !isRecord(parsedManifest.profiles) || !isRecord(parsedManifest.profiles.compute)) return undefined;

  const profile = parsedManifest.profiles.compute[serviceName];
  const resources = isRecord(profile) ? profile.resources : undefined;
  if (!isRecord(resources) || !isRecord(resources.cpu) || !isRecord(resources.memory)) return undefined;

  const cpuMillicores = parseCpuToMillicores(resources.cpu.units);
  if (cpuMillicores === undefined) return undefined;

  // memory.size is normally a suffixed string ("256Mi"), but a hand-written SDL may use a raw byte
  // count as a YAML number — accept both, mirroring how cpu.units accepts numbers and strings.
  const memorySize = resources.memory.size;
  let memoryBytes: number;
  if (typeof memorySize === "string") {
    memoryBytes = Number(parseSizeStr(memorySize));
  } else if (typeof memorySize === "number") {
    memoryBytes = memorySize;
  } else {
    return undefined;
  }
  if (!Number.isFinite(memoryBytes)) return undefined;

  return { cpuMillicores, memoryBytes };
}

/**
 * Replicates the provider's resource split: the sidecar's fixed limits are reserved, and the
 * primary container keeps the remainder floored at the provider minimums. The lease's declared
 * (billed) resources are unchanged — this only describes how the pod's budget is divided.
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

export interface TeeServiceCarveout {
  serviceName: string;
  teeType: TeeType;
  requested: { cpu: number; memory: number };
  reserved: { cpu: number; memory: number };
  container: { cpu: number; memory: number };
}

/**
 * Builds the per-service resource carve-out for every TEE service in the manifest whose compute
 * resources can be resolved, sorted by service name. Services without a TEE type or with
 * unresolvable resources are omitted. Never throws on malformed input.
 *
 * Note: this gates on resolvable resources, while the header badge gates only on a declared
 * `params.tee` ({@link getDeclaredTeeTypes}). So a TEE service with an unresolvable compute profile
 * (e.g. a non-standard manifest) shows the badge but no carve-out row — an accepted divergence,
 * since console-generated SDLs always use the service-name == profile-name convention.
 */
export function getTeeServiceCarveouts(parsedManifest: unknown): TeeServiceCarveout[] {
  if (!isRecord(parsedManifest) || !isRecord(parsedManifest.services)) return [];

  const carveouts: TeeServiceCarveout[] = [];

  for (const serviceName of Object.keys(parsedManifest.services).sort()) {
    const teeType = getServiceTeeType(parsedManifest, serviceName);
    if (!teeType) continue;

    const resources = getServiceComputeResources(parsedManifest, serviceName);
    if (!resources) continue;

    const { reserved, container } = computeSidecarCarveout({ cpuMillicores: resources.cpuMillicores, memoryBytes: resources.memoryBytes, teeType });
    carveouts.push({
      serviceName,
      teeType,
      requested: { cpu: resources.cpuMillicores, memory: resources.memoryBytes },
      reserved,
      container
    });
  }

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
