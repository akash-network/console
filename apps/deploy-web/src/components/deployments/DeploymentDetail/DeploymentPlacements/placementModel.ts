import yaml from "js-yaml";
import get from "lodash/get";

import type { LeaseServiceStatus } from "@src/queries/useLeaseQuery";
import type { DeploymentGroup, LeaseDto } from "@src/types/deployment";
import { getGpusFromAttributes } from "@src/utils/deploymentUtils";
import { isLeaseLive } from "@src/utils/leaseUtils";
import { parseSvcCommand } from "@src/utils/sdl/sdlImport";

export interface ResourceSize {
  value: number;
  unit: string;
}

export interface ManifestServiceResources {
  cpu?: number;
  gpuUnits: number;
  memory?: ResourceSize;
  storage?: ResourceSize;
}

export interface ManifestEnvVar {
  key: string;
  value?: string;
}

export interface ManifestServiceDetail {
  image?: string;
  resources?: ManifestServiceResources;
  env?: ManifestEnvVar[];
  command?: string;
}

/**
 * Parses a deployment SDL manifest into per-service image + resources. Unlike the SDL-builder
 * importer, this tolerates an absent or malformed manifest by returning {} so the Details tab can
 * still render live lease data (status, endpoints) when the local manifest is missing. The accumulator
 * is null-prototyped because SDL service names are user-supplied: a service named "__proto__" must add
 * an own entry rather than reassign the prototype and drop out of Object.keys.
 */
export function parseManifestServices(manifest: string | null | undefined): Record<string, ManifestServiceDetail> {
  const parsed = safeLoadYaml(manifest);
  const services = parsed?.services;
  if (!services || typeof services !== "object") return {};

  return Object.keys(services).reduce<Record<string, ManifestServiceDetail>>((all, name) => {
    all[name] = buildServiceDetail(parsed, services[name] ?? {}, resolveComputeProfileName(parsed, name));
    return all;
  }, Object.create(null));
}

/**
 * Per-service detail resolved for a specific placement: image/env/command come from the top-level
 * `services:` block (placement-independent), resources from the compute profile that service uses in
 * that placement (`deployment.<service>.<placement>.profile`), falling back to the service name.
 */
function buildServiceDetail(parsed: ParsedManifest | undefined, service: ManifestServiceSource, profileName: string): ManifestServiceDetail {
  return {
    image: typeof service.image === "string" ? service.image : undefined,
    resources: parseComputeResources(get(parsed, ["profiles", "compute", profileName, "resources"])),
    env: parseEnv(service.env),
    command: joinCommand(service.command, service.args)
  };
}

/**
 * The compute-profile name a service points at via `deployment.<service>.<placement>.profile`. SDL does
 * not require the profile to share the service's name (profiles can be renamed or shared across services),
 * so we resolve the pointer before indexing `profiles.compute`, falling back to the service name. Used for
 * the deployment-wide fallback map; `parseServicesByPlacement` resolves the profile per placement instead.
 */
function resolveComputeProfileName(parsed: ParsedManifest | undefined, serviceName: string): string {
  const placements = parsed?.deployment?.[serviceName];
  if (placements && typeof placements === "object") {
    for (const placement of Object.values(placements)) {
      if (isNonEmptyString(placement?.profile)) return placement.profile;
    }
  }
  return serviceName;
}

/**
 * Maps each SDL placement name to its services and their detail, read from the manifest's `deployment:`
 * block. A card renders its own placement's slice, so a service deployed to several placements shows the
 * resources of the profile it uses in each one, and the fallback service list stays scoped to the group.
 * The map is null-prototyped because SDL placement names are user-supplied: a placement called
 * "constructor" or "__proto__" must not collide with Object.prototype members and throw while rendering.
 */
export function parseServicesByPlacement(manifest: string | null | undefined): Record<string, Record<string, ManifestServiceDetail>> {
  const parsed = safeLoadYaml(manifest);
  const services = parsed?.services;
  const deployment = parsed?.deployment;
  const byPlacement: Record<string, Record<string, ManifestServiceDetail>> = Object.create(null);
  if (!services || typeof services !== "object" || !deployment || typeof deployment !== "object") return byPlacement;

  for (const serviceName of Object.keys(services)) {
    const placements = deployment[serviceName];
    if (!placements || typeof placements !== "object") continue;

    for (const [placementName, placement] of Object.entries(placements)) {
      const profileName = isNonEmptyString(placement?.profile) ? placement.profile : serviceName;
      (byPlacement[placementName] ??= Object.create(null))[serviceName] = buildServiceDetail(parsed, services[serviceName] ?? {}, profileName);
    }
  }
  return byPlacement;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Distinct services rendered across a deployment's placements: a placement's own manifest slice when the
 * SDL declares one, else the deployment-wide service list. The header summary and the Placements section
 * share it so the same page can't show two different service totals. Falls back to the lease count when
 * the local manifest is missing, since each placement still renders at least one service row.
 */
export function countPlacementServices(
  leases: LeaseDto[],
  servicesByPlacement: Record<string, Record<string, ManifestServiceDetail>>,
  manifestServices: Record<string, ManifestServiceDetail>
): number {
  const serviceNames = new Set(leases.flatMap((lease, index) => Object.keys(servicesByPlacement[getPlacementName(lease.group, index)] ?? manifestServices)));
  return serviceNames.size || leases.length;
}

export function getPlacementName(group: DeploymentGroup | undefined, index: number): string {
  const name = group?.group_spec?.name?.trim();
  return name || `placement-${index + 1}`;
}

/** Provider attribute keys that carry the region, most-specific first (providers use `region`; some use `location-region`). */
const REGION_ATTRIBUTE_KEYS = ["region", "location-region"];

/** The provider's region, read from its region attribute (the same value the configure marketplace shows); undefined when the provider hasn't declared one. */
export function getProviderRegion(
  provider: { attributes?: { key: string; value: string }[]; locationRegion?: string | null } | null | undefined
): string | undefined {
  const fromAttribute = provider?.attributes?.find(attribute => REGION_ATTRIBUTE_KEYS.includes(attribute.key) && attribute.value?.trim())?.value?.trim();
  return fromAttribute || provider?.locationRegion?.trim() || undefined;
}

export function getPlacementGpuModels(group: DeploymentGroup | undefined): string[] {
  const models = (group?.group_spec?.resources ?? []).flatMap(resource => getGpusFromAttributes(resource.resource.gpu?.attributes ?? []).map(gpu => gpu.model));
  return Array.from(new Set(models.filter(Boolean)));
}

export type ServiceStatusTone = "running" | "pending" | "closed";

export interface ServiceStatusView {
  label: string;
  tone: ServiceStatusTone;
}

/**
 * Derives a user-facing status for a single service from its live replica counts and the owning lease
 * state. Any lease that is not live — closed, out of funds, or provider-reclaimed even while its `state`
 * still reads "active" — is terminal, so the row stays in sync with the ReclamationCard banner above it
 * and an escrow-drained lease shows "Closed" instead of spinning on "Starting" forever.
 */
export function getServiceStatus(
  service: Pick<LeaseServiceStatus, "available" | "total" | "ready_replicas"> | undefined,
  leaseState: LeaseDto["state"],
  isReclaimed = false
): ServiceStatusView {
  if (!isLeaseLive({ state: leaseState }) || isReclaimed) return { label: "Closed", tone: "closed" };
  if (service && service.available > 0) return { label: "Running", tone: "running" };
  return { label: "Starting", tone: "pending" };
}

/** `{available}/{total} replicas` for the collapsed service row; omitted until lease status has arrived. */
export function formatReplicaCount(service: Pick<LeaseServiceStatus, "available" | "total"> | undefined): string | undefined {
  if (!service || typeof service.available !== "number" || typeof service.total !== "number") return undefined;
  return `${service.available}/${service.total} replicas`;
}

function parseComputeResources(resources: unknown): ManifestServiceResources | undefined {
  if (!resources || typeof resources !== "object") return undefined;

  const source = resources as { cpu?: { units?: unknown }; gpu?: { units?: unknown }; memory?: { size?: unknown }; storage?: unknown };
  const firstStorage = Array.isArray(source.storage) ? source.storage[0] : source.storage;

  return {
    cpu: toNumber((source.cpu ?? {}).units),
    gpuUnits: toNumber((source.gpu ?? {}).units) ?? 0,
    memory: parseSize((source.memory ?? {}).size),
    storage: parseSize((firstStorage as { size?: unknown } | undefined)?.size)
  };
}

function parseEnv(env: unknown): ManifestEnvVar[] {
  if (!Array.isArray(env)) return [];

  return env
    .filter((entry): entry is string => typeof entry === "string")
    .map(entry => {
      const separatorIndex = entry.indexOf("=");
      return separatorIndex === -1 ? { key: entry } : { key: entry.slice(0, separatorIndex), value: entry.slice(separatorIndex + 1) };
    });
}

/** Joins a service's command and args into a single inline string, reusing the SDL importer's YAML-safe tokenizer. */
function joinCommand(command: unknown, args: unknown): string | undefined {
  const joined = [command, args].map(toCommandString).filter(Boolean).join(" ").trim();
  return joined || undefined;
}

function toCommandString(value: unknown): string {
  if (typeof value !== "string" && !Array.isArray(value)) return "";
  return parseSvcCommand(value as string | (string | number | boolean)[]).replace(/\n/g, " ");
}

function parseSize(size: unknown): ResourceSize | undefined {
  if (typeof size === "number") return { value: size, unit: "" };
  if (typeof size !== "string") return undefined;

  const value = parseFloat(size);
  if (Number.isNaN(value)) return undefined;

  const unit = size.match(/[a-zA-Z]+/)?.[0] ?? "";
  return { value, unit };
}

function toNumber(value: unknown): number | undefined {
  const parsed = typeof value === "number" ? value : parseFloat(String(value));
  return Number.isNaN(parsed) ? undefined : parsed;
}

interface ManifestServiceSource {
  image?: unknown;
  env?: unknown;
  command?: unknown;
  args?: unknown;
}

interface ParsedManifest {
  services?: Record<string, ManifestServiceSource>;
  deployment?: Record<string, Record<string, { profile?: unknown } | undefined> | undefined>;
}

function safeLoadYaml(manifest: string | null | undefined): ParsedManifest | undefined {
  if (!manifest) return undefined;
  try {
    const parsed = yaml.load(manifest);
    return parsed && typeof parsed === "object" ? (parsed as ParsedManifest) : undefined;
  } catch {
    return undefined;
  }
}
