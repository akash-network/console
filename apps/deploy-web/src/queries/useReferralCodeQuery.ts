import { useServices } from "@src/context/ServicesProvider";

export function useReferralCodeQuery(code: string | undefined) {
  const { api } = useServices();

  return api.v1.getReferralCode.useQuery(
    { code: code ?? "" },
    {
      enabled: !!code,
      staleTime: Infinity,
      select: response => response.data
    }
  );
}
