import "@test/setup-functional-n-integration-tests"; // eslint-disable-line simple-import-sort/imports

import type { Provider } from "@akashnetwork/database/dbSchemas/akash";
import type { Block } from "@akashnetwork/database/dbSchemas/base";
import { subDays } from "date-fns";

import { createAkashBlock, createProvider } from "@test/seeders";
import { CHAIN_DB } from "@src/chain";
import { ProviderDashboardService } from "./provider-dashboard.service";
import { container } from "tsyringe";

describe("Provider Dashboard", () => {
  let provider: Provider;
  let blocks: Block[];

  beforeAll(async () => {
    await container.resolve(CHAIN_DB).authenticate();

    provider = await createProvider();
    blocks = await Promise.all([
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

  describe("GET /v1/provider-dashboard/{owner}", () => {
    it("returns dashboard data for the owner", async () => {
      const service = setup();
      const data = await service.getProviderDashboard(provider.owner);

      expect(data.current.date).toEqual(blocks[0].datetime.toISOString());
      expect(data.current.height).toEqual(blocks[0].height);
      expect(data.previous.date).toEqual(blocks[1].datetime.toISOString());
      expect(data.previous.height).toEqual(blocks[1].height);
    });

    it("returns 404 when provider not found", async () => {
      const service = setup();

      await expect(service.getProviderDashboard("0x1234567890abcdef1234567890abcdef12345678")).rejects.toThrow("Provider not found");
    });

    function setup() {
      return new ProviderDashboardService();
    }
  });
});
