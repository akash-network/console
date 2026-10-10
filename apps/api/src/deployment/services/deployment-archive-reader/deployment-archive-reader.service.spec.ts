import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AuthService } from "@src/auth/services/auth.service";
import type { DeploymentSettingRepository, ListedDeploymentSetting } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import type { FallbackDeploymentReaderService } from "@src/deployment/services/fallback-deployment-reader/fallback-deployment-reader.service";
import type { FallbackLeaseReaderService } from "@src/deployment/services/fallback-lease-reader/fallback-lease-reader.service";
import type { LeaseGpusByLease, LeaseGpuService } from "@src/deployment/services/lease-gpu/lease-gpu.service";
import { DeploymentArchiveReaderService } from "./deployment-archive-reader.service";

import { createAkashAddress } from "@test/seeders/akash-address.seeder";
import { createDeploymentInfoSeed } from "@test/seeders/deployment-info.seeder";
import { createLeaseApiResponse } from "@test/seeders/lease-api-response.seeder";

describe(DeploymentArchiveReaderService.name, () => {
  describe("list", () => {
    it("reads the page of closed deployments from the console's index in the order and at the offset asked for", async () => {
      const { service, fallbackDeploymentReaderService, owner, wallet } = setup();

      await service.list({ owner, wallet, skip: 25, limit: 10, reverse: true });

      expect(fallbackDeploymentReaderService.findClosedPage).toHaveBeenCalledWith({ owner, skip: 25, limit: 10, reverse: true, search: undefined });
    });

    it("returns the deployments of the page in the order the index gave them", async () => {
      const { service, owner, wallet } = setup({ dseqs: ["300", "200", "100"] });

      const { deployments } = await service.list({ owner, wallet, skip: 0, limit: 10, reverse: true });

      expect(deployments.map(item => item.deployment.id.dseq)).toEqual(["300", "200", "100"]);
    });

    it("answers with the count of closed deployments the index gave alongside the page", async () => {
      const { service, owner, wallet } = setup({ dseqs: ["100"], total: 62 });

      const { total } = await service.list({ owner, wallet, skip: 0, limit: 1, reverse: true });

      expect(total).toBe(62);
    });

    it("reports another page while the count reaches past the pages read so far", async () => {
      const { service, owner, wallet } = setup({ dseqs: ["100"], total: 3 });

      const { hasMore } = await service.list({ owner, wallet, skip: 1, limit: 1, reverse: true });

      expect(hasMore).toBe(true);
    });

    it("reports no further page once the pages read so far reach the count", async () => {
      const { service, owner, wallet } = setup({ dseqs: ["100"], total: 2 });

      const { hasMore } = await service.list({ owner, wallet, skip: 1, limit: 1, reverse: true });

      expect(hasMore).toBe(false);
    });

    it("reads the leases of the whole page from the index in one read", async () => {
      const { service, fallbackLeaseReaderService, owner, wallet } = setup({ dseqs: ["100", "200"] });

      await service.list({ owner, wallet, skip: 0, limit: 10, reverse: true });

      expect(fallbackLeaseReaderService.findByDeployments).toHaveBeenCalledTimes(1);
      expect(fallbackLeaseReaderService.findByDeployments).toHaveBeenCalledWith({ owner, dseqs: ["100", "200"] });
    });

    it("gives each deployment the leases the index holds for it alone, and none to one it holds no lease for", async () => {
      const owner = createAkashAddress();
      const leases = [createLeaseApiResponse({ owner, dseq: "100", gseq: 1 }), createLeaseApiResponse({ owner, dseq: "100", gseq: 2 })];
      const { service, wallet } = setup({ owner, dseqs: ["100", "200"], leases });

      const { deployments } = await service.list({ owner, wallet, skip: 0, limit: 10, reverse: true });

      expect(deployments.map(item => item.leases.map(lease => lease.id.gseq))).toEqual([[1, 2], []]);
    });

    it("attaches the gpus the console recorded to the lease they describe", async () => {
      const owner = createAkashAddress();
      const lease = createLeaseApiResponse({ owner, dseq: "100" });
      const offeredGpus = { gpus: [], recordedAt: "2026-09-21T09:00:00.000Z" };
      const leaseGpus = new Map([["100", new Map([[`${lease.lease.id.gseq}/${lease.lease.id.oseq}/${lease.lease.id.provider}`, { offeredGpus }]])]]);
      const { service, leaseGpuService, wallet } = setup({ owner, dseqs: ["100"], leases: [lease], leaseGpus });

      const { deployments } = await service.list({ owner, wallet, skip: 0, limit: 10, reverse: true });

      expect(leaseGpuService.findForDeployments).toHaveBeenCalledWith({ wallet, dseqs: ["100"] });
      expect(deployments[0].leases[0]).toMatchObject({ offeredGpus });
    });

    it("returns what the console holds about each listed deployment, read under the caller's own ability and user id", async () => {
      const { service, deploymentSettingRepository, scopedDeploymentSettingRepository, authService, owner, wallet } = setup({
        dseqs: ["100", "200"],
        settings: { "100": { name: "web" } }
      });

      const { deployments } = await service.list({ owner, wallet, skip: 0, limit: 10, reverse: true });

      expect(deploymentSettingRepository.accessibleBy).toHaveBeenCalledWith(authService.ability, "read");
      expect(scopedDeploymentSettingRepository.findListedSettings).toHaveBeenCalledWith({ wallet, dseqs: ["100", "200"] });
      expect(deployments.map(item => item.name)).toEqual(["web", null]);
      expect(deployments[0].settings).toMatchObject({ name: "web" });
      expect(deployments[1].settings).toBeNull();
    });

    it("reads no names to search by when the caller searches for nothing", async () => {
      const { service, scopedDeploymentSettingRepository, owner, wallet } = setup();

      await service.list({ owner, wallet, skip: 0, limit: 10, reverse: true });

      expect(scopedDeploymentSettingRepository.findDseqsByNameContaining).not.toHaveBeenCalled();
    });

    it("looks the search up among the names of the caller's own deployments, under their ability, whatever case it was typed in", async () => {
      const { service, deploymentSettingRepository, scopedDeploymentSettingRepository, authService, owner, wallet } = setup();

      await service.list({ owner, wallet, skip: 0, limit: 10, reverse: true, search: "WeB" });

      expect(deploymentSettingRepository.accessibleBy.mock.calls).toEqual([
        [authService.ability, "read"],
        [authService.ability, "read"]
      ]);
      expect(scopedDeploymentSettingRepository.findDseqsByNameContaining).toHaveBeenCalledWith({ wallet, text: "web" });
    });

    it("asks the index for the closed deployments whose dseq contains the search or whose name matched it", async () => {
      const { service, fallbackDeploymentReaderService, owner, wallet } = setup({ namedDseqs: ["123", "456"] });

      await service.list({ owner, wallet, skip: 0, limit: 10, reverse: false, search: "WeB" });

      expect(fallbackDeploymentReaderService.findClosedPage).toHaveBeenCalledWith({
        owner,
        skip: 0,
        limit: 10,
        reverse: false,
        search: { dseqContaining: "web", dseqs: ["123", "456"] }
      });
    });
  });

  function setup(
    input: {
      owner?: string;
      dseqs?: string[];
      total?: number;
      leases?: ReturnType<typeof createLeaseApiResponse>[];
      settings?: Record<string, Partial<ListedDeploymentSetting>>;
      namedDseqs?: string[];
      leaseGpus?: Map<string, LeaseGpusByLease>;
    } = {}
  ) {
    const owner = input.owner ?? createAkashAddress();
    const wallet = { userId: "user-id", organizationId: null };
    const dseqs = input.dseqs ?? [];
    const fallbackDeploymentReaderService = mock<FallbackDeploymentReaderService>({
      findClosedPage: vi.fn().mockResolvedValue({
        deployments: dseqs.map(dseq => createDeploymentInfoSeed({ owner, dseq, state: "closed" })),
        total: input.total ?? dseqs.length
      })
    });
    const fallbackLeaseReaderService = mock<FallbackLeaseReaderService>({
      findByDeployments: vi.fn().mockResolvedValue(input.leases ?? [])
    });
    const scopedDeploymentSettingRepository = mock<DeploymentSettingRepository>({
      findListedSettings: vi
        .fn()
        .mockResolvedValue(
          new Map(
            Object.entries(input.settings ?? {}).map(([dseq, setting]) => [
              dseq,
              { name: null, closed: true, runtimeLimitHours: null, runtimeEndsAt: null, ...setting }
            ])
          )
        ),
      findDseqsByNameContaining: vi.fn().mockResolvedValue(input.namedDseqs ?? [])
    });
    const deploymentSettingRepository = mock<DeploymentSettingRepository>({
      accessibleBy: vi.fn().mockReturnValue(scopedDeploymentSettingRepository)
    });
    const authService = mock<AuthService>({ ability: mock<AuthService["ability"]>() });
    const leaseGpuService = mock<LeaseGpuService>({ findForDeployments: vi.fn().mockResolvedValue(input.leaseGpus ?? new Map()) });

    const service = new DeploymentArchiveReaderService(
      fallbackDeploymentReaderService,
      fallbackLeaseReaderService,
      deploymentSettingRepository,
      authService,
      leaseGpuService
    );

    return {
      service,
      owner,
      wallet,
      fallbackDeploymentReaderService,
      fallbackLeaseReaderService,
      deploymentSettingRepository,
      scopedDeploymentSettingRepository,
      authService,
      leaseGpuService
    };
  }
});
