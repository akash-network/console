import { Provider, ProviderAttribute } from "@akashnetwork/database/dbSchemas/akash";

import { app, initDb } from "@src/app";
import type { ProviderRegionsResponse } from "@src/provider/http-schemas/provider-regions.schema";

import { generateProvider } from "@test/seeders/provider.seeder";

describe("ProviderRegions", () => {
  const providerSeeds = [generateProvider(), generateProvider(), generateProvider()];

  let providers: Provider[];

  beforeAll(async () => {
    await initDb();

    providers = await Promise.all(providerSeeds.map(async provider => Provider.create(provider)));
    await ProviderAttribute.create({
      provider: providers[0].owner,
      key: "location-region",
      value: "na-ca-west"
    });
    await ProviderAttribute.create({
      provider: providers[1].owner,
      key: "location-region",
      value: "na-ca-central"
    });
    await ProviderAttribute.create({
      provider: providers[2].owner,
      key: "location-region",
      value: "na-ca-central"
    });
  });

  const expectRegion = (data: ProviderRegionsResponse, key: string, providers: string[]) => {
    const region = data.find(item => item.key === key);
    expect(region).toBeDefined();
    expect([...region.providers].sort()).toEqual([...providers].sort());
  };

  describe("GET /v1/provider-regions", () => {
    it("returns schema for provider attributes", async () => {
      const response = await app.request("/v1/provider-regions");

      const data = await response.json();

      expect(response.status).toBe(200);
      expectRegion(data, "na-ca-west", [providers[0].owner]);
      expectRegion(data, "na-ca-central", [providers[1].owner, providers[2].owner]);
      expectRegion(data, "na-ca-prairie", []);
    });
  });
});
