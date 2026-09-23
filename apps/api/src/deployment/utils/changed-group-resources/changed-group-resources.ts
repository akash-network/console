import { Endpoint_Kind, GroupSpec } from "@akashnetwork/chain-sdk/private-types/akash.v1beta4";
import type { DeploymentInfo } from "@akashnetwork/http-sdk";
import { isDeepStrictEqual } from "node:util";

export type OnChainGroupSpec = DeploymentInfo["groups"][number]["group_spec"];

type ResourceUnit = GroupSpec["resources"][number];

/** Judged as the provider's manifest cross-validation judges it: price and placement may change, and endpoints count only by kind. */
export function findGroupWithChangedResources(submitted: GroupSpec[], onChain: OnChainGroupSpec[]): string | undefined {
  const submittedGroups = comparableGroupsOf(submitted);
  const onChainGroups = comparableGroupsOf(onChain.map(group => GroupSpec.fromJSON(group)));
  const groupNames = new Set([...submittedGroups.keys(), ...onChainGroups.keys()]);

  return [...groupNames].find(name => !isDeepStrictEqual(submittedGroups.get(name), onChainGroups.get(name)));
}

function comparableGroupsOf(groups: GroupSpec[]) {
  return new Map(groups.map(group => [group.name, new Map(group.resources.map(unit => [unit.resource?.id, comparableUnitOf(unit)]))]));
}

function comparableUnitOf({ resource, count }: ResourceUnit) {
  return { count, resource: { ...resource, endpoints: resource?.endpoints.map(endpoint => Endpoint_Kind[endpoint.kind]).sort() } };
}
