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
const GPU_READING = {
  source: "nvidia-smi" as const,
  driverVersion: "550.54.15",
  gpus: [{ rawName: "NVIDIA H100", pciDeviceId: "0x233010DE", memoryMb: 81559, count: 1 }]
};

describe(LeaseGpuDetectionService.name, () => {
  it("records what each gpu service reported", async () => {
    const { service } = setup({});

    const report = await service.detect({ wallet: WALLET, dseq: DSEQ });

    expect(report.status).toBe("read");
    expect(report.complete).toBe(true);
    expect(report.rows).toEqual([
      expect.objectContaining({
        userId: "user-1",
        dseq: DSEQ,
        gseq: 1,
        oseq: 1,
        provider: PROVIDER,
        service: "web",
        source: "nvidia-smi",
        gpus: GPU_READING.gpus
      })
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
    const { service } = setup({
      running: ["web", "trainer"],
      sdl: null,
      probeResults: [{ status: "detected", reading: GPU_READING }, { status: "idle_timeout" }]
    });

    const report = await service.detect({ wallet: WALLET, dseq: DSEQ });

    expect(report.rows).toHaveLength(1);
    expect(report.complete).toBe(false);
  });

  it("reads every pod of a gpu service, since each may sit on a different host's cards", async () => {
    const { service, probeService } = setup({ replicas: { web: 3 } });

    await service.detect({ wallet: WALLET, dseq: DSEQ });

    expect(probeService.probe.mock.calls.map(([target]) => target.podIndex)).toEqual([0, 1, 2]);
  });

  it("opens each session on a token of its own, since one lease's sessions can outlast a single token", async () => {
    const { service, probeService, providerService } = setup({ replicas: { web: 2 } });

    await service.detect({ wallet: WALLET, dseq: DSEQ });

    expect(providerService.getLeaseStatus).toHaveBeenCalledWith(PROVIDER, DSEQ, 1, 1, { token: "jwt-0" });
    expect(probeService.probe.mock.calls.map(([target]) => target.token)).toEqual(["jwt-1", "jwt-2"]);
  });

  it("records the cards of every pod of a service as one reading", async () => {
    const a100 = { rawName: "NVIDIA A100-SXM4-80GB", pciDeviceId: "0x20B210DE", memoryMb: 81920, count: 1 };
    const { service } = setup({
      replicas: { web: 3 },
      probeResults: [
        { status: "detected", reading: GPU_READING },
        { status: "detected", reading: { ...GPU_READING, gpus: [a100] } },
        { status: "detected", reading: GPU_READING }
      ]
    });

    const report = await service.detect({ wallet: WALLET, dseq: DSEQ });

    expect(report.rows).toEqual([expect.objectContaining({ service: "web", gpus: [{ ...GPU_READING.gpus[0], count: 2 }, a100] })]);
    expect(report.complete).toBe(true);
  });

  it("records nothing for a service while one of its pods cannot be read, such as one still starting, and stops opening sessions on it", async () => {
    const { service, probeService, logger } = setup({
      replicas: { web: 3 },
      probeResults: [{ status: "detected", reading: GPU_READING }, { status: "idle_timeout" }]
    });

    const report = await service.detect({ wallet: WALLET, dseq: DSEQ });

    expect(report).toEqual({ status: "nothing_readable", rows: [], complete: false });
    expect(probeService.probe).toHaveBeenCalledTimes(2);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ event: "LEASE_GPU_DETECTION_UNREAD", service: "web", podIndex: 1, status: "idle_timeout" })
    );
  });

  it("leaves unread a service running more pods than one run may read, rather than reading it in part", async () => {
    const { service, probeService, logger } = setup({ running: ["web", "sidecar"], replicas: { web: 5 }, sdl: null });

    const report = await service.detect({ wallet: WALLET, dseq: DSEQ });

    expect(probeService.probe.mock.calls.map(([target]) => target.service)).toEqual(["sidecar"]);
    expect(report.rows).toEqual([expect.objectContaining({ service: "sidecar" })]);
    expect(report.complete).toBe(true);
    expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ event: "LEASE_GPU_DETECTION_REPLICAS_CAPPED", service: "web", replicas: 5, max: 4 }));
  });

  it("reads a service running as many pods as one run may read", async () => {
    const { service, probeService } = setup({ replicas: { web: 4 } });

    const report = await service.detect({ wallet: WALLET, dseq: DSEQ });

    expect(probeService.probe).toHaveBeenCalledTimes(4);
    expect(report.complete).toBe(true);
  });

  it("settles a lease whose only gpu service runs more pods than one run may read, since coming back would read no more of it", async () => {
    const { service, probeService } = setup({ replicas: { web: 5 } });

    const report = await service.detect({ wallet: WALLET, dseq: DSEQ });

    expect(report).toEqual({ status: "nothing_readable", rows: [], complete: true });
    expect(probeService.probe).not.toHaveBeenCalled();
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

  it("stays incomplete while one lease is unread, however fully another answered", async () => {
    const { service } = setup({ leases: [lease(1), lease(1, { oseq: 2, provider: "akash1dark" })], unknownProviders: ["akash1dark"] });

    const report = await service.detect({ wallet: WALLET, dseq: DSEQ });

    expect(report.status).toBe("read");
    expect(report.rows).toEqual([expect.objectContaining({ oseq: 1, provider: PROVIDER })]);
    expect(report.complete).toBe(false);
  });

  it("comes back later when the gpu service is not running yet, even though another service is", async () => {
    const { service, probeService } = setup({ running: ["sidecar"] });

    const report = await service.detect({ wallet: WALLET, dseq: DSEQ });

    expect(report).toEqual({ status: "nothing_readable", rows: [], complete: false });
    expect(probeService.probe).not.toHaveBeenCalled();
  });

  it("comes back later when the chain answers the deployment read with an error, rather than reading it as no gpu", async () => {
    const { service, providerRepository, logger } = setup({ deploymentRead: "error_body" });

    const report = await service.detect({ wallet: WALLET, dseq: DSEQ });

    expect(report).toEqual({ status: "chain_unavailable", rows: [], complete: false });
    expect(providerRepository.findActiveByAddress).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ event: "LEASE_GPU_DETECTION_CHAIN_UNAVAILABLE", dseq: DSEQ, code: 8 }));
  });

  it.each([
    { read: "deployment", failure: { deploymentRead: "throws" } },
    { read: "lease list", failure: { leaseListFails: true } }
  ] as const)("comes back later when the $read read fails", async ({ failure }) => {
    const { service, providerRepository, logger } = setup(failure);

    const report = await service.detect({ wallet: WALLET, dseq: DSEQ });

    expect(report).toEqual({ status: "chain_unavailable", rows: [], complete: false });
    expect(providerRepository.findActiveByAddress).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ event: "LEASE_GPU_DETECTION_CHAIN_UNAVAILABLE", dseq: DSEQ, error: expect.any(Error) }));
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

  function lease(gseq: number, overrides: { oseq?: number; provider?: string } = {}) {
    return { lease: { id: { owner: "akash1owner", dseq: DSEQ, gseq, oseq: overrides.oseq ?? 1, provider: overrides.provider ?? PROVIDER } } };
  }

  function setup(input: {
    gpuUnits?: number;
    leases?: ReturnType<typeof lease>[];
    running?: string[];
    sdl?: string | null;
    provider?: { hostUri: string } | null;
    unknownProviders?: string[];
    deploymentRead?: "error_body" | "throws";
    leaseListFails?: boolean;
    statusFails?: boolean;
    replicas?: Record<string, number>;
    probeResults?: LeaseGpuProbeResult[];
  }) {
    const deploymentHttpService = mock<DeploymentHttpService>();
    deploymentHttpService.findByOwnerAndDseq.mockImplementation(async () => {
      if (input.deploymentRead === "throws") throw new Error("chain node unreachable");
      if (input.deploymentRead === "error_body") return { code: 8, message: "rate limited", details: [] };

      return {
        groups: [
          { id: { gseq: 1 }, group_spec: { name: "dcloud", resources: [{ resource: { gpu: { units: { val: String(input.gpuUnits ?? 1) } } } }] } },
          { id: { gseq: 2 }, group_spec: { name: "cpuonly", resources: [{ resource: { gpu: { units: { val: "0" } } } }] } }
        ]
      } as Awaited<ReturnType<DeploymentHttpService["findByOwnerAndDseq"]>>;
    });

    const leaseHttpService = mock<LeaseHttpService>();
    const leases = input.leases ?? [lease(1)];
    leaseHttpService.list.mockImplementation(async ({ state }) => {
      if (input.leaseListFails) throw new Error("chain node unreachable");
      return { leases: state === "active" ? leases : [] } as Awaited<ReturnType<LeaseHttpService["list"]>>;
    });

    const providerRepository = mock<ProviderRepository>();
    providerRepository.findActiveByAddress.mockImplementation(async address =>
      input.provider === null || input.unknownProviders?.includes(address)
        ? null
        : ({ hostUri: "https://provider.example:8443" } as Awaited<ReturnType<ProviderRepository["findActiveByAddress"]>>)
    );

    const providerService = mock<ProviderService>();
    let minted = 0;
    providerService.toProviderAuth.mockImplementation(async () => ({ token: `jwt-${minted++}` }) as Awaited<ReturnType<ProviderService["toProviderAuth"]>>);
    const running = input.running ?? ["web"];
    providerService.getLeaseStatus.mockImplementation(async () => {
      if (input.statusFails) throw new Error("provider unreachable");
      return mock<LeaseStatus>({
        services: Object.fromEntries(running.map(name => [name, mock<LeaseStatus["services"][string]>({ available: 1, total: input.replicas?.[name] ?? 1 })]))
      });
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
      if (key === "LEASE_GPU_DETECTION_MAX_REPLICAS_PER_SERVICE") return 4;
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

    return { service, probeService, providerRepository, providerService, deploymentHttpService, logger };
  }
});
