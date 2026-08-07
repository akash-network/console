import type { SDLInput } from "@akashnetwork/chain-sdk";
import type { GroupSpec } from "@akashnetwork/chain-sdk/private-types/akash.v1beta4";

/**
 * On-chain GPU resource attribute the chain-sdk emits for every interconnect
 * opt-in, whether implicit (`interconnect: []`, value "auto") or explicit
 * (`interconnect: { group }`, value = the group name). Its presence is the
 * reliable signal that a group spec requests a GPU interconnect.
 */
export const INTERCONNECT_GROUP_ATTRIBUTE_KEY = "interconnect/group";

export function sdlRequestsGpuInterconnect(sdl: SDLInput | null | undefined): boolean {
  const computeProfiles = sdl?.profiles?.compute;
  if (!computeProfiles || typeof computeProfiles !== "object") return false;

  return Object.values(computeProfiles).some(profile => profile?.resources?.gpu?.attributes?.interconnect !== undefined);
}

export function groupSpecsRequestGpuInterconnect(groups: GroupSpec[] | null | undefined): boolean {
  if (!groups?.length) return false;

  return groups.some(group =>
    (group.resources ?? []).some(resourceUnit =>
      (resourceUnit.resource?.gpu?.attributes ?? []).some(attribute => attribute.key === INTERCONNECT_GROUP_ATTRIBUTE_KEY)
    )
  );
}
