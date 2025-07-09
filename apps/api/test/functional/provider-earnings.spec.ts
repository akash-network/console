import type { Provider } from "@akashnetwork/database/dbSchemas/akash";
import { format, subDays } from "date-fns";
import mcache from "memory-cache";
import nock from "nock";

import { app, initDb } from "@src/app";
import { closeConnections } from "@src/db/dbConnection";

import { createAkashBlock, createProvider } from "@test/seeders";

describe("Provider Earnings API", () => {
  let provider: Provider;

  beforeAll(async () => {
    await initDb();

    provider = await createProvider();
    await Promise.all([
      createAkashBlock({
        datetime: new Date().toISOString(),
        isProcessed: true,
        totalUUsdSpent: 1000,
        height: 300
      }),
      createAkashBlock({
        datetime: subDays(Date.now(), 1).toISOString(),
        height: 200
      }),
      createAkashBlock({
        datetime: subDays(Date.now(), 2).toISOString(),
        height: 100
      })
    ]);
  });

  afterAll(async () => {
    await closeConnections();
    mcache.clear();
  });

  afterEach(() => {
    nock.cleanAll();
  });

  describe("GET /internal/provider-earnings/{owner}?from=YYYY-MM-DD&to=YYYY-MM-DD", () => {
    it("should return earnings for a valid provider and date range", async () => {
      const from = format(subDays(Date.now(), 2), "yyyy-MM-dd");
      const to = format(subDays(Date.now(), 1), "yyyy-MM-dd");

      const response = await app.request(`/internal/provider-earnings/${provider.owner}?from=${from}&to=${to}`);

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty("earnings");
      expect(data.earnings).toHaveProperty("totalUAktEarned");
      expect(data.earnings).toHaveProperty("totalUUsdcEarned");
      expect(data.earnings).toHaveProperty("totalUUsdEarned");
    });

    it("should return 404 for an invalid provider", async () => {
      const nonExistentOwner = "0x1234567890abcdef1234567890abcdef12345678";
      const from = "2023-01-01";
      const to = "2023-02-01";

      const res = await app.request(`/internal/provider-earnings/${nonExistentOwner}?from=${from}&to=${to}`);
      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.message).toBe("Provider not found");
    });

    it("should return 400 for invalid date format", async () => {
      const res = await app.request(`/internal/provider-earnings/${provider.owner}?from=bad-date&to=bad-date`);
      expect(res.status).toBe(400);
    });

    it("should return 400 if required params are missing", async () => {
      const res = await app.request(`/internal/provider-earnings/${provider.owner}`);
      expect(res.status).toBe(400);
    });
  });
});
