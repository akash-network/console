import yaml from "js-yaml";
import get from "lodash/get";

import type { LeaseServiceStatus } from "@src/queries/useLeaseQuery";
import type { DeploymentGroup, LeaseDto } from "@src/types/deployment";
import { getGpusFromAttributes } from "@src/utils/deploymentUtils";
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
 * still render live lease data (status, endpoints) when the local manifest is missing.
 */
export function parseManifestServices(manifest: string | null | undefined): Record<string, ManifestServiceDetail> {
  const parsed = safeLoadYaml(manifest);
  const services = parsed?.services;
  if (!services || typeof services !== "object") return {};

  return Object.keys(services).reduce<Record<string, ManifestServiceDetail>>((all, name) => {
    const service = services[name] ?? {};
    all[name] = {
      image: typeof service.image === "string" ? service.image : undefined,
      resources: parseComputeResources(get(parsed, ["profiles", "compute", name, "resources"])),
      env: parseEnv(service.env),
      command: joinCommand(service.command, service.args)
    };
    return all;
  }, {});
}

export function getPlacementName(group: DeploymentGroup | undefined, index: number): string {
  const name = group?.group_spec?.name?.trim();
  return name || `placement-${index + 1}`;
}

/** Provider attribute keys that carry the region, most-specific first (providers use `region`; some use `location-region`). */
const REGION_ATTRIBUTE_KEYS = ["region", "location-region"];

/** The provider's region, read from its region attribute (the same value the configure marketplace shows); undefined when the provider hasn't declared one. */
export function getProviderRegion(provider: { attributes?: { key: string; value: string }[]; locationRegion?: string | null } | null | undefined): string | undefined {
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

/** Derives a user-facing status for a single service from its live replica counts and the owning lease state. */
export function getServiceStatus(service: Pick<LeaseServiceStatus, "available" | "total" | "ready_replicas"> | undefined, leaseState: LeaseDto["state"]): ServiceStatusView {
  if (leaseState === "closed") return { label: "Closed", tone: "closed" };
  if (service && service.available > 0) return { label: "Running", tone: "running" };
  return { label: "Starting", tone: "pending" };
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

interface ParsedManifest {
  services?: Record<string, { image?: unknown; env?: unknown; command?: unknown; args?: unknown }>;
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
