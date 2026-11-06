import yaml from "js-yaml";
import isEqual from "lodash/isEqual";

import { secretNameOf } from "@src/utils/sdl/sdlSecrets";

interface SdlService {
  env?: unknown;
  credentials?: Record<string, unknown> | null;
}

type SdlServices = Record<string, SdlService | null>;

/** An SDL the assistant wrote may inherit stored secrets only for services it left exactly as they were, since any change to one could send its secrets somewhere new. */
export function keepsSecretsWithTheirServices(sourceSdl: string, nextSdl: string): boolean {
  const source = servicesOf(sourceSdl);
  const next = servicesOf(nextSdl);
  if (!source || !next) return false;

  return Object.entries(next).every(([name, service]) => !referencesSecrets(service) || isEqual(source[name], service));
}

function servicesOf(sdl: string): SdlServices | null {
  try {
    const document = yaml.load(sdl) as { services?: SdlServices } | null;
    return document?.services ?? {};
  } catch {
    return null;
  }
}

function referencesSecrets(service: SdlService | null): boolean {
  const env = Array.isArray(service?.env) ? service.env.filter((entry): entry is string => typeof entry === "string") : [];
  const values = [...env.map(entry => entry.slice(entry.indexOf("=") + 1)), service?.credentials?.username, service?.credentials?.password];
  return values.some(value => typeof value === "string" && secretNameOf(value) !== null);
}
