import { useQuery } from "@tanstack/react-query";

import { stripeService } from "@src/services/http/http-browser.service";

export function useStripePricesQuery({ enabled = true } = {}) {
  return useQuery({
    queryKey: ["StripePrices"],
    queryFn: () => stripeService.findPrices(),
    enabled,
    initialData: { data: [] },
    select: data => data?.data || []
  });
}
