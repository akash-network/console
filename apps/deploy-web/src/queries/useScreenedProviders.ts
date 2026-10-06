import { useCallback, useMemo, useRef } from "react";
import { GroupSpec } from "@akashnetwork/chain-sdk/private-types/akash.v1beta4";
import { generateManifest, type SDLInput, yaml } from "@akashnetwork/chain-sdk/web";
import type { paths } from "@akashnetwork/console-api-types";
import { keepPreviousData, useQueries, useQueryClient } from "@tanstack/react-query";

import { useServices } from "@src/context/ServicesProvider";
import { usePacedValue } from "@src/hooks/usePacedValue/usePacedValue";
import { AUDITOR } from "@src/utils/deploymentData/v1beta3";
import { isInPickedRegions } from "@src/utils/sdl/placementRegions";

export type ScreeningRequest = NonNullable<paths["/v1/bid-screening"]["post"]["requestBody"]>["content"]["application/json"];

/** The screening request minus `timezone`, which the hook attaches from the client's resolved locale. */
type ScreeningRequestBody = Omit<ScreeningRequest, "timezone">;

export type ScreenedProvidersResponse = paths["/v1/bid-screening"]["post"]["responses"][200]["content"]["application/json"];

export type ScreenedProvider = ScreenedProvidersResponse["providers"][number];

interface UseScreenedProvidersInput {
  sdl: string;
  placementName: string;
  /** The placement's picked regions: a single one already screens through the SDL, while several are applied to the result here. */
  regions?: readonly string[];
  /**
   * Gates the screening query. Defaults to true. Set false once the deployment is locked (quoting/creating/closing):
   * the spec is frozen, so re-running the CPU-heavy screening yields nothing new — the last result is kept (via
   * `keepPreviousData`) while live bids drive the marketplace.
   */
  enabled?: boolean;
}

export interface KeyedScreeningRequest {
  key: string;
  request: ScreeningRequest | null;
  /** Counts only providers in these regions when there are several, as {@link UseScreenedProvidersInput.regions} does. */
  regions?: readonly string[];
}

export interface ScreenedProviderCount {
  count: number | null;
  /** Free GPUs of the requested kind across those providers, null while unknown. */
  gpuCount: number | null;
  isLoading: boolean;
}

interface UseScreenedProvidersResult {
  providers: ScreenedProvider[];
  isLoading: boolean;
  isError: boolean;
  /**
   * True when the current SDL can't be turned into a screening request (invalid or incomplete spec). No
   * provider would bid on an unusable spec, so the marketplace shows a message instead of a list — screening
   * does NOT fall back to the full catalog.
   */
  isInvalid: boolean;
  /** The providers shown are from the previous spec while the current one is being screened. */
  isRefreshing: boolean;
}

/** Quiet period after the last spec edit before the current spec is screened. */
export const SCREENING_DEBOUNCE_MS = 400;
/** Hard ceiling so continuous editing still screens the spec at most ~once per this window. */
export const SCREENING_MAX_WAIT_MS = 2000;
/**
 * Image substituted into image-less services when screening (only). `generateManifest` rejects a spec
 * whose service has no image, which would drop a still-being-configured deployment to the empty-resource
 * catalog; the placeholder lets the current spec's resources drive the first screening list instead. The
 * screening request carries resources, not the image, so this value never leaves the client.
 */
export const SCREENING_PLACEHOLDER_IMAGE = "placeholder";

/** A stable, never-fetched request used as the query key while screening is skipped (invalid spec), so the key doesn't churn. */
const SKIPPED_SCREENING_REQUEST: ScreeningRequest = { ...buildCatalogScreeningRequest(), timezone: "UTC" };

/**
 * Screens providers for the given placement's group spec. The marketplace is placement-scoped: it converts
 * the current SDL to group specs and queries the one matching `placementName`. When the SDL can't be turned
 * into a screening request (invalid or incomplete spec) it does NOT fall back to the full catalog — no
 * provider would bid on an unusable spec — instead it reports `isInvalid` so the marketplace shows a message.
 * A single picked region travels in the SDL, so a valid spec already screens by it; several can't, so the result keeps
 * only the providers located in one of them. Audited-only via signedBy.
 */
export function useScreenedProviders({ sdl, placementName, regions, enabled = true }: UseScreenedProvidersInput): UseScreenedProvidersResult {
  const { api } = useServices();
  const request = useMemo(() => toScreeningRequest(sdl, placementName), [sdl, placementName]);
  const pacedRequest = usePacedValue(request, { wait: SCREENING_DEBOUNCE_MS, maxWait: SCREENING_MAX_WAIT_MS });
  const isScreenable = pacedRequest !== null;
  /** A spec fixed mid-edit waits out the pacing as loading, so the panes stop explaining an invalid spec the moment it becomes valid. */
  const isInvalid = !isScreenable && request === null;
  const query = api.v1.screenProviders.useQuery(pacedRequest ?? SKIPPED_SCREENING_REQUEST, {
    enabled: enabled && isScreenable,
    placeholderData: keepPreviousData
  });
  const providers = useMemo(() => inPickedRegions(query.data?.providers ?? [], regions), [query.data, regions]);

  return {
    providers: isScreenable ? providers : [],
    isLoading: !isInvalid && (!isScreenable || query.isLoading),
    isError: isScreenable && query.isError,
    isInvalid,
    isRefreshing: isScreenable && query.isFetching && query.isPlaceholderData
  };
}

/** Keeps each key's last count while it is re-screened, because `useQueries` drops placeholder data when a query key changes. */
export function useScreenedProviderCounts(requests: KeyedScreeningRequest[]): ScreenedProviderCount[] {
  const { api } = useServices();
  const lastCountByKey = useRef(new Map<string, Omit<ScreenedProviderCount, "isLoading">>());
  const results = useQueries({
    queries: requests.map(({ request }) => api.v1.screenProviders.queryOptions(request ?? SKIPPED_SCREENING_REQUEST, { enabled: request !== null }))
  });

  return results.map((result, index) => {
    const { key, request, regions } = requests[index];
    if (request === null) return { count: null, gpuCount: null, isLoading: false };
    if (result.data) {
      const providers = inPickedRegions(result.data.providers, regions);
      lastCountByKey.current.set(key, { count: providers.length, gpuCount: sumAvailableGpus(providers) });
    }
    return { count: null, gpuCount: null, ...lastCountByKey.current.get(key), isLoading: result.isLoading };
  });
}

/** Null while any provider comes from a screening API that predates the count, so a partial sum never reads as the total. */
export function sumAvailableGpus(providers: ScreenedProvider[]): number | null {
  let total = 0;
  for (const provider of providers) {
    const availableGpus: number | undefined = provider.availableGpus;
    if (availableGpus === undefined) return null;
    total += availableGpus;
  }
  return total;
}

/** Reads the screening already cached for each placement, so recording what screening promised never screens again. */
export function useCachedScreenedProviderCount() {
  const { api } = useServices();
  const queryClient = useQueryClient();

  return useCallback(
    function countScreenedProviders(sdl: string, placements: ReadonlyArray<{ name: string; regions?: readonly string[] }>): number | undefined {
      let total = 0;
      for (const placement of placements) {
        const request = toScreeningRequest(sdl, placement.name);
        const screened = request && queryClient.getQueryData<ScreenedProvidersResponse>(api.v1.screenProviders.getKey(request));
        if (!screened) return undefined;
        total += inPickedRegions(screened.providers, placement.regions).length;
      }
      return total;
    },
    [api, queryClient]
  );
}

/** Reads only what screening already answered for the current spec, so a placement still being screened, failing, or invalid never counts as unhostable. */
export function useHasPlacementWithoutProviders(sdl: string, placements: ReadonlyArray<{ name: string; regions?: readonly string[] }>): boolean {
  const { api } = useServices();
  const requests = useMemo(() => placements.map(placement => toScreeningRequest(sdl, placement.name)), [sdl, placements]);
  const results = useQueries({
    queries: requests.map(request => api.v1.screenProviders.queryOptions(request ?? SKIPPED_SCREENING_REQUEST, { enabled: false }))
  });

  return results.some(
    (result, index) => requests[index] !== null && !!result.data && inPickedRegions(result.data.providers, placements[index].regions).length === 0
  );
}

/** Every caller builds its request here so equal specs share one query cache entry. */
export function toScreeningRequest(sdl: string, placementName: string): ScreeningRequest | null {
  const placementRequest = buildPlacementScreeningRequest(sdl, placementName);
  if (!placementRequest) return null;
  return { ...placementRequest, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone };
}

/**
 * Converts the current SDL into a screening request for a single placement's group spec. Returns null
 * when the SDL is incomplete/invalid (e.g. mid-edit) or the placement isn't in it yet, so the caller can
 * fall back to the full catalog. `signedBy` forces audited-only screening; `attributes` are passed through
 * from the placement and carry the `location-region` filter (and any other declared attribute). The proto
 * JSON encodes resource values as decimal integer strings, which the screening endpoint accepts.
 */
export function buildPlacementScreeningRequest(rawSdl: string, placementName: string): ScreeningRequestBody | null {
  if (!rawSdl) return null;

  try {
    // `yaml.raw` throws on malformed YAML (e.g. mid-edit), so the whole conversion is guarded: any
    // parse/manifest failure returns null, letting the caller fall back to the full catalog.
    const parsedSdl = yaml.raw(rawSdl) as SDLInput;
    fillPlaceholderImages(parsedSdl);
    const manifestResult = generateManifest(parsedSdl);
    if (!manifestResult.ok) return null;

    const manifest = manifestResult.value;
    const group = manifest.groupSpecs.find(candidate => candidate.name === placementName);
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
      resources: groupJson.resources,
      reclamationWindow: manifest.reclamation?.minWindow?.seconds ? Number(manifest.reclamation?.minWindow?.seconds) : undefined
    };
  } catch {
    return null;
  }
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

/**
 * Fills a placeholder image into every service still missing one so a mid-configuration spec passes
 * manifest generation for screening. Mutates the throwaway parsed SDL built inside
 * {@link buildPlacementScreeningRequest} — never the deployment SDL, so the real deployment still
 * requires a real image.
 */
function fillPlaceholderImages(parsedSdl: SDLInput): void {
  const services = (parsedSdl as { services?: Record<string, { image?: string }> }).services;
  if (!services) return;
  for (const service of Object.values(services)) {
    if (!service.image) {
      service.image = SCREENING_PLACEHOLDER_IMAGE;
    }
  }
}

/** Several picked regions never reach the chain, so the screened list is kept to the providers located in them here. */
function inPickedRegions(providers: ScreenedProvider[], regions: readonly string[] | undefined): ScreenedProvider[] {
  return providers.filter(provider => isInPickedRegions(regions, provider.location));
}
