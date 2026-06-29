import { useServices } from "@src/context/ServicesProvider";

/** Poll cadence for live bids while quoting; callers that don't poll omit it. */
export const BID_POLL_INTERVAL = 2000;

/**
 * `listBids` for a deployment, keyed on its dseq. Disabled until a dseq exists (and when `enabled` is false),
 * so every caller shares one react-query cache entry rather than re-declaring the query. Wrapped so consumers
 * can inject it via their own DEPENDENCIES for unit tests.
 */
export function useListBids(dseq: string | null | undefined, options?: { enabled?: boolean; refetchInterval?: number }) {
  const { api } = useServices();
  return api.v1.listBids.useQuery({ dseq: dseq ?? "" }, { enabled: (options?.enabled ?? true) && !!dseq, refetchInterval: options?.refetchInterval });
}
