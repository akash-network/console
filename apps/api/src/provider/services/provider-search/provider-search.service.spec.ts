import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { LeaseRepository, ProviderLeaseCount } from "@src/deployment/repositories/lease/lease.repository";
import type { ProviderSearchQuery } from "@src/provider/http-schemas/provider.schema";
import type { ProviderService } from "@src/provider/services/provider/provider.service";
import type { ProviderList } from "@src/types/provider";
import { ProviderSearchService } from "./provider-search.service";

import { createAkashAddress } from "@test/seeders/akash-address.seeder";

describe(ProviderSearchService.name, () => {
  describe("search", () => {
    it("answers the requested page of the matching providers and how many matched", async () => {
      const providers = [5, 4, 3, 2, 1].map(leaseCount => createProviderListItem({ leaseCount }));
      const { service } = setup({ providers });

      const result = await service.search(createQuery({ skip: 2, limit: 2 }));

      expect(result).toEqual({ providers: [providers[2], providers[3]], total: 5 });
    });

    it("keeps only online providers when asked for online ones", async () => {
      const online = createProviderListItem({ isOnline: true });
      const { service } = setup({ providers: [online, createProviderListItem({ isOnline: false })] });

      const result = await service.search(createQuery({ online: true }));

      expect(result.providers).toEqual([online]);
    });

    it("keeps only offline providers when asked for providers that are not online", async () => {
      const offline = createProviderListItem({ isOnline: false });
      const { service } = setup({ providers: [createProviderListItem({ isOnline: true }), offline] });

      const result = await service.search(createQuery({ online: false }));

      expect(result.providers).toEqual([offline]);
    });

    it("keeps only audited providers when asked for audited ones", async () => {
      const audited = createProviderListItem({ isAudited: true });
      const { service } = setup({ providers: [createProviderListItem({ isAudited: false }), audited] });

      const result = await service.search(createQuery({ audited: true }));

      expect(result.providers).toEqual([audited]);
    });

    it("limits the search to the given addresses", async () => {
      const favorite = createProviderListItem();
      const { service } = setup({ providers: [createProviderListItem(), favorite, createProviderListItem()] });

      const result = await service.search(createQuery({ addresses: [favorite.owner, createAkashAddress()] }));

      expect(result).toEqual({ providers: [favorite], total: 1 });
    });

    it("keeps only providers in one of the given regions", async () => {
      const inEurope = createProviderListItem({ locationRegion: "eu-central" });
      const inUsWest = createProviderListItem({ locationRegion: "na-us-west" });
      const { service } = setup({
        providers: [inEurope, createProviderListItem({ locationRegion: "as-southeast" }), createProviderListItem({ locationRegion: null }), inUsWest]
      });

      const result = await service.search(createQuery({ regions: ["eu-central", "na-us-west"] }));

      expect(result).toEqual({ providers: [inEurope, inUsWest], total: 2 });
    });

    it("keeps only providers with GPUs when asked for GPU providers", async () => {
      const withGpus = createProviderListItem({ gpu: { available: 0, pending: 0, active: 2 } });
      const { service } = setup({ providers: [createProviderListItem(), withGpus] });

      const result = await service.search(createQuery({ gpu: true }));

      expect(result.providers).toEqual([withGpus]);
    });

    it("keeps only providers without GPUs when asked for providers that have none", async () => {
      const cpuOnly = createProviderListItem();
      const { service } = setup({ providers: [createProviderListItem({ gpu: { available: 1, pending: 0, active: 0 } }), cpuOnly] });

      const result = await service.search(createQuery({ gpu: false }));

      expect(result.providers).toEqual([cpuOnly]);
    });

    it("keeps providers with any of the given GPU models, ignoring case", async () => {
      const withH100 = createProviderListItem({ gpuModels: [createGpuModel("h100"), createGpuModel("t4")] });
      const withA100 = createProviderListItem({ gpuModels: [createGpuModel("A100")] });
      const { service } = setup({
        providers: [withH100, createProviderListItem({ gpuModels: [createGpuModel("rtx4090")] }), createProviderListItem(), withA100]
      });

      const result = await service.search(createQuery({ gpuModels: ["H100", "a100"] }));

      expect(result.providers).toEqual([withH100, withA100]);
    });

    it("matches the search term against the host URI and the address, ignoring case", async () => {
      const byHost = createProviderListItem({ hostUri: "https://Provider.Europlots.com:8443" });
      const byAddress = createProviderListItem({ owner: "akash1europlotsowner" });
      const { service } = setup({ providers: [byHost, createProviderListItem({ hostUri: "https://other.example.com:8443" }), byAddress] });

      const result = await service.search(createQuery({ search: "EUROPLOTS" }));

      expect(result.providers).toEqual([byHost, byAddress]);
    });

    it("orders providers by their active lease count, most first", async () => {
      const [few, many, none] = [
        createProviderListItem({ leaseCount: 2 }),
        createProviderListItem({ leaseCount: 9 }),
        createProviderListItem({ leaseCount: null })
      ];
      const { service } = setup({ providers: [few, many, none] });

      const result = await service.search(createQuery({ sort: "active-leases-desc" }));

      expect(result.providers).toEqual([many, few, none]);
    });

    it("orders providers by their active lease count, fewest first", async () => {
      const [few, many, none] = [
        createProviderListItem({ leaseCount: 2 }),
        createProviderListItem({ leaseCount: 9 }),
        createProviderListItem({ leaseCount: null })
      ];
      const { service } = setup({ providers: [few, many, none] });

      const result = await service.search(createQuery({ sort: "active-leases-asc" }));

      expect(result.providers).toEqual([none, few, many]);
    });

    it("orders providers by their GPUs, counting available, pending and active ones", async () => {
      const idle = createProviderListItem({ gpu: { available: 4, pending: 0, active: 0 } });
      const busy = createProviderListItem({ gpu: { available: 1, pending: 2, active: 3 } });
      const cpuOnly = createProviderListItem({ gpu: { available: 0, pending: 0, active: 0 } });
      const { service } = setup({ providers: [idle, cpuOnly, busy] });

      const result = await service.search(createQuery({ sort: "gpus-desc" }));

      expect(result.providers).toEqual([busy, idle, cpuOnly]);
    });

    it("orders providers by how many leases the wallet holds on them", async () => {
      const walletAddress = createAkashAddress();
      const [unused, usedOnce, usedOften] = [createProviderListItem(), createProviderListItem(), createProviderListItem()];
      const { service, leaseRepository } = setup({
        providers: [unused, usedOnce, usedOften],
        walletLeaseCounts: [
          { providerAddress: usedOnce.owner, leaseCount: 1, activeLeaseCount: 1 },
          { providerAddress: usedOften.owner, leaseCount: 7, activeLeaseCount: 0 }
        ]
      });

      const result = await service.search(createQuery({ sort: "wallet-leases-desc", walletAddress }));

      expect(result.providers).toEqual([usedOften, usedOnce, unused]);
      expect(leaseRepository.countLeasesPerProvider).toHaveBeenCalledExactlyOnceWith(walletAddress);
    });

    it("orders providers by how many active leases the wallet holds on them", async () => {
      const [unused, usedOnce, usedOften] = [createProviderListItem(), createProviderListItem(), createProviderListItem()];
      const { service } = setup({
        providers: [unused, usedOften, usedOnce],
        walletLeaseCounts: [
          { providerAddress: usedOnce.owner, leaseCount: 1, activeLeaseCount: 1 },
          { providerAddress: usedOften.owner, leaseCount: 7, activeLeaseCount: 0 }
        ]
      });

      const result = await service.search(createQuery({ sort: "wallet-active-leases-desc", walletAddress: createAkashAddress() }));

      expect(result.providers).toEqual([usedOnce, unused, usedOften]);
    });

    it("counts no wallet lease for a sort that does not use them", async () => {
      const { service, leaseRepository } = setup({ providers: [createProviderListItem()] });

      await service.search(createQuery({ sort: "active-leases-desc", walletAddress: createAkashAddress() }));

      expect(leaseRepository.countLeasesPerProvider).not.toHaveBeenCalled();
    });

    it("keeps the cached order among providers that tie", async () => {
      const providers = [createProviderListItem({ leaseCount: 1 }), createProviderListItem({ leaseCount: 1 }), createProviderListItem({ leaseCount: 1 })];
      const { service } = setup({ providers });

      const result = await service.search(createQuery({ sort: "active-leases-desc" }));

      expect(result.providers).toEqual(providers);
    });

    it("leaves the cached provider list as it was", async () => {
      const providers = [createProviderListItem({ leaseCount: 1 }), createProviderListItem({ leaseCount: 9 })];
      const cachedOrder = [...providers];
      const { service } = setup({ providers });

      await service.search(createQuery({ sort: "active-leases-desc" }));

      expect(providers).toEqual(cachedOrder);
    });

    it("reads the provider list the providers route caches", async () => {
      const { service, providerService } = setup({ providers: [] });

      await service.search(createQuery());

      expect(providerService.getProviderList).toHaveBeenCalledExactlyOnceWith(false);
    });
  });

  describe("findOnlineLocations", () => {
    it("locates every online provider and none that is offline", async () => {
      const stats = createStats();
      const online = Object.assign(mock<ProviderList>(), {
        owner: createAkashAddress(),
        name: "provider.example.com",
        hostUri: "https://provider.example.com:8443",
        isOnline: true,
        ipRegion: "Quebec",
        ipCountryCode: "CA",
        ipLat: "45.5",
        ipLon: "-73.6",
        isAudited: true,
        locationRegion: "na-ca-central",
        uptime30d: 0.995,
        gpuModels: [createGpuModel("h100"), createGpuModel("h100", { ram: "94Gi" }), createGpuModel("a100")],
        stats
      });
      const { service, providerService } = setup({ providers: [online, createProviderListItem({ isOnline: false })] });

      const locations = await service.findOnlineLocations();

      expect(locations).toEqual([
        {
          owner: online.owner,
          name: "provider.example.com",
          hostUri: "https://provider.example.com:8443",
          ipRegion: "Quebec",
          ipCountryCode: "CA",
          ipLat: "45.5",
          ipLon: "-73.6",
          isAudited: true,
          locationRegion: "na-ca-central",
          uptime30d: 0.995,
          gpuModels: ["h100", "a100"],
          stats
        }
      ]);
      expect(providerService.getProviderList).toHaveBeenCalledExactlyOnceWith(false);
    });
  });

  function createGpuModel(model: string, overrides: Partial<ProviderList["gpuModels"][number]> = {}): ProviderList["gpuModels"][number] {
    return { vendor: "nvidia", model, ram: "80Gi", interface: "SXM", ...overrides };
  }

  function createStats(): ProviderList["stats"] {
    const item = (total: number) => ({ active: 1, available: total - 1, pending: 0, total });
    return {
      cpu: item(64000),
      gpu: item(8),
      memory: item(512),
      storage: { ephemeral: item(1024), persistent: item(2048), total: item(3072) }
    };
  }

  function createQuery(overrides: Partial<ProviderSearchQuery> = {}): ProviderSearchQuery {
    return { sort: "active-leases-desc", skip: 0, limit: 100, ...overrides };
  }

  function createProviderListItem(
    overrides: Partial<Omit<ProviderList, "stats">> & { gpu?: { available: number; pending: number; active: number } } = {}
  ): ProviderList {
    const { gpu = { available: 0, pending: 0, active: 0 }, ...fields } = overrides;
    const owner = fields.owner ?? createAkashAddress();
    return mock<ProviderList>({
      owner,
      hostUri: `https://${owner}.example.com:8443`,
      isOnline: true,
      isAudited: true,
      leaseCount: 0,
      locationRegion: null,
      gpuModels: [],
      stats: mock<ProviderList["stats"]>({ gpu: { ...gpu, total: gpu.available + gpu.pending + gpu.active } }),
      ...fields
    });
  }

  function setup(input: { providers: ProviderList[]; walletLeaseCounts?: ProviderLeaseCount[] }) {
    const providerService = mock<ProviderService>({ getProviderList: vi.fn().mockResolvedValue(input.providers) });
    const leaseRepository = mock<LeaseRepository>({ countLeasesPerProvider: vi.fn().mockResolvedValue(input.walletLeaseCounts ?? []) });
    const service = new ProviderSearchService(providerService, leaseRepository);

    return { service, providerService, leaseRepository };
  }
});
