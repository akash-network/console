import { useQueryClient } from "@tanstack/react-query";

import { useServices } from "@src/context/ServicesProvider";
import { SKIP_REPORTING_REFUSED_INPUT } from "@src/services/query-error-policy/query-error-policy";

export function useBillingDetailsQuery() {
  const { api } = useServices();

  return api.v1.getBillingDetails.useQuery(undefined, { select: response => response.data });
}

export function useUpdateBillingDetailsMutation() {
  const { api } = useServices();
  const queryClient = useQueryClient();

  return api.v1.updateBillingDetails.useMutation({
    meta: SKIP_REPORTING_REFUSED_INPUT,
    onSuccess: response => queryClient.setQueryData(api.v1.getBillingDetails.getKey(), response)
  });
}
