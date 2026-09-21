import yaml from "js-yaml";

/** Private registry credentials as the api's patch takes them, whole or cleared. */
export interface ServiceCredentialsPatch {
  host: string;
  username: string;
  password: string;
}

/** The manifest-only fields of one service the api accepts as a partial update, keyed as its patch route spells them. */
export interface ServicePatch {
  image?: string;
  command?: string[] | null;
  args?: string[] | null;
  /** Keyed by variable name; null removes the variable. */
  env?: Record<string, string | null>;
  credentials?: ServiceCredentialsPatch | null;
}

/** Keyed by service name; only services with a difference appear. */
export type ServicesPatch = Record<string, ServicePatch>;

interface SdlService {
  image?: unknown;
  command?: unknown;
  args?: unknown;
  env?: unknown;
  credentials?: unknown;
}

/** A service present on only one side is a structural change the patch route does not take, so it is left out. */
export function servicesPatchBetween(previousSdl: string, nextSdl: string): ServicesPatch {
  const previousServices = servicesOf(previousSdl);
  const nextServices = servicesOf(nextSdl);
  const patch: ServicesPatch = {};

  Object.entries(nextServices).forEach(([name, next]) => {
    const previous = previousServices[name];
    if (!previous) return;

    const servicePatch = servicePatchBetween(previous, next);
    if (Object.keys(servicePatch).length > 0) patch[name] = servicePatch;
  });

  return patch;
}

export function isEmptyServicesPatch(patch: ServicesPatch): boolean {
  return Object.keys(patch).length === 0;
}

function servicePatchBetween(previous: SdlService, next: SdlService): ServicePatch {
  const patch: ServicePatch = {};

  if (typeof next.image === "string" && next.image !== previous.image) patch.image = next.image;

  const command = tokensPatchBetween(previous.command, next.command);
  if (command !== undefined) patch.command = command;

  const args = tokensPatchBetween(previous.args, next.args);
  if (args !== undefined) patch.args = args;

  const env = envPatchBetween(envEntriesOf(previous.env), envEntriesOf(next.env));
  if (Object.keys(env).length > 0) patch.env = env;

  const credentials = credentialsPatchBetween(previous.credentials, next.credentials);
  if (credentials !== undefined) patch.credentials = credentials;

  return patch;
}

/** `undefined` means unchanged; `null` means the list was removed. */
function tokensPatchBetween(previous: unknown, next: unknown): string[] | null | undefined {
  const previousTokens = tokensOf(previous);
  const nextTokens = tokensOf(next);
  if (JSON.stringify(previousTokens) === JSON.stringify(nextTokens)) return undefined;

  return nextTokens ?? null;
}

function tokensOf(value: unknown): string[] | undefined {
  return Array.isArray(value) ? value.map(String) : undefined;
}

function envPatchBetween(previous: Map<string, string>, next: Map<string, string>): Record<string, string | null> {
  const env: Record<string, string | null> = {};

  next.forEach((value, key) => {
    if (previous.get(key) !== value) env[key] = value;
  });
  previous.forEach((_value, key) => {
    if (!next.has(key)) env[key] = null;
  });

  return env;
}

/** A bare `KEY` inherits from the host environment and has no value the patch route could carry, so it is left alone. */
function envEntriesOf(env: unknown): Map<string, string> {
  const entries = new Map<string, string>();
  if (!Array.isArray(env)) return entries;

  env.forEach(entry => {
    if (typeof entry !== "string") return;
    const separatorAt = entry.indexOf("=");
    if (separatorAt === -1) return;
    entries.set(entry.slice(0, separatorAt), entry.slice(separatorAt + 1));
  });

  return entries;
}

function credentialsPatchBetween(previous: unknown, next: unknown): ServiceCredentialsPatch | null | undefined {
  const previousCredentials = credentialsOf(previous);
  const nextCredentials = credentialsOf(next);
  if (JSON.stringify(previousCredentials) === JSON.stringify(nextCredentials)) return undefined;

  return nextCredentials ?? null;
}

function credentialsOf(value: unknown): ServiceCredentialsPatch | undefined {
  if (!value || typeof value !== "object") return undefined;
  const { host, username, password } = value as Record<string, unknown>;

  return { host: String(host ?? ""), username: String(username ?? ""), password: String(password ?? "") };
}

function servicesOf(sdl: string): Record<string, SdlService> {
  try {
    const document = yaml.load(sdl) as { services?: unknown } | null;
    const services = document?.services;
    return services && typeof services === "object" && !Array.isArray(services) ? (services as Record<string, SdlService>) : {};
  } catch {
    return {};
  }
}
