import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AuthService } from "@src/auth/services/auth.service";
import type { CreateLogger } from "@src/core";
import type { LeaseGpuOffer, LeaseGpuReading } from "@src/deployment/model-schemas";
import type { DeploymentSettingRepository, StoredLeaseGpus } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import { buildGpuCatalogIndex } from "@src/gpu/lib/gpu-model-resolver/gpu-model-resolver";
import type { GpuCatalogService } from "@src/gpu/services/gpu-catalog/gpu-catalog.service";
import { GpuFormattingService } from "@src/gpu/services/gpu-formatting/gpu-formatting.service";
import type { ProviderConfigGpusType } from "@src/types/gpu";
import { LeaseGpuService } from "./lease-gpu.service";

import { createLeaseGpuOffer } from "@test/seeders/lease-gpu-offer.seeder";
import { createLeaseGpuReading } from "@test/seeders/lease-gpu-reading.seeder";

const CATALOG: ProviderConfigGpusType = {
  "10de": { name: "nvidia", devices: { "2330": { name: "h100", memory_size: "80Gi", interface: "SXM5" } } }
};

const DSEQ = "12345";
const PROVIDER = "akash1provider";

function reading(overrides: Partial<LeaseGpuReading> = {}): LeaseGpuReading {
  return createLeaseGpuReading({ provider: PROVIDER, ...overrides });
}

describe(LeaseGpuService.name, () => {
  it("resolves a reading to the catalog model and its branded label", async () => {
    const { service } = setup({ readings: [reading()] });

    const byDeployment = await service.findForDeployments({ userId: "user-1", dseqs: [DSEQ] });

    expect(byDeployment.get(DSEQ)?.get(`1/1/${PROVIDER}`)?.detectedGpus).toEqual({
      services: [{ service: "web", gpus: [{ vendor: "nvidia", model: "h100", displayName: "H100", memoryMb: 81559, interface: "sxm", count: 1 }] }],
      driverVersion: "550.54.15",
      detectedAt: "2026-09-21T10:00:00.000Z"
    });
  });

  it("shows an unlisted card by what its driver called it", async () => {
    const { service } = setup({ readings: [reading({ gpus: [{ rawName: "Some Future Card", pciDeviceId: null, memoryMb: 1024, count: 2 }] })] });

    const detected = (await service.findForDeployments({ userId: "user-1", dseqs: [DSEQ] })).get(DSEQ)?.get(`1/1/${PROVIDER}`)?.detectedGpus;

    expect(detected?.services[0].gpus[0]).toEqual({
      vendor: null,
      model: null,
      displayName: "Some Future Card",
      memoryMb: 1024,
      interface: null,
      count: 2
    });
  });

  it("trims a driver string long enough to wreck a layout", async () => {
    const rawName = "X".repeat(120);
    const { service } = setup({ readings: [reading({ gpus: [{ rawName, pciDeviceId: null, memoryMb: 0, count: 1 }] })] });

    const detected = (await service.findForDeployments({ userId: "user-1", dseqs: [DSEQ] })).get(DSEQ)?.get(`1/1/${PROVIDER}`)?.detectedGpus;

    expect(detected?.services[0].gpus[0].displayName).toHaveLength(48);
  });

  it("groups every service of one lease under that lease, in name order whatever order they were stored in", async () => {
    const { service } = setup({ readings: [reading(), reading({ service: "trainer" })] });

    const detected = (await service.findForDeployments({ userId: "user-1", dseqs: [DSEQ] })).get(DSEQ)?.get(`1/1/${PROVIDER}`)?.detectedGpus;

    expect(detected?.services.map(entry => entry.service)).toEqual(["trainer", "web"]);
  });

  it("dates a lease by its most recent reading and reports that reading's driver", async () => {
    const older = reading({ service: "web", driverVersion: "550.54.15", detectedAt: "2026-09-21T10:00:00.000Z" });
    const newer = reading({ service: "trainer", driverVersion: "560.28.03", detectedAt: "2026-09-21T12:00:00.000Z" });
    const { service } = setup({ readings: [older, newer] });

    const detected = (await service.findForDeployments({ userId: "user-1", dseqs: [DSEQ] })).get(DSEQ)?.get(`1/1/${PROVIDER}`)?.detectedGpus;

    expect(detected).toMatchObject({ detectedAt: "2026-09-21T12:00:00.000Z", driverVersion: "560.28.03" });
  });

  it("falls back to an older reading's driver when the most recent one reported none", async () => {
    const older = reading({ service: "web", driverVersion: "550.54.15", detectedAt: "2026-09-21T10:00:00.000Z" });
    const newer = reading({ service: "trainer", driverVersion: null, detectedAt: "2026-09-21T12:00:00.000Z" });
    const { service } = setup({ readings: [newer, older] });

    const detected = (await service.findForDeployments({ userId: "user-1", dseqs: [DSEQ] })).get(DSEQ)?.get(`1/1/${PROVIDER}`)?.detectedGpus;

    expect(detected).toMatchObject({ detectedAt: "2026-09-21T12:00:00.000Z", driverVersion: "550.54.15" });
  });

  it("reports no driver when none of the lease's readings named one", async () => {
    const { service } = setup({ readings: [reading({ source: "none", gpus: [], driverVersion: null })] });

    const detected = (await service.findForDeployments({ userId: "user-1", dseqs: [DSEQ] })).get(DSEQ)?.get(`1/1/${PROVIDER}`)?.detectedGpus;

    expect(detected).toEqual({ services: [{ service: "web", gpus: [] }], driverVersion: null, detectedAt: "2026-09-21T10:00:00.000Z" });
  });

  it("keeps the leases of one deployment apart", async () => {
    const { service } = setup({ readings: [reading(), reading({ gseq: 2, provider: "akash1other" })] });

    const byLease = (await service.findForDeployments({ userId: "user-1", dseqs: [DSEQ] })).get(DSEQ);

    expect([...(byLease?.keys() ?? [])]).toEqual([`1/1/${PROVIDER}`, "2/1/akash1other"]);
  });

  it("still answers with the raw names when the catalog cannot be reached", async () => {
    const { service } = setup({ readings: [reading()], index: null });

    const detected = (await service.findForDeployments({ userId: "user-1", dseqs: [DSEQ] })).get(DSEQ)?.get(`1/1/${PROVIDER}`)?.detectedGpus;

    expect(detected?.services[0].gpus[0]).toMatchObject({ model: null, displayName: "NVIDIA H100 80GB HBM3" });
  });

  it("leaves the field off rather than failing the deployment read when the readings cannot be loaded", async () => {
    const { service, scoped, logger } = setup({ readings: [] });
    scoped.findLeaseGpus.mockRejectedValue(new Error("connection terminated"));

    await expect(service.findForDeployments({ userId: "user-1", dseqs: [DSEQ] })).resolves.toEqual(new Map());

    expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ event: "LEASE_GPU_READ_FAILED", userId: "user-1", dseqs: [DSEQ] }));
  });

  it("leaves the field off when a stored reading cannot be resolved", async () => {
    const malformed = reading({ gpus: [{ rawName: null as unknown as string, pciDeviceId: null, memoryMb: 0, count: 1 }] });
    const { service } = setup({ readings: [malformed] });

    await expect(service.findForDeployments({ userId: "user-1", dseqs: [DSEQ] })).resolves.toEqual(new Map());
  });

  it("loads no catalog when nothing is recorded for the deployments", async () => {
    const { service, gpuCatalogService } = setup({ readings: [] });

    await expect(service.findForDeployments({ userId: "user-1", dseqs: [DSEQ] })).resolves.toEqual(new Map());
    expect(gpuCatalogService.getIndex).not.toHaveBeenCalled();
  });

  describe("when the lease's bid offer is recorded", () => {
    it("names each offered model with its branded label and how many cards the lease was offered", async () => {
      const offer = createLeaseGpuOffer({
        provider: PROVIDER,
        recordedAt: "2026-09-25T10:00:00.000Z",
        resources: [{ resourceId: 1, replicas: 2, unitsPerReplica: 8, attributes: [{ key: "vendor/nvidia/model/a100/ram/80Gi/interface/sxm", value: "true" }] }]
      });
      const { service } = setup({ readings: [], offers: [offer] });

      const byLease = (await service.findForDeployments({ userId: "user-1", dseqs: [DSEQ] })).get(DSEQ);

      expect(byLease?.get(`1/1/${PROVIDER}`)).toEqual({
        offeredGpus: {
          gpus: [{ vendor: "nvidia", model: "a100", displayName: "A100", ram: "80Gi", interface: "sxm", count: 16 }],
          recordedAt: "2026-09-25T10:00:00.000Z"
        }
      });
    });

    it("serves the offer next to the probe's reading of the same lease", async () => {
      const { service } = setup({ readings: [reading()], offers: [createLeaseGpuOffer({ provider: PROVIDER })] });

      const leaseGpus = (await service.findForDeployments({ userId: "user-1", dseqs: [DSEQ] })).get(DSEQ)?.get(`1/1/${PROVIDER}`);

      expect(leaseGpus?.detectedGpus?.services[0].gpus[0].displayName).toBe("H100");
      expect(leaseGpus?.offeredGpus?.gpus[0].displayName).toBe("RTX 4060 Ti");
    });

    it("still resolves the readings of one deployment when another on the page has only its offer recorded", async () => {
      const { service } = setup({
        readings: [],
        byDeployment: new Map([
          [DSEQ, { readings: [reading()], offers: [] }],
          ["67890", { readings: [], offers: [createLeaseGpuOffer({ provider: PROVIDER })] }]
        ])
      });

      const leaseGpus = (await service.findForDeployments({ userId: "user-1", dseqs: [DSEQ, "67890"] })).get(DSEQ)?.get(`1/1/${PROVIDER}`);

      expect(leaseGpus?.detectedGpus?.services[0].gpus[0].displayName).toBe("H100");
    });

    it("loads no catalog for a deployment only its offers are recorded for", async () => {
      const { service, gpuCatalogService } = setup({ readings: [], offers: [createLeaseGpuOffer({ provider: PROVIDER })] });

      await service.findForDeployments({ userId: "user-1", dseqs: [DSEQ] });

      expect(gpuCatalogService.getIndex).not.toHaveBeenCalled();
    });

    it("serves an offer that named no model as offering none, rather than leaving it off", async () => {
      const offer = createLeaseGpuOffer({ provider: PROVIDER, resources: [{ resourceId: 1, replicas: 1, unitsPerReplica: 1, attributes: [] }] });
      const { service } = setup({ readings: [], offers: [offer] });

      const leaseGpus = (await service.findForDeployments({ userId: "user-1", dseqs: [DSEQ] })).get(DSEQ)?.get(`1/1/${PROVIDER}`);

      expect(leaseGpus?.offeredGpus?.gpus).toEqual([]);
    });
  });

  it("reads nothing for an empty deployment list", async () => {
    const { service, deploymentSettingRepository } = setup({ readings: [] });

    await expect(service.findForDeployments({ userId: "user-1", dseqs: [] })).resolves.toEqual(new Map());
    expect(deploymentSettingRepository.accessibleBy).not.toHaveBeenCalled();
  });

  it("reads through the caller's own ability", async () => {
    const { service, deploymentSettingRepository, scoped, authService } = setup({ readings: [reading()] });

    await service.findForDeployments({ userId: "user-1", dseqs: [DSEQ] });

    expect(deploymentSettingRepository.accessibleBy).toHaveBeenCalledWith(authService.ability, "read");
    expect(scoped.findLeaseGpus).toHaveBeenCalledWith({ userId: "user-1", dseqs: [DSEQ] });
  });

  function setup(input: { readings: LeaseGpuReading[]; offers?: LeaseGpuOffer[]; byDeployment?: Map<string, StoredLeaseGpus>; index?: null }) {
    const offers = input.offers ?? [];
    const scoped = mock<DeploymentSettingRepository>();
    scoped.findLeaseGpus.mockResolvedValue(
      input.byDeployment ?? (input.readings.length || offers.length ? new Map([[DSEQ, { readings: input.readings, offers }]]) : new Map())
    );
    const deploymentSettingRepository = mock<DeploymentSettingRepository>();
    deploymentSettingRepository.accessibleBy.mockReturnValue(scoped);
    const gpuCatalogService = mock<GpuCatalogService>();
    gpuCatalogService.getIndex.mockResolvedValue(input.index === null ? null : buildGpuCatalogIndex(CATALOG));
    const authService = mock<AuthService>({ ability: mock<AuthService["ability"]>() });
    const logger = mock<ReturnType<CreateLogger>>();
    const service = new LeaseGpuService(
      deploymentSettingRepository,
      gpuCatalogService,
      new GpuFormattingService(),
      authService,
      vi.fn<CreateLogger>(() => logger)
    );

    return { service, deploymentSettingRepository, scoped, gpuCatalogService, authService, logger };
  }
});
