import { useServices } from "@src/context/ServicesProvider";

export function useAccountDeletionEligibilityQuery() {
  const { api } = useServices();

  return api.v1.getAccountDeletionEligibility.useQuery(undefined, { select: response => response.data });
}
