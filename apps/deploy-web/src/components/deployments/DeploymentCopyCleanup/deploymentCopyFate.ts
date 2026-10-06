import { hasEnvProtectedByDefault, isStoredSdlRedeployable } from "@src/utils/sdl/storedDefinition";

export type DeploymentCopyFate = "forget" | "only-in-browser" | "restores-variables" | "holds-name" | "keep";

export interface DeploymentCopy {
  manifest?: string;
  name?: string;
}

export interface DeploymentRecord {
  deployment: { state: string; hash: string };
  name: string | null;
  consoleSettings: { sdl: string; manifestVersion: string } | null;
}

type ManifestVersionOf = (sdl: string) => Promise<string | null>;

/** Mirrors how the deployment page picks a definition, so a copy goes only once nothing there would still read it. */
export async function deploymentCopyFateOf(
  copy: DeploymentCopy,
  record: DeploymentRecord | null,
  manifestVersionOf: ManifestVersionOf
): Promise<DeploymentCopyFate> {
  if (!record) return "keep";
  if (!copy.manifest) return holdsUnsentName(copy, record) ? "holds-name" : "forget";

  const { consoleSettings, deployment } = record;
  if (!consoleSettings) return "only-in-browser";
  if (!(await isOnChain(consoleSettings, deployment.hash, manifestVersionOf))) return "keep";
  if (await restoresVariables(copy.manifest, consoleSettings.sdl, deployment.hash, manifestVersionOf)) return "restores-variables";
  if (holdsUnsentName(copy, record)) return "holds-name";

  return "forget";
}

/** A copy whose values were blanked away is usable only if hashing it still gives what the chain committed. */
async function isOnChain(consoleSettings: { sdl: string; manifestVersion: string }, chainHash: string, manifestVersionOf: ManifestVersionOf): Promise<boolean> {
  if (consoleSettings.manifestVersion !== chainHash) return false;

  return isStoredSdlRedeployable(consoleSettings.sdl) || (await manifestVersionOf(consoleSettings.sdl)) === chainHash;
}

/** The update tab gives back the values the console sealed on its own only from a copy that is exactly what the chain runs. */
async function restoresVariables(browserSdl: string, apiSdl: string, chainHash: string, manifestVersionOf: ManifestVersionOf): Promise<boolean> {
  return hasEnvProtectedByDefault(apiSdl) && (await manifestVersionOf(browserSdl)) === chainHash;
}

/** The console learns an older deployment's name from this copy, and nothing confirms that it has. */
function holdsUnsentName(copy: DeploymentCopy, record: DeploymentRecord): boolean {
  return !record.name && !!copy.name?.trim();
}
