import type { AxiosInstance } from "axios";
import { mock } from "jest-mock-extended";

import type { Props as ServicesProviderProps } from "@src/context/ServicesProvider";
import { ApiUrlService } from "@src/utils/apiUtils";
import { useMarketData } from "./useMarketData";

import { waitFor } from "@testing-library/react";
import { setupQuery } from "@tests/unit/query-client";

describe("useMarketData", () => {
  it("fetches market data successfully and use proper cache key", async () => {
    const mockData = {
      price: 1.23,
      volume: 1000000,
      marketCap: 50000000,
      marketCapRank: 100,
      priceChange24h: 0.05,
      priceChangePercentage24: 5.0
    };
    const axios = mock<AxiosInstance>();
    axios.get.mockResolvedValue({ data: mockData });

    const { result } = setup({
      services: {
        axios: () => axios
      }
    });

    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledWith(ApiUrlService.marketData());
      expect(result.current.isSuccess).toBe(true);
      expect(result.current.data).toEqual(mockData);
    });
  });

  it("handles empty response data", async () => {
    const axios = mock<AxiosInstance>();
    axios.get.mockResolvedValue({ data: null });

    const { result } = setup({
      services: {
        axios: () => axios
      }
    });

    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledWith(ApiUrlService.marketData());
      expect(result.current.isSuccess).toBe(true);
      expect(result.current.data).toBeNull();
    });
  });

  it("should handle error when fetching market data", async () => {
    const axios = mock<AxiosInstance>();
    axios.get.mockRejectedValue(new Error("Failed to fetch market data"));

    const { result } = setup({
      services: {
        axios: () => axios
      }
    });

    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledWith(ApiUrlService.marketData());
      expect(result.current.isError).toBe(true);
    });
  });

  function setup(input?: { services?: ServicesProviderProps["services"] }) {
    return setupQuery(() => useMarketData(), {
      services: input?.services
    });
  }
});
