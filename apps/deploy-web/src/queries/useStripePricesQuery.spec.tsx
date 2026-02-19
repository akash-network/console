import type { StripeService } from "@akashnetwork/http-sdk";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { useStripePricesQuery } from "./useStripePricesQuery";

import { setupQuery } from "@tests/unit/query-client";

describe("useStripePricesQuery", () => {
  it("fetches prices when enabled and use proper cache key", async () => {
    const mockPrices = [
      { unitAmount: 10, isCustom: false, currency: "usd" },
      { unitAmount: 20, isCustom: false, currency: "usd" }
    ];
    const stripeService = mock<StripeService>();
    stripeService.findPrices.mockResolvedValue(mockPrices);

    const { result } = setupQuery(() => useStripePricesQuery(), {
      services: { stripe: () => stripeService }
    });

    await vi.waitFor(() => {
      expect(stripeService.findPrices).toHaveBeenCalled();
      expect(result.current.isSuccess).toBe(true);
      expect(result.current.data).toEqual(mockPrices);
    });
  });

  it("does not fetch when disabled and have initial data", async () => {
    const stripeService = mock<StripeService>();
    stripeService.findPrices.mockResolvedValue([]);
    const { result } = setupQuery(() => useStripePricesQuery({ enabled: false }), {
      services: { stripe: () => stripeService }
    });

    await vi.waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
      expect(result.current.data).toEqual([]);
    });
  });

  it("fallbacks to an empty array if response is null", async () => {
    const stripeService = mock<StripeService>();
    // @ts-expect-error: Mocking null response
    stripeService.findPrices.mockResolvedValue(null);

    const { result } = setupQuery(() => useStripePricesQuery({ enabled: true }), {
      services: { stripe: () => stripeService }
    });

    await vi.waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
      expect(result.current.data).toEqual([]);
    });
  });
});
