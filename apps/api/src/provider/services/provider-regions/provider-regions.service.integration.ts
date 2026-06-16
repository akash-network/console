import "@test/setup-provider-attributes-schema";

import type { Provider } from "@akashnetwork/database/dbSchemas/akash";
import { ProviderAttribute } from "@akashnetwork/database/dbSchemas/akash";
import { container } from "tsyringe";

import { CHAIN_DB } from "@src/chain";
import { ProviderRegionsService } from "./provider-regions.service";

import { createProvider } from "@test/seeders";

describe("ProviderRegions", () => {
  let providers: Provider[];

  beforeAll(async () => {
    await container.resolve(CHAIN_DB).authenticate();
    providers = await Promise.all([createProvider(), createProvider(), createProvider()]);
    await Promise.all([
      ProviderAttribute.create({
        provider: providers[0].owner,
        key: "location-region",
        value: "na-ca-west"
      }),
      ProviderAttribute.create({
        provider: providers[1].owner,
        key: "location-region",
        value: "na-ca-central"
      }),
      ProviderAttribute.create({
        provider: providers[2].owner,
        key: "location-region",
        value: "na-ca-central"
      })
    ]);
  });

  describe("GET /v1/provider-regions", () => {
    it("returns providers grouped by regions", async () => {
      const service = container.resolve(ProviderRegionsService);
      const data = Object.groupBy(await service.getProviderRegions(), item => item.key);

      expect(data["na-ca-west"]?.[0]?.providers?.sort()).toEqual([providers[0].owner].sort());
      expect(data["na-ca-central"]?.[0]?.providers?.sort()).toEqual([providers[1].owner, providers[2].owner].sort());
      expect(data["na-ca-prairie"]?.[0]?.providers?.sort()).toEqual([]);
    });
  });
});
