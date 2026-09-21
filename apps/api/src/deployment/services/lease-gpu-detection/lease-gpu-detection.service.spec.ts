import type { SDLInput } from "@akashnetwork/chain-sdk";
import type { DeploymentHttpService, LeaseHttpService } from "@akashnetwork/http-sdk";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { WalletInitialized } from "@src/billing/repositories";
import type { CreateLogger } from "@src/core";
import type { DeploymentSettingRepository } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import type { DeploymentConfigService } from "@src/deployment/services/deployment-config/deployment-config.service";
import type { LeaseGpuProbeResult, LeaseGpuProbeService } from "@src/deployment/services/lease-gpu-probe/lease-gpu-probe.service";
import type { SdlService } from "@src/deployment/services/sdl/sdl.service";
import type { ProviderRepository } from "@src/provider/repositories/provider/provider.repository";
import type { ProviderService } from "@src/provider/services/provider/provider.service";
import { LeaseGpuDetectionService } from "./lease-gpu-detection.service";

type LeaseStatus = Awaited<ReturnType<ProviderService["getLeaseStatus"]>>;

const WALLET = mock<WalletInitialized>({ id: 7, userId: "user-1", address: "akash1owner" });
const DSEQ = "12345";
const PROVIDER = "akash1provider";
const GPU_READING = { source: "nvidia-smi" as const, driverVersion: "550.54.15", gpus: [{ rawName: "NVIDIA H100", pciDeviceId: "0x233010DE", memoryMb: 81559, count: 1 }] };

describe(LeaseGpuDetectionService.name, () => {
  it("records what each gpu service reported", async () => {
    const { service } = setup({});

    const report = await service.detect({ wallet: WALLET, dseq: DSEQ });

    expect(report.status).toBe("read");
    expect(report.complete).toBe(true);
    expect(report.rows).toEqual([
      expect.objectContaining({ userId: "user-1", dseq: DSEQ, gseq: 1, oseq: 1, provider: PROVIDER, service: "web", source: "nvidia-smi", gpus: GPU_READING.gpus })
    ]);
  });

  it("reads nothing and asks for no provider when no group declares a gpu", async () => {
    const { service, providerRepository } = setup({ gpuUnits: 0 });

    const report = await service.detect({ wallet: WALLET, dseq: DSEQ });

    expect(report).toEqual({ status: "no_gpu_declared", rows: [], complete: true });
    expect(providerRepository.findActiveByAddress).not.toHaveBeenCalled();
  });

  it("comes back later when the lease is not live yet", async () => {
    const { service } = setup({ leases: [] });

    const report = await service.detect({ wallet: WALLET, dseq: DSEQ });

    expect(report).toEqual({ status: "no_live_lease", rows: [], complete: false });
  });

  it("ignores a lease of a group that asks for no gpu", async () => {
    const { service, probeService } = setup({ leases: [lease(2)] });

    const report = await service.detect({ wallet: WALLET, dseq: DSEQ });

    expect(report.status).toBe("no_live_lease");
    expect(probeService.probe).not.toHaveBeenCalled();
  });

  it("opens a session only for the services the sdl says asked for a gpu", async () => {
    const { service, probeService } = setup({ running: ["web", "sidecar"] });

    await service.detect({ wallet: WALLET, dseq: DSEQ });

    expect(probeService.probe).toHaveBeenCalledTimes(1);
    expect(probeService.probe).toHaveBeenCalledWith(expect.objectContaining({ service: "web" }));
  });

  it("falls back to every running service when the console stored no sdl", async () => {
    const { service, probeService } = setup({ running: ["web", "sidecar"], sdl: null });

    await service.detect({ wallet: WALLET, dseq: DSEQ });

    expect(probeService.probe).toHaveBeenCalledTimes(2);
  });

  it("holds a lease to the services one run may read", async () => {
    const { service, probeService } = setup({ running: ["a", "b", "c", "d", "e"], sdl: null });

    await service.detect({ wallet: WALLET, dseq: DSEQ });

    expect(probeService.probe).toHaveBeenCalledTimes(4);
  });

  it("stays incomplete when a service could not be read, so the run comes back for it", async () => {
    const { service } = setup({ running: ["web", "trainer"], sdl: null, probeResults: [{ status: "detected", reading: GPU_READING }, { status: "idle_timeout" }] });

    const report = await service.detect({ wallet: WALLET, dseq: DSEQ });

    expect(report.rows).toHaveLength(1);
    expect(report.complete).toBe(false);
  });

  it("records a container without a gpu tool, so nothing comes back for it", async () => {
    const { service } = setup({ probeResults: [{ status: "detected", reading: { source: "none", driverVersion: null, gpus: [] } }] });

    const report = await service.detect({ wallet: WALLET, dseq: DSEQ });

    expect(report.rows).toEqual([expect.objectContaining({ source: "none", gpus: [] })]);
    expect(report.complete).toBe(true);
  });

  it("comes back later when the provider is not one the console knows", async () => {
    const { service, probeService } = setup({ provider: null });

    const report = await service.detect({ wallet: WALLET, dseq: DSEQ });

    expect(report).toEqual({ status: "nothing_readable", rows: [], complete: false });
    expect(probeService.probe).not.toHaveBeenCalled();
  });

  it("comes back later when the provider would not say what is running", async () => {
    const { service } = setup({ statusFails: true });

    const report = await service.detect({ wallet: WALLET, dseq: DSEQ });

    expect(report).toEqual({ status: "nothing_readable", rows: [], complete: false });
  });

  it("asks the provider for no more than it needs to open a shell", async () => {
    const { service, providerService } = setup({});

    await service.detect({ wallet: WALLET, dseq: DSEQ });

    expect(providerService.toProviderAuth).toHaveBeenCalledWith({ walletId: 7, provider: PROVIDER }, ["status", "shell"], { ttl: 120 });
  });

  function lease(gseq: number) {
    return { lease: { id: { owner: "akash1owner", dseq: DSEQ, gseq, oseq: 1, provider: PROVIDER } } };
  }

  function setup(input: {
    gpuUnits?: number;
    leases?: ReturnType<typeof lease>[];
    running?: string[];
    sdl?: string | null;
    provider?: { hostUri: string } | null;
    statusFails?: boolean;
    probeResults?: LeaseGpuProbeResult[];
  }) {
    const deploymentHttpService = mock<DeploymentHttpService>();
    deploymentHttpService.findByOwnerAndDseq.mockResolvedValue({
      groups: [
        { id: { gseq: 1 }, group_spec: { name: "dcloud", resources: [{ resource: { gpu: { units: { val: String(input.gpuUnits ?? 1) } } } }] } },
        { id: { gseq: 2 }, group_spec: { name: "cpuonly", resources: [{ resource: { gpu: { units: { val: "0" } } } }] } }
      ]
    } as Awaited<ReturnType<DeploymentHttpService["findByOwnerAndDseq"]>>);

    const leaseHttpService = mock<LeaseHttpService>();
    const leases = input.leases ?? [lease(1)];
    leaseHttpService.list.mockImplementation(async ({ state }) =>
      ({ leases: state === "active" ? leases : [] }) as Awaited<ReturnType<LeaseHttpService["list"]>>
    );

    const providerRepository = mock<ProviderRepository>();
    providerRepository.findActiveByAddress.mockResolvedValue(
      input.provider === null ? null : ({ hostUri: "https://provider.example:8443" } as Awaited<ReturnType<ProviderRepository["findActiveByAddress"]>>)
    );

    const providerService = mock<ProviderService>();
    providerService.toProviderAuth.mockResolvedValue({ token: "jwt" } as Awaited<ReturnType<ProviderService["toProviderAuth"]>>);
    const running = input.running ?? ["web"];
    providerService.getLeaseStatus.mockImplementation(async () => {
      if (input.statusFails) throw new Error("provider unreachable");
      return mock<LeaseStatus>({ services: Object.fromEntries(running.map(name => [name, mock<LeaseStatus["services"][string]>({ available: 1 })])) });
    });

    const deploymentSettingRepository = mock<DeploymentSettingRepository>();
    deploymentSettingRepository.findOneBy.mockResolvedValue(
      (input.sdl === null ? { sdl: null } : { sdl: "sdl-text" }) as Awaited<ReturnType<DeploymentSettingRepository["findOneBy"]>>
    );

    const sdlService = mock<SdlService>();
    sdlService.parse.mockReturnValue({
      ok: true,
      value: mock<SDLInput>({ deployment: { web: { dcloud: { profile: "gpu" } } }, profiles: { compute: { gpu: { resources: { gpu: { units: 1 } } } } } })
    });

    const probeService = mock<LeaseGpuProbeService>();
    const results = input.probeResults ?? [{ status: "detected", reading: GPU_READING }];
    let call = 0;
    probeService.probe.mockImplementation(async () => results[Math.min(call++, results.length - 1)]);

    const config = mock<DeploymentConfigService>();
    config.get.mockImplementation((key: string) => {
      if (key === "LEASE_GPU_DETECTION_MAX_LEASES_PER_DEPLOYMENT") return 4;
      if (key === "LEASE_GPU_DETECTION_MAX_SERVICES_PER_LEASE") return 4;
      if (key === "LEASE_GPU_DETECTION_PROVIDER_JWT_TTL_SECONDS") return 120;
      return undefined;
    });

    const logger = mock<ReturnType<CreateLogger>>();
    const service = new LeaseGpuDetectionService(
      deploymentHttpService,
      leaseHttpService,
      providerRepository,
      providerService,
      deploymentSettingRepository,
      probeService,
      sdlService,
      config,
      vi.fn<CreateLogger>(() => logger)
    );

    return { service, probeService, providerRepository, providerService, deploymentHttpService };
  }
});
