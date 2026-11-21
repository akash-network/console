import type { DehydratedState, QueryKey } from "@tanstack/react-query";
import { dehydrate, QueryClient } from "@tanstack/react-query";

export interface VisitorQuery {
  queryKey: QueryKey;
  data: unknown;
  /** True when the data is only what the first screen shows, so the browser loads the rest as soon as it has rendered. */
  isPartial?: boolean;
}

/** Any time in the past makes a query stale, whatever its hook allows. */
const ALREADY_STALE_UPDATED_AT = 1;

/** Next refuses page props holding `undefined`, which a dehydrated query carries, so the state goes through JSON. */
export function dehydrateVisitorQueries(queries: VisitorQuery[]): DehydratedState {
  const queryClient = new QueryClient();

  for (const query of queries) {
    queryClient.setQueryData(query.queryKey, query.data, query.isPartial ? { updatedAt: ALREADY_STALE_UPDATED_AT } : undefined);
  }

  return JSON.parse(JSON.stringify(dehydrate(queryClient)));
}
