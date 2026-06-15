import { useMemo } from "react";
import { GroupSpec } from "@akashnetwork/chain-sdk/private-types/akash.v1beta4";
import type { paths } from "@akashnetwork/console-api-types";

import { useServices } from "@src/context/ServicesProvider";
import { DeploymentGroups } from "@src/utils/deploymentData/helpers";
import { AUDITOR } from "@src/utils/deploymentData/v1beta3";

type ScreeningRequest = NonNullable<paths["/v1/bid-screening"]["post"]["requestBody"]>["content"]["application/json"];

export type ScreenedProvidersResponse = paths["/v1/bid-screening"]["post"]["responses"][200]["content"]["application/json"];

export type ScreenedProvider = ScreenedProvidersResponse["providers"][number];

interface UseScreenedProvidersInput {
  sdl: string;
  placementName: string;
}

interface UseScreenedProvidersResult {
  providers: ScreenedProvider[];
  isLoading: boolean;
  isError: boolean;
}

/** Group name required by the request but irrelevant to catalog matching when no placement resolves. */
const SCREENING_GROUP_NAME = "screening";

/**
 * Full audited catalog query, used before a deployment is configured (no SDL yet, mid-edit/invalid SDL,
 * or no placement selected). The screening endpoint returns every audited provider for an empty resource spec.
 */
const EMPTY_CATALOG_REQUEST: ScreeningRequest = {
  name: SCREENING_GROUP_NAME,
  requirements: { signedBy: { allOf: [AUDITOR] }, attributes: [] },
  resources: []
};

/**
 * Screens providers for the given placement's group spec. The marketplace is placement-scoped: it converts
 * the current SDL to group specs and queries the one matching `placementName`. While the SDL is mid-edit or
 * invalid it falls back to the full audited catalog (empty resource spec). Audited-only via signedBy.
 */
export function useScreenedProviders({ sdl, placementName }: UseScreenedProvidersInput): UseScreenedProvidersResult {
  const { api } = useServices();
  const request = useMemo(() => buildPlacementScreeningRequest(sdl, placementName) ?? EMPTY_CATALOG_REQUEST, [sdl, placementName]);
  const query = api.v1.screenProviders.useQuery(request);

  return {
    providers: query.data?.providers ?? [],
    isLoading: query.isLoading,
    isError: query.isError
  };
}

/**
 * Converts the current SDL into a screening request for a single placement's group spec. Returns null
 * when the SDL is incomplete/invalid (e.g. mid-edit) or the placement isn't in it yet, so the caller can
 * fall back to the full catalog. `signedBy` forces audited-only screening; `attributes` are passed through
 * from the placement and carry the `location-region` filter (and any other declared attribute). The proto
 * JSON encodes resource values as base64 integer strings, which the screening endpoint accepts.
 */
export function buildPlacementScreeningRequest(sdl: string, placementName: string): ScreeningRequest | null {
  if (!sdl) return null;

  let groups: ReturnType<typeof DeploymentGroups>;
  try {
    groups = DeploymentGroups(sdl);
  } catch {
    return null;
  }

  const group = groups.find(candidate => candidate.name === placementName);
  if (!group) return null;

  const groupJson = GroupSpec.toJSON(group) as {
    resources: ScreeningRequest["resources"];
    requirements?: { attributes?: Array<{ key: string; value: string }> };
  };

  return {
    name: placementName,
    requirements: {
      signedBy: { allOf: [AUDITOR] },
      attributes: groupJson.requirements?.attributes ?? []
    },
    resources: groupJson.resources
  };
}
