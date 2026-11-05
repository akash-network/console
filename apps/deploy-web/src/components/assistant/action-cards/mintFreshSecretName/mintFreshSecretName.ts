import { mintSecretName, secretReferenceNamesIn } from "@src/utils/sdl/sdlSecrets";

const SECRET_NAME_INVALID_CHARACTERS = /[^A-Za-z0-9_]/g;

/** Never reuses a name the stored SDL already references, so sealing a new value can't overwrite a secret another variable reads. */
export function mintFreshSecretName(storedSdl: string | null | undefined, preferredName: string): string {
  return mintSecretName(preferredName.replace(SECRET_NAME_INVALID_CHARACTERS, "_"), secretReferenceNamesIn(storedSdl ?? ""));
}
