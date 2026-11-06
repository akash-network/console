import { mintSecretName, secretReferenceNamesIn } from "@src/utils/sdl/sdlSecrets";

const SECRET_NAME_INVALID_CHARACTERS = /[^A-Za-z0-9_]/g;

/** Never reuses a name the stored SDL already references, so sealing a new value can't overwrite a secret another variable reads. */
export function mintFreshSecretName(storedSdl: string | null | undefined, preferredName: string): string {
  return mintFreshSecretNames(storedSdl, [preferredName])[0];
}

/** Mints every name from one set of taken names, as the update tab does, so names minted together never collide with each other either. */
export function mintFreshSecretNames(storedSdl: string | null | undefined, preferredNames: string[]): string[] {
  const taken = secretReferenceNamesIn(storedSdl ?? "");
  return preferredNames.map(preferredName => mintSecretName(preferredName.replace(SECRET_NAME_INVALID_CHARACTERS, "_"), taken));
}
