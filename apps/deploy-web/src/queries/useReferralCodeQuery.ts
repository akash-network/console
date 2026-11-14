import { useServices } from "@src/context/ServicesProvider";

/** Matches the endpoint's 60 s cache, so a program turned off mid-visit stops being advertised within a minute. */
const REFERRAL_CODE_CHECK_STALE_TIME_MS = 60_000;

export function useReferralCodeQuery(code: string | undefined) {
  const { api } = useServices();

  return api.v1.getReferralCode.useQuery(
    { code: code ?? "" },
    {
      enabled: !!code,
      staleTime: REFERRAL_CODE_CHECK_STALE_TIME_MS,
      select: response => response.data
    }
  );
}
