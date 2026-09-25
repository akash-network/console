import yaml from "js-yaml";

import type { SdlSecretValues } from "./sdlSecrets";
import {
  isSdlReference,
  mintSecretName,
  REGISTRY_PASSWORD_SECRET_NAME,
  REGISTRY_USERNAME_SECRET_NAME,
  secretNameOf,
  secretReferenceNamesIn,
  secretReferenceOf
} from "./sdlSecrets";

export interface ImportableVariable {
  key: string;
  /** The name of the reference the sdl carries instead of a value, which the console needs a value for before it can record it. */
  referenceName: string | null;
}

export interface ImportableService {
  name: string;
  image: string | undefined;
  variables: ImportableVariable[];
  hasCredentials: boolean;
}

export interface RecordableDefinitionChoices {
  /** Keyed by `secretVariableKey`. */
  secretVariables: ReadonlySet<string>;
  /** Values for the references the sdl already carries, keyed by the name each carries. */
  referenceValues: Readonly<Record<string, string>>;
}

export interface RecordableDefinition {
  sdl: string;
  secrets: SdlSecretValues;
}

interface SdlService {
  image?: unknown;
  env?: unknown;
  credentials?: unknown;
}

const CREDENTIAL_FIELDS = [
  { field: "username", preferredName: REGISTRY_USERNAME_SECRET_NAME },
  { field: "password", preferredName: REGISTRY_PASSWORD_SECRET_NAME }
] as const;

const SECRET_LOOKING_NAME = /(PASSWORD|PASSWD|SECRET|TOKEN|API[_-]?KEY|PRIVATE[_-]?KEY|ACCESS[_-]?KEY|CREDENTIAL)/i;

export function secretVariableKey(service: string, key: string): string {
  return `${service}/${key}`;
}

/** A bare `KEY` inherits its value from the host, so only an entry that assigns one is listed. */
export function importableServicesOf(sdl: string): ImportableService[] {
  return Object.entries(servicesOf(parse(sdl))).map(([name, service]) => ({
    name,
    image: typeof service.image === "string" ? service.image : undefined,
    variables: uniqueByKey(assignmentsOf(service.env).map(({ key, value }) => ({ key, referenceName: secretNameOf(value) }))),
    hasCredentials: CREDENTIAL_FIELDS.some(({ field }) => typeof credentialsOf(service)?.[field] === "string")
  }));
}

export function suggestedSecretVariablesOf(services: ImportableService[]): Set<string> {
  return new Set(
    services.flatMap(service =>
      service.variables
        .filter(variable => variable.referenceName === null && SECRET_LOOKING_NAME.test(variable.key))
        .map(variable => secretVariableKey(service.name, variable.key))
    )
  );
}

/**
 * Rewrites only the values it seals, in place, so the document still resolves to the manifest the deployment runs and a
 * node two services share through an anchor is sealed once for both.
 */
export function recordableDefinitionOf(sdl: string, choices: RecordableDefinitionChoices): RecordableDefinition {
  const document = parse(sdl);
  const taken = secretReferenceNamesIn(sdl);
  const secrets: SdlSecretValues = {};
  const referenceTo = (preferredName: string, value: string) => {
    const name = mintSecretName(preferredName, taken);
    secrets[name] = value;
    return secretReferenceOf(name);
  };
  let isRewritten = false;

  Object.entries(servicesOf(document)).forEach(([serviceName, service]) => {
    const env = Array.isArray(service.env) ? service.env : [];
    env.forEach((entry, index) => {
      const assignment = assignmentOf(entry);
      if (!assignment || !assignment.value || isSdlReference(assignment.value)) return;
      if (!choices.secretVariables.has(secretVariableKey(serviceName, assignment.key))) return;

      env[index] = `${assignment.key}=${referenceTo(secretNameFor(assignment.key), assignment.value)}`;
      isRewritten = true;
    });

    const credentials = credentialsOf(service);
    CREDENTIAL_FIELDS.forEach(({ field, preferredName }) => {
      const value = credentials?.[field];
      if (!credentials || typeof value !== "string" || !value || isSdlReference(value)) return;

      credentials[field] = referenceTo(preferredName, value);
      isRewritten = true;
    });
  });

  taken.forEach(name => {
    const value = choices.referenceValues[name];
    if (value && !Object.hasOwn(secrets, name)) secrets[name] = value;
  });

  return { sdl: isRewritten ? yaml.dump(document, { lineWidth: -1 }) : sdl, secrets };
}

/** A secret name is stricter than a variable name, so the characters only a variable may spell become underscores. */
function secretNameFor(key: string): string {
  const name = key.replace(/[^A-Za-z0-9_]/g, "_");
  return /^[0-9]/.test(name) ? `_${name}` : name;
}

function parse(sdl: string): unknown {
  try {
    return yaml.load(sdl);
  } catch {
    return null;
  }
}

function servicesOf(document: unknown): Record<string, SdlService> {
  const services = (document as { services?: unknown } | null)?.services;
  if (!isRecord(services)) return {};

  return Object.fromEntries(Object.entries(services).filter(([, service]) => isRecord(service))) as Record<string, SdlService>;
}

function credentialsOf(service: SdlService): Record<string, unknown> | undefined {
  return isRecord(service.credentials) ? service.credentials : undefined;
}

function assignmentsOf(env: unknown): Array<{ key: string; value: string }> {
  if (!Array.isArray(env)) return [];

  return env.map(assignmentOf).filter((assignment): assignment is { key: string; value: string } => assignment !== null);
}

function assignmentOf(entry: unknown): { key: string; value: string } | null {
  if (typeof entry !== "string") return null;
  const separatorAt = entry.indexOf("=");

  return separatorAt === -1 ? null : { key: entry.slice(0, separatorAt), value: entry.slice(separatorAt + 1) };
}

function uniqueByKey(variables: ImportableVariable[]): ImportableVariable[] {
  return variables.filter((variable, index) => variables.findIndex(candidate => candidate.key === variable.key) === index);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
