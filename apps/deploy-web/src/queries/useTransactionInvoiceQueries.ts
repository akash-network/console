import { useQueryClient } from "@tanstack/react-query";

import { useServices } from "@src/context/ServicesProvider";

/** Refreshes the history in the background, so the invoice opens without waiting for the list to come back. */
export function useTransactionInvoiceMutation() {
  const { api } = useServices();
  const queryClient = useQueryClient();

  return api.v1.createStripeTransactionInvoice.useMutation({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: api.v1.listStripeTransactions.getKey() });
    }
  });
}
