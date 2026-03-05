import type { Provider } from "@akashnetwork/database/dbSchemas/akash";
import { container } from "tsyringe";

import { CHAIN_DB } from "@src/chain";
import { PROVIDER_CONFIG } from "@src/provider/providers/config.provider";
import { ProviderVersionsService } from "./provider-versions.service";

import { createProvider, createProviderSnapshot } from "@test/seeders";

describe("Provider Dashboard", () => {
  let providers: Provider[];

  beforeAll(async () => {
    await container.resolve(CHAIN_DB).authenticate();
    providers = await Promise.all([
      createProvider({
        akashVersion: "1.0.0",
        isOnline: true
      }),
      createProvider({
        akashVersion: "2.0.0",
        isOnline: true
      }),
      createProvider({
        akashVersion: "1.0.0",
        isOnline: true
      }),
      createProvider({
        akashVersion: "3.0.0",
        isOnline: true
      }),
      createProvider({
        akashVersion: null,
        isOnline: true
      })
    ]);

    const providerSnapshots = await Promise.all([
      createProviderSnapshot({
        owner: providers[0].owner,
        checkDate: Date.now()
      }),
      createProviderSnapshot({
        owner: providers[1].owner,
        checkDate: Date.now()
      }),
      createProviderSnapshot({
        owner: providers[2].owner,
        checkDate: Date.now()
      }),
      createProviderSnapshot({
        owner: providers[3].owner,
        checkDate: Date.now()
      }),
      createProviderSnapshot({
        owner: providers[4].owner,
        checkDate: Date.now()
      })
    ]);

    await providers[4].update({
      akashVersion: null
    });

    await Promise.all(
      providers.map((provider, index) =>
        provider.update({
          lastSuccessfulSnapshotId: providerSnapshots[index].id
        })
      )
    );
  });

  describe("GET /v1/provider-versions", () => {
    it("returns providers grouped by akash version", async () => {
      const service = setup();
      const data = await service.getProviderVersions();
      const getUri = (provider: Provider) => provider.hostUri;

      expect(data["1.0.0"]).toEqual(
        expect.objectContaining({ count: 2, ratio: 0.4, providers: expect.arrayContaining([providers[0], providers[2]].map(getUri)) })
      );
      expect(data["2.0.0"]).toEqual(expect.objectContaining({ count: 1, ratio: 0.2, providers: [providers[1]].map(getUri) }));
      expect(data["3.0.0"]).toEqual(expect.objectContaining({ count: 1, ratio: 0.2, providers: [providers[3]].map(getUri) }));
      expect(data["<UNKNOWN>"]).toEqual(expect.objectContaining({ count: 1, ratio: 0.2, providers: [providers[4]].map(getUri) }));
    });
  });

  function setup() {
    return new ProviderVersionsService(container.resolve(CHAIN_DB), container.resolve(PROVIDER_CONFIG));
  }
});
