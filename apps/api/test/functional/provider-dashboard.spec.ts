import type { Provider } from "@akashnetwork/database/dbSchemas/akash";
import type { Block } from "@akashnetwork/database/dbSchemas/base/block";
import { subDays } from "date-fns";

import { app, initDb } from "@src/app";

import { BlockSeeder } from "@test/seeders/block.seeder";
import { ProviderSeeder } from "@test/seeders/provider.seeder";

describe("Provider Dashboard", () => {
  let provider: Provider;
  let blocks: Block[];

  beforeAll(async () => {
    await initDb();

    provider = await ProviderSeeder.createInDatabase();
    blocks = await Promise.all([
      BlockSeeder.createInDatabase({
        datetime: new Date().toISOString(),
        isProcessed: true,
        totalUUsdSpent: 1000,
        height: 300
      }),
      BlockSeeder.createInDatabase({
        datetime: subDays(Date.now(), 1).toISOString(),
        height: 200
      }),
      BlockSeeder.createInDatabase({
        datetime: subDays(Date.now(), 2).toISOString(),
        height: 100
      })
    ]);
  });

  describe("GET /v1/provider-dashboard/{owner}", () => {
    it("returns dashboard data for the owner", async () => {
      const response = await app.request(`/v1/provider-dashboard/${provider.owner}`);

      const data = (await response.json()) as any;

      expect(response.status).toBe(200);
      expect(data.current.date).toEqual(blocks[0].datetime.toISOString());
      expect(data.current.height).toEqual(blocks[0].height);
      expect(data.previous.date).toEqual(blocks[1].datetime.toISOString());
      expect(data.previous.height).toEqual(blocks[1].height);
    });

    it("returns 404 when provider not found", async () => {
      const nonExistentOwner = "0x1234567890abcdef1234567890abcdef12345678";
      const response = await app.request(`/v1/provider-dashboard/${nonExistentOwner}`);

      expect(response.status).toBe(404);
      const data = (await response.json()) as any;
      expect(data.message).toBe("Provider not found");
    });
  });
});
