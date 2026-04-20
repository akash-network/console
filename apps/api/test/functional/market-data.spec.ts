import nock from "nock";
import { container } from "tsyringe";

import { CORE_CONFIG } from "@src/core";
import { app } from "@src/rest-app";

describe("Market Data", () => {
  beforeAll(async () => {
    const restApiNodeUrl = container.resolve(CORE_CONFIG).REST_API_NODE_URL;

    nock(restApiNodeUrl)
      .persist()
      .get("/cosmos/base/tendermint/v1beta1/blocks/latest")
      .reply(200, { block: { header: { height: "1000000" } } });

    nock(restApiNodeUrl)
      .persist()
      .get("/akash/oracle/v1/aggregated_price/akt")
      .query(true)
      .reply(200, { aggregated_price: { median_price: "1.5" }, price_health: { is_healthy: true } });

    nock(restApiNodeUrl)
      .persist()
      .get("/akash/oracle/v1/aggregated_price/usdc")
      .query(true)
      .reply(200, { aggregated_price: { median_price: "1.0" }, price_health: { is_healthy: true } });

    nock(restApiNodeUrl)
      .persist()
      .get("/akash/oracle/v1/prices")
      .query(q => q["filters.asset_denom"] === "akt")
      .reply(200, { prices: [{ state: { price: "1.25" } }] });

    nock(restApiNodeUrl)
      .persist()
      .get("/akash/oracle/v1/prices")
      .query(q => q["filters.asset_denom"] === "usdc")
      .reply(200, { prices: [{ state: { price: "0.5" } }] });
  });

  afterAll(() => {
    nock.cleanAll();
  });

  describe("GET /v1/market-data/{coin}", () => {
    it("returns market data for Akash Network by default", async () => {
      const response = await app.request(`/v1/market-data`);

      expect(response.status).toBe(200);
      const data = (await response.json()) as any;
      expect(data.price).toBe(1.5);
      expect(data.volume).toBe(0);
      expect(data.marketCap).toBe(0);
      expect(data.marketCapRank).toBe(0);
      expect(data.priceChange24h).toBe(0.25);
      expect(data.priceChangePercentage24).toBe(20);
    });

    [
      {
        coin: "akt",
        price: 1.5,
        volume: 0,
        marketCap: 0,
        marketCapRank: 0,
        priceChange24h: 0.25,
        priceChangePercentage24: 20
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
      const response = await app.request(`/v1/market-data/usdc`);

      expect(response.status).toBe(400);
    });
  });
});
