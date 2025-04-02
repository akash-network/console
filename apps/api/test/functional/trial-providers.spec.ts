import { Provider, ProviderAttributeSignature, ProviderSnapshot } from "@akashnetwork/database/dbSchemas/akash";
import subDays from "date-fns/subDays";
import mcache from "memory-cache";
import nock from "nock";

import { app, initDb } from "@src/app";
import { closeConnections } from "@src/db/dbConnection";
import { AUDITOR, TRIAL_ATTRIBUTE, TRIAL_REGISTERED_ATTRIBUTE } from "@src/deployment/config/provider.config";

import { generateProvider } from "@test/seeders/provider.seeder";
import { generateProviderSnapshot } from "@test/seeders/provider-snapshot.seeder";

describe("Trial Providers", () => {
  const providerSeeds = [
    generateProvider({
      owner: "akash1rk090a6mq9gvm0h6ljf8kz8mrxglwwxsk4srxh"
    }),
    generateProvider({
      owner: "akash1d4fletej4cwn9x8jzpzmnk6zkqeh90ejjskpmu"
    }),
    generateProvider({
      owner: "akash1w3k6qpr4uz44py4z68chfrl7ltpxwtkngnc6xk"
    })
  ];
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

  beforeAll(async () => {
    await initDb();

    const providers = await Promise.all(providerSeeds.map(async provider => Provider.create(provider)));
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
    await createProviderAttributeSignature(providers[0].owner, TRIAL_REGISTERED_ATTRIBUTE);
    await createProviderAttributeSignature(providers[1].owner, TRIAL_REGISTERED_ATTRIBUTE);
    await createProviderAttributeSignature(providers[2].owner, TRIAL_REGISTERED_ATTRIBUTE);
  });

  afterAll(async () => {
    await closeConnections();
    mcache.clear();
  });

  afterEach(() => {
    nock.cleanAll();
  });

  describe("GET /v1/trial-providers", () => {
    it("returns a list of trial providers", async () => {
      const response = await app.request("/v1/trial-providers");

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        providers: [
          {
            owner: providerSeeds[0].owner,
            hostUri: providerSeeds[0].hostUri,
            availableCPU: 1,
            availableGPU: 2,
            availableMemory: 3,
            availablePersistentStorage: 4,
            availableEphemeralStorage: 5
          }
        ],
        total: {
          availableCPU: 1,
          availableGPU: 2,
          availableMemory: 3,
          availablePersistentStorage: 4,
          availableEphemeralStorage: 5
        }
      });
    });

    it("returns a list of trial-registered providers", async () => {
      const response = await app.request("/v1/trial-providers?registered=true");

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        providers: [
          {
            owner: providerSeeds[1].owner,
            hostUri: providerSeeds[1].hostUri,
            availableCPU: 21,
            availableGPU: 22,
            availableMemory: 23,
            availablePersistentStorage: 24,
            availableEphemeralStorage: 25
          },
          {
            owner: providerSeeds[0].owner,
            hostUri: providerSeeds[0].hostUri,
            availableCPU: 1,
            availableGPU: 2,
            availableMemory: 3,
            availablePersistentStorage: 4,
            availableEphemeralStorage: 5
          }
        ],
        total: {
          availableCPU: 22,
          availableGPU: 24,
          availableMemory: 26,
          availablePersistentStorage: 28,
          availableEphemeralStorage: 30
        }
      });
    });
  });
});
