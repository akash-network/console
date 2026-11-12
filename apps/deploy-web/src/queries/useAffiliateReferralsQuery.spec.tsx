import { createProxy } from "@akashnetwork/react-query-proxy";
import { describe, expect, it, vi } from "vitest";

import { AFFILIATE_REFERRALS_PAGE_SIZE, useAffiliateReferralsQuery } from "./useAffiliateReferralsQuery";

import { type RenderAppHookOptions, setupQuery } from "@tests/unit/query-client";

type ApiService = ReturnType<NonNullable<NonNullable<RenderAppHookOptions["services"]>["api"]>>;

describe(useAffiliateReferralsQuery.name, () => {
  it("requests the page of referrals at the given index and returns its data", async () => {
    const page = { referrals: [], pagination: { total: 25, limit: AFFILIATE_REFERRALS_PAGE_SIZE, offset: 20 } };
    const listAffiliateReferrals = vi.fn().mockResolvedValue({ data: page });
    const api = createProxy({ v1: { listAffiliateReferrals } }) as unknown as ApiService;

    const { result } = setupQuery(() => useAffiliateReferralsQuery({ pageIndex: 2 }), { services: { api: () => api } });

    await vi.waitFor(() => {
      expect(result.current.data).toEqual(page);
    });
    expect(listAffiliateReferrals).toHaveBeenCalledWith({ limit: AFFILIATE_REFERRALS_PAGE_SIZE, offset: 2 * AFFILIATE_REFERRALS_PAGE_SIZE });
  });

  it("keeps the previous page while the next one loads", async () => {
    const firstPage = { referrals: [], pagination: { total: 25, limit: AFFILIATE_REFERRALS_PAGE_SIZE, offset: 0 } };
    const listAffiliateReferrals = vi
      .fn()
      .mockResolvedValueOnce({ data: firstPage })
      .mockReturnValueOnce(new Promise(() => {}));
    const api = createProxy({ v1: { listAffiliateReferrals } }) as unknown as ApiService;

    let pageIndex = 0;
    const { result, rerender } = setupQuery(() => useAffiliateReferralsQuery({ pageIndex }), { services: { api: () => api } });
    await vi.waitFor(() => expect(result.current.data).toEqual(firstPage));

    pageIndex = 1;
    rerender();

    await vi.waitFor(() => expect(listAffiliateReferrals).toHaveBeenCalledTimes(2));
    expect(result.current.data).toEqual(firstPage);
    expect(result.current.isPlaceholderData).toBe(true);
  });
});
