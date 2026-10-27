import type { EnvironmentVariableType } from "@src/types/sdlBuilder/sdlBuilder";
import { RESERVED_ENV_KEYS as RESERVED_ENV_KEY_LIST } from "@src/types/sdlBuilder/sdlBuilder";
import { isProtectedByDefault } from "@src/utils/sdl/sdlSecrets";

const RESERVED_ENV_KEYS = new Set<string>(RESERVED_ENV_KEY_LIST);

type ServiceEnv = EnvironmentVariableType[];

export function holdsVariablesProtectedByDefault(services: ServiceEnv[]): boolean {
  return services.some(env => env.some(isKeptSecret));
}

/** A reserved variable is managed for the user and never shown, so it is not counted. */
function isKeptSecret(variable: EnvironmentVariableType): boolean {
  return !!variable.isSecret && isProtectedByDefault(variable.value ?? "") && !RESERVED_ENV_KEYS.has(variable.key);
}
