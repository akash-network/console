import { stripeService } from "@src/services/http/http-browser.service";
import { queryClient } from "./queryClient";
import { useStripePricesQuery } from "./useStripePricesQuery";

import { waitFor } from "@testing-library/react";
import { setupQuery } from "@tests/unit/query-client";

jest.mock("@src/services/http/http-browser.service", () => ({
  stripeService: {
    findPrices: jest.fn()
  }
}));

describe("useStripePricesQuery", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    queryClient.clear();
  });

  it("should fetch prices when enabled and use proper cache key", async () => {
    const mockData = [
      {
        unitAmount: 10,
        isCustom: false,
        currency: "usd"
      },
      {
        unitAmount: 20,
        isCustom: false,
        currency: "usd"
      }
    ];
    (stripeService.findPrices as jest.Mock).mockResolvedValue({ data: mockData });

    const { result } = setupQuery(() => useStripePricesQuery());

    await waitFor(() => {
      expect(stripeService.findPrices).toHaveBeenCalled();
      expect(result.current.isSuccess).toBe(true);
      expect(result.current.data).toEqual(mockData);
      expect(queryClient.getQueryData(["StripePrices"])).toEqual({ data: mockData });
    });
  });

  it("should not fetch when disabled and have initial data", () => {
    const { result } = setupQuery(() => useStripePricesQuery({ enabled: false }));

    expect(stripeService.findPrices).not.toHaveBeenCalled();
    expect(result.current.data).toEqual([]);
  });

  it("should handle empty response data", async () => {
    (stripeService.findPrices as jest.Mock).mockResolvedValue({ data: null });

    const { result } = setupQuery(() => useStripePricesQuery({ enabled: true }));

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
      expect(result.current.data).toEqual([]);
    });
  });
});
