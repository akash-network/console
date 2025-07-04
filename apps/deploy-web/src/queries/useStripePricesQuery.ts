import { useQuery } from "@tanstack/react-query";

import { useServices } from "@src/context/ServicesProvider";

export function useStripePricesQuery({ enabled = true } = {}) {
  const { stripe: stripeService } = useServices();
  return useQuery({
    queryKey: ["StripePrices"],
    queryFn: () => stripeService.findPrices(),
    enabled,
    initialData: [],
    select: data => data || []
  });
}
