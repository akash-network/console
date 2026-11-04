import { useServices } from "@src/context/ServicesProvider";

export function useHardwareRequestsQuery() {
  const { api } = useServices();

  return api.v1.listHardwareRequests.useQuery(undefined, { select: response => response.data });
}
