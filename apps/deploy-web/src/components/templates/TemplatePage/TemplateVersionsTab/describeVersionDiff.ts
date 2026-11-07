import yaml from "js-yaml";

export type VersionDiffEntry = { service: string; field: "image" | "env"; removed: string[]; added: string[] };

type ServiceLines = { image: string[]; env: string[] };

const FIELDS = ["image", "env"] as const;

export function describeVersionDiff(previousSdl: string | undefined, nextSdl: string): VersionDiffEntry[] {
  const previous = previousSdl === undefined ? new Map<string, ServiceLines>() : readServices(previousSdl);
  const next = readServices(nextSdl);
  if (!previous || !next) return [];

  const serviceNames = [...next.keys(), ...[...previous.keys()].filter(name => !next.has(name))];

  return serviceNames.flatMap(service =>
    FIELDS.flatMap(field => {
      const before = previous.get(service)?.[field] ?? [];
      const after = next.get(service)?.[field] ?? [];
      const removed = before.filter(line => !after.includes(line));
      const added = after.filter(line => !before.includes(line));
      return removed.length > 0 || added.length > 0 ? [{ service, field, removed, added }] : [];
    })
  );
}

function readServices(sdl: string): Map<string, ServiceLines> | undefined {
  let document: unknown;
  try {
    document = yaml.load(sdl);
  } catch {
    return undefined;
  }

  const services = isMapping(document) ? document.services : undefined;
  if (!isMapping(services)) return undefined;

  return new Map(
    Object.entries(services).map(([name, service]) => {
      const { image, env } = isMapping(service) ? service : ({} as Record<string, unknown>);
      return [name, { image: typeof image === "string" ? [image] : [], env: Array.isArray(env) ? env.map(String) : [] }];
    })
  );
}

function isMapping(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
