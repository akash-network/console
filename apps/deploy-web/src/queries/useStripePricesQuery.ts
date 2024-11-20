import { useQuery } from "react-query";

import { stripeService } from "@src/services/http/http.service";

export function useStripePricesQuery({ enabled = true } = {}) {
  return useQuery(["StripePrices"], () => stripeService.findPrices(), {
    enabled,
    initialData: { data: [] },
    select: data => data?.data || []
  });
}
