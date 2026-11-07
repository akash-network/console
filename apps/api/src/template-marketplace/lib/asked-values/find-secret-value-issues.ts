import { yaml } from "@akashnetwork/chain-sdk";

import { isSdlReference, readEnvDeclaration } from "@src/deployment/services/sdl-reference/sdl-reference.service";
import { exceedsSubmittableLength, EXPANDED_SDL_TOO_LARGE_MESSAGE } from "@src/deployment/utils/sdl-for-storage/sdl-for-storage";
import type { AskedValue } from "./asked-values.schema";

const SECRET_REFERENCE_PREFIX = "ac-secret://";

type Mapping = Record<string, unknown>;

export function findSecretValueIssues(sdl: string, askedValues: AskedValue[]): string[] {
  const services = readServices(sdl);
  if (services === undefined) return [];
  if (services === "too-large") return [EXPANDED_SDL_TOO_LARGE_MESSAGE];

  const secretBindings = indexSecretBindings(askedValues);
  const issues: string[] = [];

  for (const [serviceName, service] of Object.entries(services)) {
    if (!isMapping(service)) continue;

    for (const [envName, value] of readEnvEntries(service)) {
      const key = secretBindings.get(serviceName)?.get(envName);

      if (key !== undefined && value !== "" && !isSecretReference(value)) {
        issues.push(`Variable "${key}" is a secret, so ${serviceName}.env.${envName} must not carry a value`);
      }
      if (key === undefined && isSdlReference(value)) {
        issues.push(`${serviceName}.env.${envName} references a secret that no variable asks the deployer for`);
      }
    }

    const password = isMapping(service.credentials) ? service.credentials.password : undefined;
    if (typeof password === "string" && !isSdlReference(password)) {
      issues.push(`Service "${serviceName}" carries a registry password; save it as a secret instead`);
    }
  }

  return issues;
}

function readServices(sdl: string): Mapping | "too-large" | undefined {
  let document: unknown;
  try {
    document = yaml.raw(sdl);
  } catch {
    return undefined;
  }

  if (!isMapping(document)) return undefined;
  if (exceedsSubmittableLength(sdl, document)) return "too-large";

  return isMapping(document.services) ? document.services : undefined;
}

function indexSecretBindings(askedValues: AskedValue[]): Map<string, Map<string, string>> {
  const index = new Map<string, Map<string, string>>();

  for (const askedValue of askedValues) {
    if (askedValue.type !== "secret") continue;

    for (const { service, env } of askedValue.bindings) {
      const envNames = index.get(service) ?? new Map<string, string>();
      envNames.set(env, askedValue.key);
      index.set(service, envNames);
    }
  }

  return index;
}

function readEnvEntries(service: Mapping): Array<[string, string]> {
  if (!Array.isArray(service.env)) return [];

  return service.env.flatMap((entry): Array<[string, string]> => {
    if (typeof entry !== "string") return [];

    const declaration = readEnvDeclaration(entry);
    return [declaration ? [declaration.key, declaration.value] : [entry, ""]];
  });
}

function isSecretReference(value: string): boolean {
  return value.startsWith(SECRET_REFERENCE_PREFIX) && isSdlReference(value);
}

function isMapping(value: unknown): value is Mapping {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
