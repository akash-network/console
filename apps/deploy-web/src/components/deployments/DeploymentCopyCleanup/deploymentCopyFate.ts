import { MAX_DEPLOYMENT_NAME_LENGTH } from "@src/config/deploy.config";
import { isStoredSdlRedeployable } from "@src/utils/sdl/storedDefinition";

/** `keep` is for the definition a running deployment would lose with the copy; `record` hands it to the console first. */
export type DefinitionFate = "forget" | "record" | "keep";

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

/** Mirrors how the deployment page picks a definition, so a copy goes unless it is the only one a running deployment can still be shown from. */
export async function definitionFateOf(copy: DeploymentCopy, record: DeploymentRecord, manifestVersionOf: ManifestVersionOf): Promise<DefinitionFate> {
  const { consoleSettings, deployment } = record;
  if (!copy.manifest || deployment.state !== "active") return "forget";
  if (!consoleSettings) return "record";
  if (await isOnChain(consoleSettings, deployment.hash, manifestVersionOf)) return "forget";

  return (await manifestVersionOf(copy.manifest)) === deployment.hash ? "keep" : "forget";
}

/** A copy whose values were blanked away is usable only if hashing it still gives what the chain committed. */
async function isOnChain(consoleSettings: { sdl: string; manifestVersion: string }, chainHash: string, manifestVersionOf: ManifestVersionOf): Promise<boolean> {
  if (consoleSettings.manifestVersion !== chainHash) return false;

  return isStoredSdlRedeployable(consoleSettings.sdl) || (await manifestVersionOf(consoleSettings.sdl)) === chainHash;
}

/** The name this copy holds when the console has none, cut to what the console accepts. */
export function unsentNameOf(copy: DeploymentCopy, record: DeploymentRecord): string | undefined {
  if (record.name) return undefined;

  return copy.name?.trim().slice(0, MAX_DEPLOYMENT_NAME_LENGTH) || undefined;
}
