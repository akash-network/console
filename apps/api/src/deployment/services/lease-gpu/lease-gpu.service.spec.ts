import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AuthService } from "@src/auth/services/auth.service";
import type { CreateLogger } from "@src/core";
import type { LeaseGpuReading } from "@src/deployment/model-schemas";
import type { DeploymentSettingRepository } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import { buildGpuCatalogIndex } from "@src/gpu/lib/gpu-model-resolver/gpu-model-resolver";
import type { GpuCatalogService } from "@src/gpu/services/gpu-catalog/gpu-catalog.service";
import { GpuFormattingService } from "@src/gpu/services/gpu-formatting/gpu-formatting.service";
import type { ProviderConfigGpusType } from "@src/types/gpu";
import { LeaseGpuService } from "./lease-gpu.service";

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

    expect(byDeployment.get(DSEQ)?.get(`1/1/${PROVIDER}`)).toEqual({
      services: [{ service: "web", gpus: [{ vendor: "nvidia", model: "h100", displayName: "H100", memoryMb: 81559, interface: "sxm", count: 1 }] }],
      driverVersion: "550.54.15",
      detectedAt: "2026-09-21T10:00:00.000Z"
    });
  });

  it("shows an unlisted card by what its driver called it", async () => {
    const { service } = setup({ readings: [reading({ gpus: [{ rawName: "Some Future Card", pciDeviceId: null, memoryMb: 1024, count: 2 }] })] });

    const detected = (await service.findForDeployments({ userId: "user-1", dseqs: [DSEQ] })).get(DSEQ)?.get(`1/1/${PROVIDER}`);

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

    const detected = (await service.findForDeployments({ userId: "user-1", dseqs: [DSEQ] })).get(DSEQ)?.get(`1/1/${PROVIDER}`);

    expect(detected?.services[0].gpus[0].displayName).toHaveLength(48);
  });

  it("groups every service of one lease under that lease, in name order whatever order they were stored in", async () => {
    const { service } = setup({ readings: [reading(), reading({ service: "trainer" })] });

    const detected = (await service.findForDeployments({ userId: "user-1", dseqs: [DSEQ] })).get(DSEQ)?.get(`1/1/${PROVIDER}`);

    expect(detected?.services.map(entry => entry.service)).toEqual(["trainer", "web"]);
  });

  it("dates a lease by its most recent reading and reports that reading's driver", async () => {
    const older = reading({ service: "web", driverVersion: "550.54.15", detectedAt: "2026-09-21T10:00:00.000Z" });
    const newer = reading({ service: "trainer", driverVersion: "560.28.03", detectedAt: "2026-09-21T12:00:00.000Z" });
    const { service } = setup({ readings: [older, newer] });

    const detected = (await service.findForDeployments({ userId: "user-1", dseqs: [DSEQ] })).get(DSEQ)?.get(`1/1/${PROVIDER}`);

    expect(detected).toMatchObject({ detectedAt: "2026-09-21T12:00:00.000Z", driverVersion: "560.28.03" });
  });

  it("falls back to an older reading's driver when the most recent one reported none", async () => {
    const older = reading({ service: "web", driverVersion: "550.54.15", detectedAt: "2026-09-21T10:00:00.000Z" });
    const newer = reading({ service: "trainer", driverVersion: null, detectedAt: "2026-09-21T12:00:00.000Z" });
    const { service } = setup({ readings: [newer, older] });

    const detected = (await service.findForDeployments({ userId: "user-1", dseqs: [DSEQ] })).get(DSEQ)?.get(`1/1/${PROVIDER}`);

    expect(detected).toMatchObject({ detectedAt: "2026-09-21T12:00:00.000Z", driverVersion: "550.54.15" });
  });

  it("reports no driver when none of the lease's readings named one", async () => {
    const { service } = setup({ readings: [reading({ source: "none", gpus: [], driverVersion: null })] });

    const detected = (await service.findForDeployments({ userId: "user-1", dseqs: [DSEQ] })).get(DSEQ)?.get(`1/1/${PROVIDER}`);

    expect(detected).toEqual({ services: [{ service: "web", gpus: [] }], driverVersion: null, detectedAt: "2026-09-21T10:00:00.000Z" });
  });

  it("keeps the leases of one deployment apart", async () => {
    const { service } = setup({ readings: [reading(), reading({ gseq: 2, provider: "akash1other" })] });

    const byLease = (await service.findForDeployments({ userId: "user-1", dseqs: [DSEQ] })).get(DSEQ);

    expect([...(byLease?.keys() ?? [])]).toEqual([`1/1/${PROVIDER}`, "2/1/akash1other"]);
  });

  it("still answers with the raw names when the catalog cannot be reached", async () => {
    const { service } = setup({ readings: [reading()], index: null });

    const detected = (await service.findForDeployments({ userId: "user-1", dseqs: [DSEQ] })).get(DSEQ)?.get(`1/1/${PROVIDER}`);

    expect(detected?.services[0].gpus[0]).toMatchObject({ model: null, displayName: "NVIDIA H100 80GB HBM3" });
  });

  it("leaves the field off rather than failing the deployment read when the readings cannot be loaded", async () => {
    const { service, scoped, logger } = setup({ readings: [] });
    scoped.findGpuReadings.mockRejectedValue(new Error("connection terminated"));

    await expect(service.findForDeployments({ userId: "user-1", dseqs: [DSEQ] })).resolves.toEqual(new Map());

    expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ event: "LEASE_GPU_READ_FAILED", userId: "user-1", dseqs: [DSEQ] }));
  });

  it("leaves the field off when a stored reading cannot be resolved", async () => {
    const malformed = reading({ gpus: [{ rawName: null as unknown as string, pciDeviceId: null, memoryMb: 0, count: 1 }] });
    const { service } = setup({ readings: [malformed] });

    await expect(service.findForDeployments({ userId: "user-1", dseqs: [DSEQ] })).resolves.toEqual(new Map());
  });

  it("loads no catalog when none of the deployments has been read", async () => {
    const { service, gpuCatalogService } = setup({ readings: [] });

    await expect(service.findForDeployments({ userId: "user-1", dseqs: [DSEQ] })).resolves.toEqual(new Map());
    expect(gpuCatalogService.getIndex).not.toHaveBeenCalled();
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
    expect(scoped.findGpuReadings).toHaveBeenCalledWith({ userId: "user-1", dseqs: [DSEQ] });
  });

  function setup(input: { readings: LeaseGpuReading[]; index?: null }) {
    const scoped = mock<DeploymentSettingRepository>();
    scoped.findGpuReadings.mockResolvedValue(input.readings.length ? new Map([[DSEQ, input.readings]]) : new Map());
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
