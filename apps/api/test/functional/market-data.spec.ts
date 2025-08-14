import nock from "nock";

import { app } from "@src/app";

describe("Market Data", () => {
  beforeAll(async () => {
    // Clean up any existing nock interceptors
    nock.cleanAll();

    const coinGeckoApiUrl = "https://api.coingecko.com";

    // More permissive nock setup that matches any headers
    nock(coinGeckoApiUrl)
      .persist()
      .get("/api/v3/coins/akash-network")
      .reply(200, {
        id: "akash-network",
        symbol: "akt",
        name: "Akash Network",
        market_cap_rank: 207,
        market_data: {
          current_price: { usd: 1.39 },
          total_volume: { usd: 24486696 },
          market_cap: { usd: 377551881 },
          price_change_24h: 0.139789,
          price_change_percentage_24h: 11.16476
        }
      });

    nock(coinGeckoApiUrl)
      .persist()
      .get("/api/v3/coins/usd-coin")
      .reply(200, {
        id: "usd-coin",
        symbol: "usdc",
        name: "USDC",
        market_cap_rank: 7,
        market_data: {
          current_price: { usd: 0.999799 },
          total_volume: { usd: 5128684853 },
          market_cap: { usd: 61116243104 },
          price_change_24h: 0.00003746,
          price_change_percentage_24h: 0.00375
        }
      });
  });

  afterAll(() => {
    nock.cleanAll();
  });

  describe("GET /v1/market-data/{coin}", () => {
    it("returns market data for Akash Network by default", async () => {
      const response = await app.request(`/v1/market-data`);

      expect(response.status).toBe(200);
      const data = (await response.json()) as any;
      expect(data.price).toBe(1.39);
      expect(data.volume).toBe(24486696);
      expect(data.marketCap).toBe(377551881);
      expect(data.marketCapRank).toBe(207);
      expect(data.priceChange24h).toBe(0.139789);
      expect(data.priceChangePercentage24).toBe(11.16476);
    });

    [
      {
        coin: "akash-network",
        price: 1.39,
        volume: 24486696,
        marketCap: 377551881,
        marketCapRank: 207,
        priceChange24h: 0.139789,
        priceChangePercentage24: 11.16476
      },
      {
        coin: "usd-coin",
        price: 0.999799,
        volume: 5128684853,
        marketCap: 61116243104,
        marketCapRank: 7,
        priceChange24h: 0.00003746,
        priceChangePercentage24: 0.00375
      }
    ].forEach(({ coin, price, volume, marketCap, marketCapRank, priceChange24h, priceChangePercentage24 }) => {
      it(`returns market data for ${coin} when requested`, async () => {
        const response = await app.request(`/v1/market-data/${coin}`);

        expect(response.status).toBe(200);
        const data = (await response.json()) as any;
        expect(data.price).toBe(price);
        expect(data.volume).toBe(volume);
        expect(data.marketCap).toBe(marketCap);
        expect(data.marketCapRank).toBe(marketCapRank);
        expect(data.priceChange24h).toBe(priceChange24h);
        expect(data.priceChangePercentage24).toBe(priceChangePercentage24);
      });
    });

    it(`returns 400 for other coins`, async () => {
      const response = await app.request(`/v1/market-data/ethereum`);

      expect(response.status).toBe(400);
    });
  });
});
