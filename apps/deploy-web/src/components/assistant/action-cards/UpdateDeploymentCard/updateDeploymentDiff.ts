import type { AssistantActionOf } from "@src/types/assistant";

type ServiceUpdate = AssistantActionOf<"update_deployment">["services"][number];
type ServiceSnapshot = ServiceUpdate["before"];
type ServicePatch = ServiceUpdate["patch"];
type ExposePatch = NonNullable<ServicePatch["expose"]>[string];

export interface UpdateDeploymentDiff {
  removed: string[];
  added: string[];
  unchanged?: string;
  newDomains: string[];
  /** A change to the container spec rolls the pods once; ports exposed elsewhere, domains and http options only touch routing. */
  restartsContainer: boolean;
}

interface Lines {
  removed: string[];
  added: string[];
}

/** Env values the deployment already holds are never in the action, so a changed variable shows only its new value. */
export function updateDeploymentDiff(services: ServiceUpdate[]): UpdateDeploymentDiff {
  const prefixes = services.length > 1;
  const diff: UpdateDeploymentDiff = { removed: [], added: [], newDomains: [], restartsContainer: false };
  const unchanged: string[] = [];

  services.forEach(({ service, before, patch }) => {
    const lines: Lines = { removed: [], added: [] };
    const prefix = prefixes ? `${service}: ` : "";

    if (patch.image !== undefined) change(lines, `image: ${before.image ?? "none"}`, `image: ${patch.image}`);
    if (patch.command !== undefined) change(lines, `command: ${listOf(before.command)}`, `command: ${listOf(patch.command)}`);
    if (patch.args !== undefined) change(lines, `args: ${listOf(before.args)}`, `args: ${listOf(patch.args)}`);
    envLines(lines, before, patch.env ?? {});
    Object.entries(patch.expose ?? {}).forEach(([port, expose]) => {
      exposeLines(lines, before, Number(port), expose);
      diff.newDomains.push(...(expose.accept ?? []).filter(domain => !acceptedOn(before, Number(port)).includes(domain)));
    });
    Object.entries(patch.storage ?? {}).forEach(([volume, storage]) => {
      const current = before.storage.find(entry => entry.volume === volume);
      if (storage.mount !== undefined) change(lines, `${volume} mount: ${current?.mount ?? "none"}`, `${volume} mount: ${storage.mount}`);
      if (storage.readOnly !== undefined) change(lines, `${volume} read-only: ${current?.readOnly ?? false}`, `${volume} read-only: ${storage.readOnly}`);
    });

    diff.removed.push(...lines.removed.map(line => `${prefix}${line}`));
    diff.added.push(...lines.added.map(line => `${prefix}${line}`));
    diff.restartsContainer ||= restartsContainer(patch);

    const untouchedKeys = before.envKeys.filter(key => !(key in (patch.env ?? {})));
    if (untouchedKeys.length > 0) unchanged.push(`${prefix}${untouchedKeys.join(", ")} unchanged`);
  });

  return unchanged.length > 0 ? { ...diff, unchanged: unchanged.join("; ") } : diff;
}

function change(lines: Lines, removed: string, added: string) {
  lines.removed.push(removed);
  lines.added.push(added);
}

function listOf(values: string[] | null): string {
  return values === null ? "image default" : JSON.stringify(values);
}

function envLines(lines: Lines, before: ServiceSnapshot, env: Record<string, string | null>) {
  Object.entries(env).forEach(([key, value]) => {
    const isDeclared = before.envKeys.includes(key);
    if (isDeclared) lines.removed.push(value === null ? key : `${key} (current value)`);
    if (value !== null) lines.added.push(`${key}=${value}`);
  });
}

function exposeLines(lines: Lines, before: ServiceSnapshot, port: number, expose: ExposePatch) {
  const current = before.expose.find(entry => entry.port === port);
  if (expose.port !== undefined) change(lines, `port ${port}`, `port ${expose.port}`);
  if (expose.as !== undefined) change(lines, `port ${port} exposed as ${current?.as ?? port}`, `port ${port} exposed as ${expose.as}`);
  if (expose.accept !== undefined)
    change(lines, `port ${port} domains: ${domainsOf(current?.accept ?? [])}`, `port ${port} domains: ${domainsOf(expose.accept)}`);
  Object.entries(expose.httpOptions ?? {}).forEach(([option, value]) => {
    lines.added.push(`port ${port} ${option}: ${Array.isArray(value) ? value.join(", ") : value}`);
  });
}

function acceptedOn(before: ServiceSnapshot, port: number): string[] {
  return before.expose.find(entry => entry.port === port)?.accept ?? [];
}

function domainsOf(domains: string[]): string {
  return domains.length > 0 ? domains.join(", ") : "none";
}

function restartsContainer(patch: ServicePatch): boolean {
  return (
    patch.image !== undefined ||
    patch.command !== undefined ||
    patch.args !== undefined ||
    Object.keys(patch.env ?? {}).length > 0 ||
    Object.keys(patch.storage ?? {}).length > 0 ||
    Object.values(patch.expose ?? {}).some(expose => expose.port !== undefined)
  );
}
