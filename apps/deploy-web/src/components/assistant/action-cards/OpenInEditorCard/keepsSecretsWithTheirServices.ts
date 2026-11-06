import yaml from "js-yaml";
import isEqual from "lodash/isEqual";

import { secretNameOf } from "@src/utils/sdl/sdlSecrets";

interface SdlServiceShape {
  image?: unknown;
  command?: unknown;
  args?: unknown;
  env?: unknown;
  credentials?: Record<string, unknown> | null;
}

interface ServiceSecrets {
  image: unknown;
  command: unknown;
  args: unknown;
  registryHost: unknown;
  secretNames: Set<string>;
}

/** An SDL the assistant wrote may inherit stored secrets only when no secret would reach a service, image, command or registry that didn't already receive it. */
export function keepsSecretsWithTheirServices(sourceSdl: string, nextSdl: string): boolean {
  const source = servicesOf(sourceSdl);
  const next = servicesOf(nextSdl);
  if (!source || !next) return false;

  return Object.entries(next).every(([name, service]) => {
    if (service.secretNames.size === 0) return true;
    const original = source[name];
    return (
      !!original &&
      original.image === service.image &&
      isEqual(original.command, service.command) &&
      isEqual(original.args, service.args) &&
      original.registryHost === service.registryHost &&
      [...service.secretNames].every(secretName => original.secretNames.has(secretName))
    );
  });
}

function servicesOf(sdl: string): Record<string, ServiceSecrets> | null {
  try {
    const document = yaml.load(sdl) as { services?: Record<string, SdlServiceShape | null> } | null;
    return Object.fromEntries(
      Object.entries(document?.services ?? {}).map(([name, service]) => [
        name,
        {
          image: service?.image,
          command: service?.command,
          args: service?.args,
          registryHost: service?.credentials?.host,
          secretNames: secretNamesOf(service?.env, service?.credentials)
        }
      ])
    );
  } catch {
    return null;
  }
}

function secretNamesOf(env: unknown, credentials: Record<string, unknown> | null | undefined): Set<string> {
  const values = [
    ...(Array.isArray(env) ? env.filter((entry): entry is string => typeof entry === "string").map(entry => entry.slice(entry.indexOf("=") + 1)) : []),
    credentials?.username,
    credentials?.password
  ];
  return new Set(values.flatMap(value => (typeof value === "string" ? [secretNameOf(value)].filter((name): name is string => name !== null) : [])));
}
