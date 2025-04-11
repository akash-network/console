import { ProviderAttributeSignature, ProviderSnapshot } from "@akashnetwork/database/dbSchemas/akash";
import subDays from "date-fns/subDays";
import mcache from "memory-cache";
import nock from "nock";

import { app, initDb } from "@src/app";
import { closeConnections } from "@src/db/dbConnection";
import { AUDITOR, TRIAL_ATTRIBUTE, TRIAL_REGISTERED_ATTRIBUTE } from "@src/deployment/config/provider.config";

const createProviderSnapshot = async (
  owner: string,
  daysAgo: number,
  availableCPU: number,
  availableGPU: number,
  availableMemory: number,
  availablePersistentStorage: number,
  availableEphemeralStorage: number
) => {
  await ProviderSnapshot.create({
    owner,
    checkDate: subDays(new Date("2025-01-01T00:00:00.000Z"), daysAgo),
    isOnline: true,
    availableCPU,
    availableGPU,
    availableMemory,
    availablePersistentStorage,
    availableEphemeralStorage
  });
};

describe("Trial Providers", () => {
  const provider1 = "akash1rk090a6mq9gvm0h6ljf8kz8mrxglwwxsk4srxh";
  const provider2 = "akash1d4fletej4cwn9x8jzpzmnk6zkqeh90ejjskpmu";

  beforeAll(async () => {
    await expect.getState().dbService.copyIndexerTables(["providerAttributeSignature", "provider"]);

    await createProviderSnapshot(provider1, 1, 1, 2, 3, 4, 5);
    await createProviderSnapshot(provider1, 2, 11, 12, 13, 14, 15);
    await createProviderSnapshot(provider2, 1, 21, 22, 23, 24, 25);
    await createProviderSnapshot(provider2, 2, 31, 32, 33, 34, 35);

    await initDb();
  }, 120_000);

  afterAll(async () => {
    await closeConnections();
    mcache.clear();
  });

  afterEach(() => {
    nock.cleanAll();
  });

  describe("GET /v1/trial-providers", () => {
    it("returns a list of trial providers", async () => {
      await ProviderAttributeSignature.create({
        provider: provider1,
        auditor: AUDITOR,
        key: TRIAL_ATTRIBUTE,
        value: "true"
      });

      const response = await app.request("/v1/trial-providers");

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        providers: [
          {
            owner: provider1,
            hostUri: "https://provider.provider-02.sandbox-01.aksh.pw:8443",
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
      await ProviderAttributeSignature.create({
        provider: provider1,
        auditor: AUDITOR,
        key: TRIAL_REGISTERED_ATTRIBUTE,
        value: "true"
      });
      await ProviderAttributeSignature.create({
        provider: provider2,
        auditor: AUDITOR,
        key: TRIAL_REGISTERED_ATTRIBUTE,
        value: "true"
      });

      const response = await app.request("/v1/trial-providers?registered=true");

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        providers: [
          {
            owner: provider2,
            hostUri: "https://provider.europlots-sandbox.com:8443",
            availableCPU: 21,
            availableGPU: 22,
            availableMemory: 23,
            availablePersistentStorage: 24,
            availableEphemeralStorage: 25
          },
          {
            owner: provider1,
            hostUri: "https://provider.provider-02.sandbox-01.aksh.pw:8443",
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
