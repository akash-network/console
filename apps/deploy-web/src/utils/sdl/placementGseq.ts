import { DeploymentGroups } from "@src/utils/deploymentData/helpers";

/**
 * Resolves a placement's on-chain group sequence (gseq) from the SDL. The chain numbers groups in the order
 * they are submitted in the create-deployment message, which is the order `DeploymentGroups` returns them
 * (both derive from chain-sdk's `buildManifest`), so the gseq is the 1-based index of the group whose name
 * matches the placement. Returns undefined when the SDL is absent/invalid (e.g. mid-edit) or the placement
 * isn't in it, so callers skip gseq filtering rather than hiding every bid.
 */
export function getPlacementGseq(sdl: string, placementName: string): number | undefined {
  if (!sdl) return undefined;

  let groups: ReturnType<typeof DeploymentGroups>;
  try {
    groups = DeploymentGroups(sdl);
  } catch {
    return undefined;
  }

  const index = groups.findIndex(group => group.name === placementName);
  return index === -1 ? undefined : index + 1;
}
