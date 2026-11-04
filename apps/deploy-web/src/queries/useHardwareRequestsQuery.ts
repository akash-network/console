import { useQueryClient } from "@tanstack/react-query";

import { useServices } from "@src/context/ServicesProvider";

export function useHardwareRequestsQuery() {
  const { api } = useServices();

  return api.v1.listHardwareRequests.useQuery(undefined, { select: response => response.data });
}

export function useHardwareRequestOffersQuery(hardwareRequestId: string) {
  const { api } = useServices();

  return api.v1.listHardwareRequestOffers.useQuery({ id: hardwareRequestId }, { select: response => response.data });
}

/** Refreshes the list even when the withdrawal is refused, since a refusal means the request moved on since the list was loaded. */
export function useWithdrawHardwareRequestMutation() {
  const { api } = useServices();
  const queryClient = useQueryClient();

  return api.v1.withdrawHardwareRequest.useMutation({
    onSettled: () => queryClient.invalidateQueries({ queryKey: api.v1.listHardwareRequests.getKey() })
  });
}
