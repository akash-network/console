import type { ProviderSnapshot } from "@akashnetwork/database/dbSchemas/akash";
import { Provider, ProviderAttribute, ProviderAttributeSignature } from "@akashnetwork/database/dbSchemas/akash";
import subDays from "date-fns/subDays";
import map from "lodash/map";
import nock from "nock";
import { container } from "tsyringe";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { cacheEngine } from "@src/caching/helpers";
import { AUDITOR, TRIAL_ATTRIBUTE } from "@src/deployment/config/provider.config";
import type { ProviderListResponse, ProviderLocationsResponse, ProviderResponse, ProviderSearchResponse } from "@src/provider/http-schemas/provider.schema";
import { app, initDb } from "@src/rest-app";

import {
  createAkashAddress,
  createDay,
  createDeployment,
  createDeploymentGroup,
  createLease,
  createProvider,
  createProviderSeed,
  createProviderSnapshot,
  createProviderSnapshotNode,
  createProviderSnapshotNodeCpu
} from "@test/seeders";

describe("Providers", () => {
  let providers: Provider[];
  let providerSnapshots: ProviderSnapshot[];

  beforeAll(async () => {
    await initDb();

    providers = await Promise.all([createProvider(), createProvider(), createProvider()]);
    providerSnapshots = await Promise.all([
      createProviderSnapshot({
        owner: providers[0].owner,
        checkDate: subDays(new Date("2025-01-01T00:00:00.000Z"), 1),
        availableCPU: 1,
        availableGPU: 2,
        availableMemory: 3,
        availablePersistentStorage: 4,
        availableEphemeralStorage: 5
      }),
      createProviderSnapshot({
        owner: providers[0].owner,
        checkDate: subDays(new Date("2025-01-01T00:00:00.000Z"), 2),
        availableCPU: 11,
        availableGPU: 12,
        availableMemory: 13,
        availablePersistentStorage: 14,
        availableEphemeralStorage: 15
      }),
      createProviderSnapshot({
        owner: providers[1].owner,
        checkDate: subDays(new Date("2025-01-01T00:00:00.000Z"), 1),
        availableCPU: 21,
        availableGPU: 22,
        availableMemory: 23,
        availablePersistentStorage: 24,
        availableEphemeralStorage: 25
      }),
      createProviderSnapshot({
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
    await container.dispose();
    cacheEngine.clearAllKeyInCache();
  });

  afterEach(() => {
    nock.cleanAll();
  });

  const expectProviders = (providersFound: { owner: string }[], providersExpected: { owner: string }[]) => {
    expect(providersFound.length).toBe(providersExpected.length);

    const ownersFound = map(providersFound, "owner");
    providersExpected.forEach(provider => {
      expect(ownersFound).toContain(provider.owner);
    });
  };

  describe("GET /v1/providers", () => {
    it("returns all providers by default", async () => {
      const response = await app.request("/v1/providers");

      const data = (await response.json()) as ProviderListResponse;

      expect(response.status).toBe(200);
      expectProviders(data, providers);
    });

    it("returns all providers when scope=all", async () => {
      const response = await app.request("/v1/providers?scope=all");

      const data = (await response.json()) as ProviderListResponse;

      expect(response.status).toBe(200);
      expectProviders(data, providers);
    });

    it("returns trial providers when scope=trial", async () => {
      const response = await app.request("/v1/providers?scope=trial");

      const data = (await response.json()) as ProviderListResponse;

      expect(response.status).toBe(200);
      expectProviders(data, [providers[0]]);
    });

    it("returns only providers matching the addresses filter", async () => {
      const response = await app.request(`/v1/providers?addresses=${providers[0].owner},${providers[2].owner}`);

      const data = (await response.json()) as ProviderListResponse;

      expect(response.status).toBe(200);
      expectProviders(data, [providers[0], providers[2]]);
    });

    it("returns only matching trial providers when addresses and scope=trial are combined", async () => {
      const response = await app.request(`/v1/providers?scope=trial&addresses=${providers[0].owner},${providers[1].owner}`);

      const data = (await response.json()) as ProviderListResponse;

      expect(response.status).toBe(200);
      expectProviders(data, [providers[0]]);
    });

    it("returns an empty array for unknown addresses", async () => {
      const response = await app.request("/v1/providers?addresses=akash1unknown");

      const data = (await response.json()) as ProviderListResponse;

      expect(response.status).toBe(200);
      expect(data).toEqual([]);
    });

    it("returns 400 when more than 20 addresses are provided", async () => {
      const addresses = Array.from({ length: 21 }, (_, i) => `akash1addr${i}`).join(",");
      const response = await app.request(`/v1/providers?addresses=${addresses}`);

      expect(response.status).toBe(400);
    });
  });

  describe("GET /v1/provider-search", () => {
    it("answers a page of the providers matching the filters and how many matched", async () => {
      const matching = await Promise.all([createProvider({ isOnline: true }), createProvider({ isOnline: true }), createProvider({ isOnline: true })]);
      const offline = await createProvider({ isOnline: false });
      const unaudited = await Provider.create(createProviderSeed({ isOnline: true }));
      const addresses = [...matching, offline, unaudited].map(provider => provider.owner).join(",");

      const response = await app.request(`/v1/provider-search?addresses=${addresses}&online=true&audited=true&skip=1&limit=1`);

      const { data } = (await response.json()) as ProviderSearchResponse;
      expect(response.status).toBe(200);
      expect(data.pagination).toEqual({ total: 3, skip: 1, limit: 1, hasMore: true });
      expect(data.providers).toHaveLength(1);
      expect(map(matching, "owner")).toContain(data.providers[0].owner);
    });

    it("finds a provider by part of its host URI", async () => {
      const provider = await createProvider({ hostUri: "https://provider.searchable-host.example.com:8443" });

      const response = await app.request("/v1/provider-search?search=SEARCHABLE-HOST");

      const { data } = (await response.json()) as ProviderSearchResponse;
      expect(map(data.providers, "owner")).toEqual([provider.owner]);
    });

    it("orders providers by how many leases the wallet holds on them", async () => {
      const walletAddress = createAkashAddress();
      const [usedOnce, unused, usedTwice] = await Promise.all([createProvider(), createProvider(), createProvider()]);
      const deployment = await createDeployment({ owner: walletAddress });
      const deploymentGroup = await createDeploymentGroup({ deploymentId: deployment.id, owner: walletAddress });
      const leaseOf = (provider: Provider, closedHeight: number | null) =>
        createLease({
          owner: walletAddress,
          providerAddress: provider.owner,
          deploymentId: deployment.id,
          deploymentGroupId: deploymentGroup.id,
          closedHeight
        });
      await Promise.all([leaseOf(usedOnce, null), leaseOf(usedTwice, 10), leaseOf(usedTwice, 20)]);
      const addresses = [usedOnce, unused, usedTwice].map(provider => provider.owner).join(",");

      const [allLeases, activeLeases] = await Promise.all([
        app.request(`/v1/provider-search?addresses=${addresses}&sort=wallet-leases-desc&walletAddress=${walletAddress}`),
        app.request(`/v1/provider-search?addresses=${addresses}&sort=wallet-active-leases-desc&walletAddress=${walletAddress}`)
      ]);

      expect(map(((await allLeases.json()) as ProviderSearchResponse).data.providers, "owner")).toEqual([usedTwice.owner, usedOnce.owner, unused.owner]);
      expect(map(((await activeLeases.json()) as ProviderSearchResponse).data.providers, "owner")).toEqual([usedOnce.owner, unused.owner, usedTwice.owner]);
    });

    it("refuses to sort by a wallet's leases without the wallet address", async () => {
      const response = await app.request("/v1/provider-search?sort=wallet-leases-desc");

      expect(response.status).toBe(400);
    });

    it("refuses a page longer than 100 providers", async () => {
      const response = await app.request("/v1/provider-search?limit=101");

      expect(response.status).toBe(400);
    });
  });

  describe("GET /v1/provider-locations", () => {
    it("locates online providers and leaves offline ones out", async () => {
      const online = await createProvider({ isOnline: true, ipRegion: "Quebec", ipCountryCode: "CA", ipLat: "45.5", ipLon: "-73.6" });
      const offline = await createProvider({ isOnline: false });

      const response = await app.request("/v1/provider-locations");

      const { data } = (await response.json()) as ProviderLocationsResponse;
      expect(response.status).toBe(200);
      expect(data).toContainEqual({
        owner: online.owner,
        name: new URL(online.hostUri).hostname,
        hostUri: online.hostUri,
        ipRegion: "Quebec",
        ipCountryCode: "CA",
        ipLat: "45.5",
        ipLon: "-73.6"
      });
      expect(map(data, "owner")).not.toContain(offline.owner);
    });
  });

  describe("GET /v1/providers/:address", () => {
    it("returns a provider by address", async () => {
      const response = await app.request(`/v1/providers/${providers[0].owner}`);

      const data = (await response.json()) as ProviderResponse;

      expect(response.status).toBe(200);
      expect(data.owner).toEqual(providers[0].owner);
    });

    it("returns a 404 when provider is not found", async () => {
      const response = await app.request(`/v1/providers/not-found`);

      expect(response.status).toBe(404);
    });

    it("reports the architectures its nodes run and flags a declaration they contradict", async () => {
      const provider = await createProviderWithNodeCpus(["arm64", null], "x86-64");

      const response = await app.request(`/v1/providers/${provider.owner}`);

      const data = (await response.json()) as ProviderResponse;
      expect(response.status).toBe(200);
      expect(data.hardwareCpuArch).toBe("x86-64");
      expect(data.reportedCpuArchs).toEqual(["arm64"]);
      expect(data.cpuArchAgreement).toBe("mismatch");
    });

    it("agrees when the declared architecture is spelled differently from the one the nodes report", async () => {
      const provider = await createProviderWithNodeCpus(["x86_64"], "x86-64");

      const response = await app.request(`/v1/providers/${provider.owner}`);

      const data = (await response.json()) as ProviderResponse;
      expect(data.reportedCpuArchs).toEqual(["amd64"]);
      expect(data.cpuArchAgreement).toBe("match");
    });

    it("leaves the architecture unknown instead of assuming amd64 when nodes report none", async () => {
      const provider = await createProviderWithNodeCpus([null], undefined);

      const response = await app.request(`/v1/providers/${provider.owner}`);

      const data = (await response.json()) as ProviderResponse;
      expect(data.hardwareCpuArch).toBeNull();
      expect(data.reportedCpuArchs).toEqual([]);
      expect(data.cpuArchAgreement).toBe("unknown");
    });

    async function createProviderWithNodeCpus(archs: (string | null)[], declaredArch: string | undefined) {
      const provider = await createProvider();
      const snapshot = await createProviderSnapshot({ owner: provider.owner, isOnline: true });
      await provider.update({ lastSuccessfulSnapshotId: snapshot.id });
      const node = await createProviderSnapshotNode({ snapshotId: snapshot.id });
      await Promise.all(archs.map(arch => createProviderSnapshotNodeCpu({ snapshotNodeId: node.id, arch })));

      if (declaredArch) {
        await ProviderAttribute.create({ provider: provider.owner, key: "capabilities/cpu/arch", value: declaredArch });
      }

      return provider;
    }
  });

  describe("GET /v1/providers/{providerAddress}/active-leases-graph-data", () => {
    it("returns the active leases graph data for a provider", async () => {
      const providerAddress = "akash18ga02jzaq8cw52anyhzkwta5wygufgu6zsz6xc";
      const days = await Promise.all([
        createDay({
          date: subDays(new Date(), 2),
          firstBlockHeight: 1,
          lastBlockHeight: 100,
          lastBlockHeightYet: 100
        }),
        createDay({
          date: subDays(new Date(), 1),
          firstBlockHeight: 101,
          lastBlockHeight: 200,
          lastBlockHeightYet: 200
        })
      ]);
      const provider = await createProvider({
        owner: providerAddress,
        createdHeight: days[0].lastBlockHeightYet - 1
      });

      const deployment = await createDeployment();

      const deploymentGroup = await createDeploymentGroup({
        deploymentId: deployment.id
      });

      await createLease({
        providerAddress: provider.owner,
        createdHeight: days[0].lastBlockHeightYet - 1,
        closedHeight: null,
        predictedClosedHeight: days[0].lastBlockHeightYet + 1,
        deploymentId: deployment.id,
        deploymentGroupId: deploymentGroup.id,
        state: "active"
      });
      await createLease({
        providerAddress: provider.owner,
        createdHeight: days[0].lastBlockHeightYet - 1,
        closedHeight: null,
        predictedClosedHeight: days[0].lastBlockHeightYet + 1,
        deploymentId: deployment.id,
        deploymentGroupId: deploymentGroup.id,
        state: "active"
      });
      await createLease({
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
