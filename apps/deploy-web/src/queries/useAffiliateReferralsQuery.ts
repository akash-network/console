import type { paths } from "@akashnetwork/console-api-types";
import { keepPreviousData } from "@tanstack/react-query";

import { useServices } from "@src/context/ServicesProvider";

export type AffiliateReferralPage = paths["/v1/affiliates/me/referrals"]["get"]["responses"][200]["content"]["application/json"]["data"];
export type AffiliateReferral = AffiliateReferralPage["referrals"][number];

export const AFFILIATE_REFERRALS_PAGE_SIZE = 10;

/** Keeps the page on screen while the next one loads, so paging doesn't flash the list away. */
export function useAffiliateReferralsQuery({ pageIndex }: { pageIndex: number }) {
  const { api } = useServices();

  return api.v1.listAffiliateReferrals.useQuery(
    { limit: AFFILIATE_REFERRALS_PAGE_SIZE, offset: pageIndex * AFFILIATE_REFERRALS_PAGE_SIZE },
    { placeholderData: keepPreviousData, select: response => response.data }
  );
}
