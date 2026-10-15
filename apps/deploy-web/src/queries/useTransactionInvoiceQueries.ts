import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useServices } from "@src/context/ServicesProvider";
import { SKIP_REPORTING_REFUSED_INPUT } from "@src/services/query-error-policy/query-error-policy";

/** Refreshes the history in the background, so the invoice downloads without waiting for the list to come back. */
export function useTransactionInvoiceMutation() {
  const { stripe, api } = useServices();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (transactionId: string) => stripe.downloadTransactionInvoice(transactionId),
    meta: SKIP_REPORTING_REFUSED_INPUT,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: api.v1.listStripeTransactions.getKey() });
    }
  });
}
