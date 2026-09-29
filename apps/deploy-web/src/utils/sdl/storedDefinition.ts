import yaml from "js-yaml";

import { isProtectedByDefault, SDL_REFERENCE_PATTERN } from "./sdlSecrets";

export function hasSdlReference(sdl: string): boolean {
  return carriesReference(parseSdl(sdl));
}

/** The api withholds a value by blanking its env entry, so an entry blank in its record names a value the browser has to be given back before it can sign. */
export function leavesWithheldEnvValuesBlank(sdl: string, apiRecord: string): boolean {
  const withheld = blankEnvValuesIn(parseSdl(apiRecord));
  return blankEnvValuesIn(parseSdl(sdl)).some(name => withheld.includes(name));
}

/** Whether a stored SDL still carries every value the browser needs to hash it into the manifest the chain committed. */
export function isStoredSdlSelfContained(sdl: string): boolean {
  const document = parseSdl(sdl);
  return document !== null && !carriesReference(document) && blankEnvValuesIn(document).length === 0;
}

/** Whether a stored SDL can seed Configure for a redeploy: references are fine there, only a value blanked away is lost. */
export function isStoredSdlRedeployable(sdl: string): boolean {
  const document = parseSdl(sdl);
  return document !== null && blankEnvValuesIn(document).length === 0;
}

export function hasEnvProtectedByDefault(sdl: string): boolean {
  return envEntriesIn(parseSdl(sdl)).some(({ entry }) => isProtectedByDefault(assignedValueOf(entry)));
}

/** Only env values the api sealed on its own come back, since registry credentials and secrets the user named stay secrets whatever this browser holds; undefined when none does. */
export function withEnvValuesFrom(browserSdl: string, apiSdl: string): string | undefined {
  const document = parseSdl(apiSdl);
  const browserValues = plainEnvValuesByService(parseSdl(browserSdl));
  let restoredCount = 0;

  Object.entries(servicesOf(document)).forEach(([service, definition]) => {
    const env = (definition as { env?: unknown } | null)?.env;
    if (!Array.isArray(env)) return;

    env.forEach((entry, index) => {
      if (typeof entry !== "string" || !isProtectedByDefault(assignedValueOf(entry))) return;

      const name = entry.slice(0, entry.indexOf("="));
      const value = browserValues.get(`${service}.${name}`);
      if (value === undefined) return;

      env[index] = `${name}=${value}`;
      restoredCount++;
    });
  });

  return restoredCount > 0 ? yaml.dump(document) : undefined;
}

function plainEnvValuesByService(document: unknown): Map<string, string> {
  return new Map(
    envEntriesIn(document)
      .filter(({ entry }) => entry.includes("=") && !SDL_REFERENCE_PATTERN.test(assignedValueOf(entry)))
      .map(({ service, entry }) => [`${service}.${entry.slice(0, entry.indexOf("="))}`, assignedValueOf(entry)])
  );
}

/** Named per service, because the same env name can be a withheld secret in one service and a value of the user's own in another. */
function blankEnvValuesIn(document: unknown): string[] {
  return envEntriesIn(document)
    .filter(({ entry }) => isBlank(entry))
    .map(({ service, entry }) => `${service}.${entry.slice(0, entry.indexOf("="))}`);
}

function parseSdl(sdl: string): unknown {
  try {
    return yaml.load(sdl) ?? null;
  } catch {
    return null;
  }
}

function carriesReference(document: unknown): boolean {
  return stringsIn(document).some(scalar => SDL_REFERENCE_PATTERN.test(scalar) || SDL_REFERENCE_PATTERN.test(assignedValueOf(scalar)));
}

/** An env entry is one `NAME=value` scalar, so a reference stands in the half after the separator. */
function assignedValueOf(scalar: string): string {
  const separatorAt = scalar.indexOf("=");
  return separatorAt === -1 ? scalar : scalar.slice(separatorAt + 1);
}

/** A bare `KEY` inherits from the host environment, so only an empty right-hand side names a value the document lacks. */
function isBlank(entry: string): boolean {
  const separatorAt = entry.indexOf("=");
  return separatorAt !== -1 && entry.slice(separatorAt + 1) === "";
}

function servicesOf(document: unknown): Record<string, unknown> {
  const services = (document as { services?: unknown } | null)?.services;
  return isRecord(services) ? services : {};
}

function envEntriesIn(document: unknown): { service: string; entry: string }[] {
  return Object.entries(servicesOf(document)).flatMap(([service, definition]) => {
    const env = (definition as { env?: unknown } | null)?.env;
    if (!Array.isArray(env)) return [];

    return env.filter((entry): entry is string => typeof entry === "string").map(entry => ({ service, entry }));
  });
}

function stringsIn(document: unknown): string[] {
  const found: string[] = [];
  const seen = new Set<object>();

  function visit(node: unknown): void {
    if (typeof node === "string") {
      found.push(node);
      return;
    }
    if (node === null || typeof node !== "object" || seen.has(node)) return;
    seen.add(node);
    Object.values(node).forEach(visit);
  }

  visit(document);
  return found;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
