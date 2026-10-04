import { generateManifest, type SDLInput, yaml } from "@akashnetwork/chain-sdk/web";

interface DeployedService {
  name: string;
  resources: Record<string, unknown>;
  expose?: { port: number; externalPort?: number; service?: string }[];
  env?: string[];
  [field: string]: unknown;
}

interface DeployedPlacement {
  name: string;
  services: DeployedService[];
}

interface DeployedPlacementSpec {
  name: string;
  requirements: unknown;
  resources: { price: unknown }[];
}

interface DeployedDeployment {
  groups: DeployedPlacement[];
  groupSpecs: DeployedPlacementSpec[];
  reclamation?: unknown;
}

const SERVICE_FIELD_DIFFERENCES: Record<string, string> = {
  image: "a different image",
  command: "a different command",
  args: "different arguments",
  env: "different environment variables",
  resources: "different resources",
  count: "a different replica count",
  expose: "different exposed ports",
  params: "different storage mounts or permissions",
  credentials: "different registry credentials",
  interconnectGroup: "a different GPU interconnect group"
};

const listFormat = new Intl.ListFormat("en", { style: "long", type: "conjunction" });

/** What deploying the regenerated SDL changes compared with the imported one, as one sentence per placement, service or setting; empty when both deploy alike. */
export function listSdlImportChanges(importedSdl: string, regeneratedSdl: string): string[] {
  const imported = deploymentOf(importedSdl);
  const regenerated = deploymentOf(regeneratedSdl);
  if (!imported || !regenerated) return [];

  return [...placementChanges(imported, regenerated), ...placementSpecChanges(imported, regenerated), ...reclamationChanges(imported, regenerated)];
}

function deploymentOf(sdl: string): DeployedDeployment | undefined {
  try {
    const result = generateManifest(yaml.raw<SDLInput>(sdl));
    return result.ok ? (canonical(JSON.parse(JSON.stringify(result.value, bigintsAsStrings))) as DeployedDeployment) : undefined;
  } catch {
    return undefined;
  }
}

function bigintsAsStrings(_key: string, value: unknown): unknown {
  return typeof value === "bigint" ? value.toString() : value;
}

/** Matches placements, services, volumes and attributes by name or key rather than position, and reads an empty list or object as absent, as the manifest's wire format does. */
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical).sort(byIdentity);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .map(([key, field]) => [key, canonical(field)])
      .filter(([, field]) => !isEmpty(field))
  );
}

function isEmpty(value: unknown): boolean {
  return !!value && typeof value === "object" && Object.keys(value).length === 0;
}

function byIdentity(left: unknown, right: unknown): number {
  return identityOf(left).localeCompare(identityOf(right));
}

function identityOf(value: unknown): string {
  const { name, key } = (value ?? {}) as { name?: unknown; key?: unknown };
  return String(name ?? key);
}

function placementChanges(imported: DeployedDeployment, regenerated: DeployedDeployment): string[] {
  const dropped = imported.groups
    .filter(placement => !findByName(regenerated.groups, placement.name))
    .map(placement => `Placement "${placement.name}" and the services it runs (${placement.services.map(service => service.name).join(", ")}) are left out.`);
  const added = regenerated.groups
    .filter(placement => !findByName(imported.groups, placement.name))
    .map(placement => `Placement "${placement.name}" is added.`);
  const changed = imported.groups.flatMap(placement => {
    const counterpart = findByName(regenerated.groups, placement.name);
    return counterpart ? serviceChanges(placement, counterpart) : [];
  });

  return [...dropped, ...added, ...changed];
}

function serviceChanges(imported: DeployedPlacement, regenerated: DeployedPlacement): string[] {
  const dropped = imported.services
    .filter(service => !findByName(regenerated.services, service.name))
    .map(service => `Service "${service.name}" is left out of placement "${imported.name}".`);
  const added = regenerated.services
    .filter(service => !findByName(imported.services, service.name))
    .map(service => `Service "${service.name}" is added to placement "${imported.name}".`);
  const changed = imported.services.flatMap(service => {
    const counterpart = findByName(regenerated.services, service.name);
    const differences = counterpart ? serviceDifferences(service, counterpart) : [];
    return differences.length > 0 ? [`Service "${service.name}" gets ${listFormat.format(differences)}.`] : [];
  });

  return [...dropped, ...added, ...changed];
}

function serviceDifferences(imported: DeployedService, regenerated: DeployedService): string[] {
  const left = comparableService(imported);
  const right = comparableService(regenerated);
  const fields = [...new Set([...Object.keys(SERVICE_FIELD_DIFFERENCES), ...Object.keys(left), ...Object.keys(right)])];

  return fields
    .filter(field => JSON.stringify(left[field]) !== JSON.stringify(right[field]))
    .map(field => SERVICE_FIELD_DIFFERENCES[field] ?? `a different ${field}`);
}

/** Providers ignore a resource id, the service an expose names and a repeated port, serve a port without `as` on itself and set a bare env name to empty. */
function comparableService(service: DeployedService): Record<string, unknown> {
  const { id: _resourceId, ...resources } = service.resources;
  const expose = [
    ...new Set((service.expose ?? []).map(({ service: _target, ...port }) => JSON.stringify({ ...port, externalPort: port.externalPort || port.port })))
  ].sort();
  const env = (service.env ?? []).map(variable => (variable.includes("=") ? variable : `${variable}=`));
  return { ...service, resources, expose, env };
}

function placementSpecChanges(imported: DeployedDeployment, regenerated: DeployedDeployment): string[] {
  return imported.groupSpecs.flatMap(spec => {
    const counterpart = findByName(regenerated.groupSpecs, spec.name);
    const differences = counterpart ? placementSpecDifferences(spec, counterpart) : [];
    return differences.length > 0 ? [`Placement "${spec.name}" gets ${listFormat.format(differences)}.`] : [];
  });
}

function placementSpecDifferences(imported: DeployedPlacementSpec, regenerated: DeployedPlacementSpec): string[] {
  return [
    ...(JSON.stringify(imported.requirements) === JSON.stringify(regenerated.requirements) ? [] : ["different provider requirements"]),
    ...(JSON.stringify(pricesOf(imported)) === JSON.stringify(pricesOf(regenerated)) ? [] : ["different pricing"])
  ];
}

function pricesOf(spec: DeployedPlacementSpec): string[] {
  return spec.resources.map(resource => JSON.stringify(resource.price)).sort();
}

function reclamationChanges(imported: DeployedDeployment, regenerated: DeployedDeployment): string[] {
  return JSON.stringify(imported.reclamation) === JSON.stringify(regenerated.reclamation) ? [] : ["The minimum reclamation window is different."];
}

function findByName<T extends { name: string }>(items: T[], name: string): T | undefined {
  return items.find(item => item.name === name);
}
