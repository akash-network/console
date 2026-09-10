import type { Provider } from "@akashnetwork/database/dbSchemas/akash";
import type { LeaseHttpService, RpcLease } from "@akashnetwork/http-sdk";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { CreateLogger } from "@src/core";
import type { DeploymentSettingRepository, DeploymentSettingsOutput } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import type { ProviderRepository } from "@src/provider/repositories/provider/provider.repository";
import type { ProviderService } from "@src/provider/services/provider/provider.service";
import type { CompiledSignature } from "@src/workload-abuse/config/env.config";
import type { ProviderLogTailService } from "@src/workload-abuse/services/provider-log-tail/provider-log-tail.service";
import type { ProviderShellProbeService, ShellProbeResult } from "@src/workload-abuse/services/provider-shell-probe/provider-shell-probe.service";
import type { WorkloadAbuseConfigService } from "@src/workload-abuse/services/workload-abuse-config/workload-abuse-config.service";
import { TrialWorkloadProbeService } from "./trial-workload-probe.service";

import { mockConfigService } from "@test/mocks/config-service.mock";
import { createLeaseStatus } from "@test/seeders/lease-status.seeder";
import { createUserWallet } from "@test/seeders/user-wallet.seeder";

const SIGNATURES: CompiledSignature[] = [
  { bucket: "hard", category: "stratum-url", pattern: /stratum\+tcp:\/\//i },
  { bucket: "soft", category: "pool-port", pattern: /:3333\b/ }
];
const PROVIDER = "akash1provider";
const HOST_URI = "https://provider.example:8443";
const DSEQ = "1000001";

describe(TrialWorkloadProbeService.name, () => {
  it("reports no live lease without touching any provider", async () => {
    const { service, wallet, providerService } = setup({ leases: [] });

    const report = await service.probe({ wallet, dseq: DSEQ });

    expect(report).toEqual({ verdict: "clean", signals: [], excerpt: "", probeStatus: "no_live_lease", leases: [] });
    expect(providerService.toProviderAuth).not.toHaveBeenCalled();
  });

  it("reports an unknown provider when the lease points at one the indexer does not know", async () => {
    const { service, wallet } = setup({ leases: [createRpcLease()], provider: null });

    const report = await service.probe({ wallet, dseq: DSEQ });

    expect(report.probeStatus).toBe("provider_unknown");
  });

  it("reports the lease status as unavailable when the provider does not answer it", async () => {
    const { service, wallet, providerService } = setup({ leases: [createRpcLease()] });
    providerService.getLeaseStatus.mockRejectedValue(new Error("504"));

    const report = await service.probe({ wallet, dseq: DSEQ });

    expect(report.probeStatus).toBe("status_unavailable");
    expect(report.leases).toEqual([expect.objectContaining({ provider: PROVIDER, services: [] })]);
  });

  it("mints a read-only token and probes every running service through it", async () => {
    const { service, wallet, providerService, shellProbeService, logTailService } = setup({
      leases: [createRpcLease()],
      services: { ssh: 1, idle: 0 },
      shell: { status: "completed", output: "--loadavg\n18.21 18.41 18.65" }
    });

    await service.probe({ wallet, dseq: DSEQ });

    expect(providerService.toProviderAuth).toHaveBeenCalledWith({ walletId: wallet.id, provider: PROVIDER }, ["status", "logs", "shell"], { ttl: 120 });
    expect(shellProbeService.run).toHaveBeenCalledTimes(1);
    expect(shellProbeService.run).toHaveBeenCalledWith(
      expect.objectContaining({ hostUri: HOST_URI, providerAddress: PROVIDER, token: "jwt", dseq: DSEQ, gseq: 1, oseq: 1, service: "ssh" })
    );
    expect(logTailService.collect).toHaveBeenCalledWith(expect.objectContaining({ services: ["ssh"] }));
  });

  it("probes at most eight services per lease however many the provider reports", async () => {
    const { service, wallet, shellProbeService, logTailService, logger } = setup({
      leases: [createRpcLease()],
      services: Object.fromEntries(Array.from({ length: 12 }, (_, index) => [`svc${index}`, 1]))
    });

    await service.probe({ wallet, dseq: DSEQ });

    expect(shellProbeService.run).toHaveBeenCalledTimes(8);
    expect(logTailService.collect.mock.calls[0][0].services).toHaveLength(8);
    expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ event: "TRIAL_WORKLOAD_PROBE_SERVICES_CAPPED", reported: 12, probed: 8 }));
  });

  it("probes at most four leases per deployment however many the dseq has", async () => {
    const { service, wallet, shellProbeService, logger } = setup({
      leases: Array.from({ length: 7 }, (_, index) => createRpcLease({ gseq: index + 1 })),
      services: { ssh: 1 }
    });

    const report = await service.probe({ wallet, dseq: DSEQ });

    expect(report.leases).toHaveLength(4);
    expect(shellProbeService.run).toHaveBeenCalledTimes(4);
    expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ event: "TRIAL_WORKLOAD_PROBE_LEASES_CAPPED", reported: 7, probed: 4 }));
  });

  it("logs no cap warning when the lease and service counts are within bounds", async () => {
    const { service, wallet, logger } = setup({ leases: [createRpcLease()], services: { ssh: 1 } });

    await service.probe({ wallet, dseq: DSEQ });

    expect(logger.warn).not.toHaveBeenCalledWith(expect.objectContaining({ event: "TRIAL_WORKLOAD_PROBE_LEASES_CAPPED" }));
    expect(logger.warn).not.toHaveBeenCalledWith(expect.objectContaining({ event: "TRIAL_WORKLOAD_PROBE_SERVICES_CAPPED" }));
  });

  it("scans the shell output, the log tail and the stored SDL together", async () => {
    const { service, wallet } = setup({
      leases: [createRpcLease()],
      services: { ssh: 1 },
      sdl: "image: ubuntu\nenv:\n  - POOL=pool.example:3333",
      shell: { status: "completed", output: "42 comm=worker cmd=/tmp/worker -o stratum+tcp://pool.example:3333" },
      logs: ["[ssh]: Server listening on 0.0.0.0 port 22"]
    });

    const report = await service.probe({ wallet, dseq: DSEQ });

    expect(report.verdict).toBe("hard");
    expect(report.probeStatus).toBe("probed");
    expect(report.signals).toEqual([
      expect.objectContaining({ bucket: "soft", category: "pool-port", source: "sdl" }),
      expect.objectContaining({ bucket: "hard", category: "stratum-url", source: "shell", service: "ssh" }),
      expect.objectContaining({ bucket: "soft", category: "pool-port", source: "shell", service: "ssh" })
    ]);
    expect(report.excerpt).toContain("[hard/stratum-url] shell:ssh:");
    expect(report.excerpt).toContain("--- shell ssh");
  });

  it("keeps NUL bytes out of the excerpt it reports", async () => {
    const { service, wallet } = setup({
      leases: [createRpcLease()],
      services: { ssh: 1 },
      shell: { status: "completed", output: "--procs\n3917 comm=sh cmd=sh -c tr '\u0000' ' ' -o stratum+tcp://pool:3333" }
    });

    const report = await service.probe({ wallet, dseq: DSEQ });

    expect(report.verdict).toBe("hard");
    expect(report.excerpt).not.toContain("\u0000");
    expect(report.excerpt).toContain("\n--- shell ssh\n--procs\n3917 comm=sh cmd=sh -c tr ' ' ' ' -o stratum+tcp://pool:3333");
  });

  it("caps the excerpt it reports at 8192 characters", async () => {
    const { service, wallet } = setup({
      leases: [createRpcLease()],
      services: { ssh: 1 },
      shell: { status: "completed", output: `stratum+tcp://pool:3333\n${"x".repeat(9_000)}` }
    });

    const report = await service.probe({ wallet, dseq: DSEQ });

    expect(report.excerpt).toHaveLength(8_192);
  });

  it("still scans what it has when the container has no shell", async () => {
    const { service, wallet } = setup({
      leases: [createRpcLease()],
      services: { web: 1 },
      shell: { status: "shell_unavailable", output: "" },
      logs: ["[web]: connecting to stratum+tcp://pool.example:4444"]
    });

    const report = await service.probe({ wallet, dseq: DSEQ });

    expect(report.probeStatus).toBe("shell_unavailable");
    expect(report.verdict).toBe("hard");
    expect(report.leases[0].shellStatuses).toEqual(["shell_unavailable"]);
  });

  it("reports a lease with nothing running as such", async () => {
    const { service, wallet, shellProbeService } = setup({ leases: [createRpcLease()], services: { web: 0 } });

    const report = await service.probe({ wallet, dseq: DSEQ });

    expect(report.probeStatus).toBe("no_running_service");
    expect(shellProbeService.run).not.toHaveBeenCalled();
  });

  function createRpcLease(overrides: Partial<RpcLease["lease"]["id"]> = {}): RpcLease {
    return mock<RpcLease>({
      lease: { id: { owner: "akash1owner", dseq: DSEQ, gseq: 1, oseq: 1, provider: PROVIDER, bseq: 1, ...overrides }, state: "active" }
    });
  }

  function setup(input: {
    leases: RpcLease[];
    provider?: Provider | null;
    services?: Record<string, number>;
    sdl?: string | null;
    shell?: ShellProbeResult;
    logs?: string[];
  }) {
    const wallet = { ...createUserWallet({ isTrialing: true }), address: "akash1owner" };
    const leaseHttpService = mock<LeaseHttpService>();
    leaseHttpService.list.mockImplementation(async ({ state }) => ({
      leases: state === "active" ? input.leases : [],
      pagination: { next_key: null, total: "0" }
    }));
    const providerRepository = mock<ProviderRepository>();
    providerRepository.findActiveByAddress.mockResolvedValue(
      input.provider === undefined ? mock<Provider>({ owner: PROVIDER, hostUri: HOST_URI }) : input.provider
    );
    const providerService = mock<ProviderService>();
    providerService.toProviderAuth.mockResolvedValue({ type: "jwt", token: "jwt" });
    const leaseStatus = createLeaseStatus();
    leaseStatus.services = Object.fromEntries(
      Object.entries(input.services ?? {}).map(([name, available]) => [name, { ...leaseStatus.services.web, name, available, available_replicas: available }])
    );
    providerService.getLeaseStatus.mockResolvedValue(leaseStatus);
    const deploymentSettingRepository = mock<DeploymentSettingRepository>();
    deploymentSettingRepository.findOneBy.mockResolvedValue(mock<DeploymentSettingsOutput>({ sdl: input.sdl ?? null }));
    const shellProbeService = mock<ProviderShellProbeService>();
    shellProbeService.run.mockResolvedValue(input.shell ?? { status: "completed", output: "--loadavg\n0.10" });
    const logTailService = mock<ProviderLogTailService>();
    logTailService.collect.mockResolvedValue({ status: "completed", lines: input.logs ?? [] });
    const config = mockConfigService<WorkloadAbuseConfigService>({
      WORKLOAD_ABUSE_SIGNATURES: SIGNATURES,
      WORKLOAD_ABUSE_PROVIDER_JWT_TTL_SECONDS: 120
    });
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);

    const service = new TrialWorkloadProbeService(
      leaseHttpService,
      providerRepository,
      providerService,
      deploymentSettingRepository,
      shellProbeService,
      logTailService,
      config,
      createLogger
    );

    return { service, wallet, leaseHttpService, providerRepository, providerService, deploymentSettingRepository, shellProbeService, logTailService, logger };
  }
});
