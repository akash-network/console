import type { EnvironmentVariableType } from "@src/types/sdlBuilder/sdlBuilder";
import { RESERVED_ENV_KEYS as RESERVED_ENV_KEY_LIST } from "@src/types/sdlBuilder/sdlBuilder";
import { isProtectedByDefault, isSdlReference } from "@src/utils/sdl/sdlSecrets";

const RESERVED_ENV_KEYS = new Set<string>(RESERVED_ENV_KEY_LIST);

type ServiceEnv = EnvironmentVariableType[];

export interface RestoredServiceEnv {
  serviceIndex: number;
  env: ServiceEnv;
}

/** Only a kept secret comes back, because a secret typed in the form holds a value this browser's copy knows nothing about. */
export function restoredEnvOf(current: ServiceEnv[], restored: ServiceEnv[]): { count: number; changes: RestoredServiceEnv[] } {
  let count = 0;
  const changes = current.flatMap((env, serviceIndex) => {
    const givenBack = plainValuesOf(restored[serviceIndex] ?? []);
    const restoredRowCount = env.filter(variable => isKeptSecret(variable) && givenBack.has(variable.key)).length;
    if (restoredRowCount === 0) return [];

    count += restoredRowCount;
    const next = env.map(variable => {
      const value = givenBack.get(variable.key);
      return isKeptSecret(variable) && value !== undefined ? { ...variable, value, isSecret: false } : variable;
    });
    return [{ serviceIndex, env: next }];
  });

  return { count, changes };
}

export function holdsVariablesProtectedByDefault(services: ServiceEnv[]): boolean {
  return services.some(env => env.some(variable => isKeptSecret(variable) && isProtectedByDefault(variable.value ?? "")));
}

/** A reserved variable is managed for the user and never shown, so it is neither counted nor given back. */
function isKeptSecret(variable: EnvironmentVariableType): boolean {
  return !!variable.isSecret && isSdlReference(variable.value ?? "") && !RESERVED_ENV_KEYS.has(variable.key);
}

function plainValuesOf(env: ServiceEnv): Map<string, string> {
  return new Map(env.flatMap(variable => (!variable.isSecret && variable.value !== undefined ? [[variable.key, variable.value] as const] : [])));
}
