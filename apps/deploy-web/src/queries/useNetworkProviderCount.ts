import { useMemo } from "react";

import { useServices } from "@src/context/ServicesProvider";
import { buildCatalogScreeningRequest } from "./useScreenedProviders";

/** The network changes slowly next to the spec being edited, and the unconstrained screening is the heaviest one. */
const NETWORK_PROVIDERS_STALE_TIME_MS = 5 * 60_000;

/** Screening an empty resource spec returns every online audited provider, the same pool a real spec narrows down. */
export function useNetworkProviderCount(): { count: number | null; isLoading: boolean } {
  const { api } = useServices();
  const request = useMemo(() => ({ ...buildCatalogScreeningRequest(), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }), []);
  const query = api.v1.screenProviders.useQuery(request, { staleTime: NETWORK_PROVIDERS_STALE_TIME_MS, refetchOnWindowFocus: false });

  return { count: query.data ? query.data.providers.length : null, isLoading: query.isLoading };
}
