import { useServices } from "@src/context/ServicesProvider";

export function useAccountDeletionEligibilityQuery({ enabled }: { enabled: boolean }) {
  const { api } = useServices();

  return api.v1.getAccountDeletionEligibility.useQuery(undefined, { enabled, select: response => response.data });
}
