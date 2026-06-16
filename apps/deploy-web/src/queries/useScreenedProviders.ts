import { useMemo } from "react";
import { GroupSpec } from "@akashnetwork/chain-sdk/private-types/akash.v1beta4";
import type { paths } from "@akashnetwork/console-api-types";

import { useServices } from "@src/context/ServicesProvider";
import { DeploymentGroups } from "@src/utils/deploymentData/helpers";
import { AUDITOR } from "@src/utils/deploymentData/v1beta3";

type ScreeningRequest = NonNullable<paths["/v1/bid-screening"]["post"]["requestBody"]>["content"]["application/json"];

/** The screening request minus `timezone`, which the hook attaches from the client's resolved locale. */
type ScreeningRequestBody = Omit<ScreeningRequest, "timezone">;

export type ScreenedProvidersResponse = paths["/v1/bid-screening"]["post"]["responses"][200]["content"]["application/json"];

export type ScreenedProvider = ScreenedProvidersResponse["providers"][number];

interface UseScreenedProvidersInput {
  sdl: string;
  placementName: string;
  region?: string;
}

interface UseScreenedProvidersResult {
  providers: ScreenedProvider[];
  isLoading: boolean;
  isError: boolean;
}

/**
 * Screens providers for the given placement's group spec. The marketplace is placement-scoped: it converts
 * the current SDL to group specs and queries the one matching `placementName`. While the SDL is mid-edit or
 * invalid it falls back to the full audited catalog (empty resource spec). The selected `region` lives outside
 * the SDL, so it is threaded in explicitly and still constrains the catalog fallback. Audited-only via signedBy.
 */
export function useScreenedProviders({ sdl, placementName, region }: UseScreenedProvidersInput): UseScreenedProvidersResult {
  const { api } = useServices();
  const request = useMemo(() => {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return { ...(buildPlacementScreeningRequest(sdl, placementName) ?? buildCatalogScreeningRequest(region)), timezone };
  }, [sdl, placementName, region]);
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
export function buildPlacementScreeningRequest(sdl: string, placementName: string): ScreeningRequestBody | null {
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
    requirements: {
      signedBy: { allOf: [AUDITOR] },
      attributes: groupJson.requirements?.attributes ?? []
    },
    resources: groupJson.resources
  };
}

/**
 * Builds the full audited catalog request (empty resource spec) used before a deployment is configured (no
 * SDL yet, mid-edit/invalid SDL, or no placement selected). Because the region is chosen independently of the
 * SDL, it is honored here too: a selected region is added as a `location-region` attribute constraint. The
 * region key comes from the provider-regions API, which derives it from the same provider attribute values
 * being matched, so it is passed through verbatim. An empty/unset region means "any region", i.e. no
 * constraint. Audited-only via signedBy.
 */
export function buildCatalogScreeningRequest(region?: string): ScreeningRequestBody {
  return {
    requirements: {
      signedBy: { allOf: [AUDITOR] },
      attributes: region ? [{ key: "location-region", value: region }] : []
    },
    resources: []
  };
}
