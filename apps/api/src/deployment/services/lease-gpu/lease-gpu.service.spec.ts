import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AuthService } from "@src/auth/services/auth.service";
import type { CreateLogger } from "@src/core";
import type { LeaseGpuOutput, LeaseGpuRepository } from "@src/deployment/repositories/lease-gpu/lease-gpu.repository";
import { buildGpuCatalogIndex } from "@src/gpu/lib/gpu-model-resolver/gpu-model-resolver";
import type { GpuCatalogService } from "@src/gpu/services/gpu-catalog/gpu-catalog.service";
import { GpuFormattingService } from "@src/gpu/services/gpu-formatting/gpu-formatting.service";
import type { ProviderConfigGpusType } from "@src/types/gpu";
import { LeaseGpuService } from "./lease-gpu.service";

const CATALOG: ProviderConfigGpusType = {
  "10de": { name: "nvidia", devices: { "2330": { name: "h100", memory_size: "80Gi", interface: "SXM5" } } }
};

const DSEQ = "12345";
const PROVIDER = "akash1provider";

function row(overrides: Partial<LeaseGpuOutput> = {}): LeaseGpuOutput {
  return mock<LeaseGpuOutput>({
    userId: "user-1",
    dseq: DSEQ,
    gseq: 1,
    oseq: 1,
    provider: PROVIDER,
    service: "web",
    driverVersion: "550.54.15",
    detectedAt: new Date("2026-09-21T10:00:00.000Z"),
    gpus: [{ rawName: "NVIDIA H100 80GB HBM3", pciDeviceId: "0x233010DE", memoryMb: 81559, count: 1 }],
    ...overrides
  });
}

describe(LeaseGpuService.name, () => {
  it("resolves a reading to the catalog model and its branded label", async () => {
    const { service } = setup({ rows: [row()] });

    const byDeployment = await service.findForDeployments({ userId: "user-1", dseqs: [DSEQ] });

    expect(byDeployment.get(DSEQ)?.get(`1/1/${PROVIDER}`)).toEqual({
      services: [{ service: "web", gpus: [{ vendor: "nvidia", model: "h100", displayName: "H100", memoryMb: 81559, interface: "sxm", count: 1 }] }],
      driverVersion: "550.54.15",
      detectedAt: "2026-09-21T10:00:00.000Z"
    });
  });

  it("shows an unlisted card by what its driver called it", async () => {
    const { service } = setup({ rows: [row({ gpus: [{ rawName: "Some Future Card", pciDeviceId: null, memoryMb: 1024, count: 2 }] })] });

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
    const { service } = setup({ rows: [row({ gpus: [{ rawName, pciDeviceId: null, memoryMb: 0, count: 1 }] })] });

    const detected = (await service.findForDeployments({ userId: "user-1", dseqs: [DSEQ] })).get(DSEQ)?.get(`1/1/${PROVIDER}`);

    expect(detected?.services[0].gpus[0].displayName).toHaveLength(48);
  });

  it("groups every service of one lease under that lease, in name order whatever order the rows came back in", async () => {
    const { service } = setup({ rows: [row(), row({ service: "trainer" })] });

    const detected = (await service.findForDeployments({ userId: "user-1", dseqs: [DSEQ] })).get(DSEQ)?.get(`1/1/${PROVIDER}`);

    expect(detected?.services.map(entry => entry.service)).toEqual(["trainer", "web"]);
  });

  it("dates a lease by its most recent reading and reports that reading's driver", async () => {
    const older = row({ service: "web", driverVersion: "550.54.15", detectedAt: new Date("2026-09-21T10:00:00.000Z") });
    const newer = row({ service: "trainer", driverVersion: "560.28.03", detectedAt: new Date("2026-09-21T12:00:00.000Z") });
    const { service } = setup({ rows: [older, newer] });

    const detected = (await service.findForDeployments({ userId: "user-1", dseqs: [DSEQ] })).get(DSEQ)?.get(`1/1/${PROVIDER}`);

    expect(detected).toMatchObject({ detectedAt: "2026-09-21T12:00:00.000Z", driverVersion: "560.28.03" });
  });

  it("falls back to an older reading's driver when the most recent one reported none", async () => {
    const older = row({ service: "web", driverVersion: "550.54.15", detectedAt: new Date("2026-09-21T10:00:00.000Z") });
    const newer = row({ service: "trainer", driverVersion: null, detectedAt: new Date("2026-09-21T12:00:00.000Z") });
    const { service } = setup({ rows: [newer, older] });

    const detected = (await service.findForDeployments({ userId: "user-1", dseqs: [DSEQ] })).get(DSEQ)?.get(`1/1/${PROVIDER}`);

    expect(detected).toMatchObject({ detectedAt: "2026-09-21T12:00:00.000Z", driverVersion: "550.54.15" });
  });

  it("keeps the leases of one deployment apart", async () => {
    const { service } = setup({ rows: [row(), row({ gseq: 2, provider: "akash1other" })] });

    const byLease = (await service.findForDeployments({ userId: "user-1", dseqs: [DSEQ] })).get(DSEQ);

    expect([...(byLease?.keys() ?? [])]).toEqual([`1/1/${PROVIDER}`, "2/1/akash1other"]);
  });

  it("still answers with the raw names when the catalog cannot be reached", async () => {
    const { service } = setup({ rows: [row()], index: null });

    const detected = (await service.findForDeployments({ userId: "user-1", dseqs: [DSEQ] })).get(DSEQ)?.get(`1/1/${PROVIDER}`);

    expect(detected?.services[0].gpus[0]).toMatchObject({ model: null, displayName: "NVIDIA H100 80GB HBM3" });
  });

  it("leaves the field off rather than failing the deployment read when the readings cannot be loaded", async () => {
    const { service, scoped, logger } = setup({ rows: [] });
    scoped.findForDeployments.mockRejectedValue(new Error("connection terminated"));

    await expect(service.findForDeployments({ userId: "user-1", dseqs: [DSEQ] })).resolves.toEqual(new Map());

    expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ event: "LEASE_GPU_READ_FAILED", userId: "user-1", dseqs: [DSEQ] }));
  });

  it("leaves the field off when a stored reading cannot be resolved", async () => {
    const malformed = row({ gpus: [{ rawName: null as unknown as string, pciDeviceId: null, memoryMb: 0, count: 1 }] });
    const { service } = setup({ rows: [malformed] });

    await expect(service.findForDeployments({ userId: "user-1", dseqs: [DSEQ] })).resolves.toEqual(new Map());
  });

  it("reads nothing for an empty deployment list", async () => {
    const { service, leaseGpuRepository } = setup({ rows: [] });

    await expect(service.findForDeployments({ userId: "user-1", dseqs: [] })).resolves.toEqual(new Map());
    expect(leaseGpuRepository.accessibleBy).not.toHaveBeenCalled();
  });

  it("reads through the caller's own ability", async () => {
    const { service, leaseGpuRepository, authService } = setup({ rows: [row()] });

    await service.findForDeployments({ userId: "user-1", dseqs: [DSEQ] });

    expect(leaseGpuRepository.accessibleBy).toHaveBeenCalledWith(authService.ability, "read");
  });

  function setup(input: { rows: LeaseGpuOutput[]; index?: null }) {
    const scoped = mock<LeaseGpuRepository>();
    scoped.findForDeployments.mockResolvedValue(input.rows);
    const leaseGpuRepository = mock<LeaseGpuRepository>();
    leaseGpuRepository.accessibleBy.mockReturnValue(scoped);
    const gpuCatalogService = mock<GpuCatalogService>();
    gpuCatalogService.getIndex.mockResolvedValue(input.index === null ? null : buildGpuCatalogIndex(CATALOG));
    const authService = mock<AuthService>({ ability: mock<AuthService["ability"]>() });
    const logger = mock<ReturnType<CreateLogger>>();
    const service = new LeaseGpuService(
      leaseGpuRepository,
      gpuCatalogService,
      new GpuFormattingService(),
      authService,
      vi.fn<CreateLogger>(() => logger)
    );

    return { service, leaseGpuRepository, scoped, authService, logger };
  }
});
