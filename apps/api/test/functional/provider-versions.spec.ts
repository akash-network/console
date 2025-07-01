import type { Provider } from "@akashnetwork/database/dbSchemas/akash";

import { app, initDb } from "@src/app";

import { createProvider, createProviderSnapshot } from "@test/seeders";

describe("Provider Dashboard", () => {
  let providers: Provider[];

  beforeAll(async () => {
    await initDb();

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

  const expectVersion = (data: any, { version, count, ratio, providers }: { version: string; count: number; ratio: number; providers: Provider[] }) => {
    expect(data[version].count).toEqual(count);
    expect(data[version].ratio).toEqual(ratio);
    expect(data[version].providers.sort()).toEqual(providers.map(provider => provider.hostUri).sort());
  };

  describe("GET /v1/provider-versions", () => {
    it("returns providers grouped by akash version", async () => {
      const response = await app.request("/v1/provider-versions");

      const data = await response.json();

      expect(response.status).toBe(200);
      expectVersion(data, { version: "1.0.0", count: 2, ratio: 0.4, providers: [providers[0], providers[2]] });
      expectVersion(data, { version: "2.0.0", count: 1, ratio: 0.2, providers: [providers[1]] });
      expectVersion(data, { version: "3.0.0", count: 1, ratio: 0.2, providers: [providers[3]] });
      expectVersion(data, { version: "<UNKNOWN>", count: 1, ratio: 0.2, providers: [providers[4]] });
    });
  });
});
