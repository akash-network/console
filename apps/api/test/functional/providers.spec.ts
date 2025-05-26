import type { Provider, ProviderSnapshot } from "@akashnetwork/database/dbSchemas/akash";
import { ProviderAttributeSignature } from "@akashnetwork/database/dbSchemas/akash";
import subDays from "date-fns/subDays";
import map from "lodash/map";
import mcache from "memory-cache";
import nock from "nock";

import { app, initDb } from "@src/app";
import { closeConnections } from "@src/db/dbConnection";
import { AUDITOR, TRIAL_ATTRIBUTE } from "@src/deployment/config/provider.config";

import { DaySeeder } from "@test/seeders/day.seeder";
import { DeploymentSeeder } from "@test/seeders/deployment.seeder";
import { DeploymentGroupSeeder } from "@test/seeders/deployment-group.seeder";
import { LeaseSeeder } from "@test/seeders/lease.seeder";
import { ProviderSeeder } from "@test/seeders/provider.seeder";
import { ProviderSnapshotSeeder } from "@test/seeders/provider-snapshot.seeder";

describe("Providers", () => {
  let providers: Provider[];
  let providerSnapshots: ProviderSnapshot[];

  beforeAll(async () => {
    await initDb();

    providers = await Promise.all([ProviderSeeder.createInDatabase(), ProviderSeeder.createInDatabase(), ProviderSeeder.createInDatabase()]);
    providerSnapshots = await Promise.all([
      ProviderSnapshotSeeder.createInDatabase({
        owner: providers[0].owner,
        checkDate: subDays(new Date("2025-01-01T00:00:00.000Z"), 1),
        availableCPU: 1,
        availableGPU: 2,
        availableMemory: 3,
        availablePersistentStorage: 4,
        availableEphemeralStorage: 5
      }),
      ProviderSnapshotSeeder.createInDatabase({
        owner: providers[0].owner,
        checkDate: subDays(new Date("2025-01-01T00:00:00.000Z"), 2),
        availableCPU: 11,
        availableGPU: 12,
        availableMemory: 13,
        availablePersistentStorage: 14,
        availableEphemeralStorage: 15
      }),
      ProviderSnapshotSeeder.createInDatabase({
        owner: providers[1].owner,
        checkDate: subDays(new Date("2025-01-01T00:00:00.000Z"), 1),
        availableCPU: 21,
        availableGPU: 22,
        availableMemory: 23,
        availablePersistentStorage: 24,
        availableEphemeralStorage: 25
      }),
      ProviderSnapshotSeeder.createInDatabase({
        owner: providers[1].owner,
        checkDate: subDays(new Date("2025-01-01T00:00:00.000Z"), 2),
        availableCPU: 31,
        availableGPU: 32,
        availableMemory: 33,
        availablePersistentStorage: 34,
        availableEphemeralStorage: 35
      })
    ]);
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

  describe("GET /v1/providers/:address", () => {
    it("returns a provider by address", async () => {
      const response = await app.request(`/v1/providers/${providers[0].owner}`);

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.owner).toEqual(providers[0].owner);
    });

    it("returns a 404 when provider is not found", async () => {
      const response = await app.request(`/v1/providers/not-found`);

      expect(response.status).toBe(404);
    });
  });

  describe("GET /v1/providers/{providerAddress}/active-leases-graph-data", () => {
    it("returns the active leases graph data for a provider", async () => {
      const providerAddress = "akash18ga02jzaq8cw52anyhzkwta5wygufgu6zsz6xc";
      const days = [
        await DaySeeder.createInDatabase({
          date: subDays(new Date(), 2),
          firstBlockHeight: 1,
          lastBlockHeight: 100,
          lastBlockHeightYet: 100
        }),
        await DaySeeder.createInDatabase({
          date: subDays(new Date(), 1),
          firstBlockHeight: 101,
          lastBlockHeight: 200,
          lastBlockHeightYet: 200
        })
      ];
      const provider = await ProviderSeeder.createInDatabase({
        owner: providerAddress,
        createdHeight: days[0].lastBlockHeightYet - 1
      });

      const deployment = await DeploymentSeeder.createInDatabase();

      const deploymentGroup = await DeploymentGroupSeeder.createInDatabase({
        deploymentId: deployment.id
      });

      await LeaseSeeder.createInDatabase({
        providerAddress: provider.owner,
        createdHeight: days[0].lastBlockHeightYet - 1,
        closedHeight: null,
        predictedClosedHeight: days[0].lastBlockHeightYet + 1,
        deploymentId: deployment.id,
        deploymentGroupId: deploymentGroup.id,
        state: "active"
      });
      await LeaseSeeder.createInDatabase({
        providerAddress: provider.owner,
        createdHeight: days[0].lastBlockHeightYet - 1,
        closedHeight: null,
        predictedClosedHeight: days[0].lastBlockHeightYet + 1,
        deploymentId: deployment.id,
        deploymentGroupId: deploymentGroup.id,
        state: "active"
      });
      await LeaseSeeder.createInDatabase({
        providerAddress: provider.owner,
        createdHeight: days[1].lastBlockHeightYet - 1,
        closedHeight: null,
        predictedClosedHeight: days[1].lastBlockHeightYet + 1,
        deploymentId: deployment.id,
        deploymentGroupId: deploymentGroup.id,
        state: "active"
      });

      const response = await app.request(`/v1/providers/${providerAddress}/active-leases-graph-data`);

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        currentValue: 1,
        compareValue: 2,
        snapshots: [
          {
            date: days[0].date.toISOString(),
            value: 2
          },
          {
            date: days[1].date.toISOString(),
            value: 1
          }
        ],
        now: { count: 1 },
        compare: { count: 2 }
      });
    });
  });
});
