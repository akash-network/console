import { useServices } from "@src/context/ServicesProvider";

/** A block never changes once produced, so one read per height serves the whole session. */
export function useBlock(height: number) {
  const { api } = useServices();

  return api.v1.getBlock.useQuery({ height }, { staleTime: Infinity });
}
