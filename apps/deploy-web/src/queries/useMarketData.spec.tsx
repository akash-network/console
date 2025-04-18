import axios from "axios";

import { ApiUrlService } from "@src/utils/apiUtils";
import { queryClient } from "./queryClient";
import { useMarketData } from "./useMarketData";

import { waitFor } from "@testing-library/react";
import { setupQuery } from "@tests/unit/query-client";

jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe("useMarketData", () => {
  jest.useFakeTimers();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should fetch market data successfully and use proper cache key", async () => {
    const mockData = {
      price: 1.23,
      volume: 1000000,
      marketCap: 50000000,
      marketCapRank: 100,
      priceChange24h: 0.05,
      priceChangePercentage24: 5.0
    };
    mockedAxios.get.mockResolvedValueOnce({ data: mockData });

    const { result } = setupQuery(() => useMarketData());

    await waitFor(() => {
      expect(mockedAxios.get).toHaveBeenCalledWith(ApiUrlService.marketData());
      expect(result.current.isSuccess).toBe(true);
      expect(result.current.data).toEqual(mockData);
      expect(queryClient.getQueryData(["MARKET_DATA"])).toEqual(mockData);
    });
  });

  it("should handle empty response data", async () => {
    mockedAxios.get.mockResolvedValueOnce({ data: null });

    const { result } = setupQuery(() => useMarketData());

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
      expect(result.current.data).toBeNull();
    });
  });
});
