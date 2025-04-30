import { Provider, ProviderAttributeSignature, ProviderSnapshot } from "@akashnetwork/database/dbSchemas/akash";
import subDays from "date-fns/subDays";
import map from "lodash/map";
import mcache from "memory-cache";
import nock from "nock";

import { app, initDb } from "@src/app";
import { closeConnections } from "@src/db/dbConnection";
import { AUDITOR, TRIAL_ATTRIBUTE } from "@src/deployment/config/provider.config";

import { generateProvider } from "@test/seeders/provider.seeder";
import { generateProviderSnapshot } from "@test/seeders/provider-snapshot.seeder";

describe("Providers", () => {
  const providerSeeds = [generateProvider(), generateProvider(), generateProvider()];
  const providerSnapshotSeeds = [
    generateProviderSnapshot({
      owner: providerSeeds[0].owner,
      checkDate: subDays(new Date("2025-01-01T00:00:00.000Z"), 1),
      availableCPU: 1,
      availableGPU: 2,
      availableMemory: 3,
      availablePersistentStorage: 4,
      availableEphemeralStorage: 5
    }),
    generateProviderSnapshot({
      owner: providerSeeds[0].owner,
      checkDate: subDays(new Date("2025-01-01T00:00:00.000Z"), 2),
      availableCPU: 11,
      availableGPU: 12,
      availableMemory: 13,
      availablePersistentStorage: 14,
      availableEphemeralStorage: 15
    }),
    generateProviderSnapshot({
      owner: providerSeeds[1].owner,
      checkDate: subDays(new Date("2025-01-01T00:00:00.000Z"), 1),
      availableCPU: 21,
      availableGPU: 22,
      availableMemory: 23,
      availablePersistentStorage: 24,
      availableEphemeralStorage: 25
    }),
    generateProviderSnapshot({
      owner: providerSeeds[1].owner,
      checkDate: subDays(new Date("2025-01-01T00:00:00.000Z"), 2),
      availableCPU: 31,
      availableGPU: 32,
      availableMemory: 33,
      availablePersistentStorage: 34,
      availableEphemeralStorage: 35
    })
  ];

  let providers: Provider[];

  beforeAll(async () => {
    await initDb();

    providers = await Promise.all(providerSeeds.map(async provider => Provider.create(provider)));
    const providerSnapshots = await Promise.all(providerSnapshotSeeds.map(async providerSnapshot => ProviderSnapshot.create(providerSnapshot)));

    providers[0].update({
      lastSuccessfulSnapshotId: providerSnapshots[0].id
    });
    providers[1].update({
      lastSuccessfulSnapshotId: providerSnapshots[2].id
    });

    const createProviderAttributeSignature = async (provider: string, key: string) => {
      return await ProviderAttributeSignature.create({
        provider,
        auditor: AUDITOR,
        key,
        value: "true"
      });
    };

    await createProviderAttributeSignature(providers[0].owner, TRIAL_ATTRIBUTE);
  });

  afterAll(async () => {
    await closeConnections();
    mcache.clear();
  });

  afterEach(() => {
    nock.cleanAll();
  });

  const expectProviders = (providersFound: Provider[], providersExpected: Provider[]) => {
    expect(providersFound.length).toBe(providersExpected.length);

    const ownersFound = map(providersFound, "owner");
    providersExpected.forEach(provider => {
      expect(ownersFound).toContain(provider.owner);
    });
  };

  describe("GET /v1/providers", () => {
    it("returns all providers by default", async () => {
      const response = await app.request("/v1/providers");

      const data = await response.json();

      expect(response.status).toBe(200);
      expectProviders(data, providers);
    });

    it("returns all providers when scope=all", async () => {
      const response = await app.request("/v1/providers?scope=all");

      const data = await response.json();

      expect(response.status).toBe(200);
      expectProviders(data, providers);
    });

    it("returns trial providers when scope=trial", async () => {
      const response = await app.request("/v1/providers?scope=trial");

      const data = await response.json();

      expect(response.status).toBe(200);
      expectProviders(data, [providers[0]]);
    });
  });
});
