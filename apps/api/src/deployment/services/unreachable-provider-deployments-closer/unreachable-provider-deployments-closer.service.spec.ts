import { afterEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { UserWalletRepository } from "@src/billing/repositories";
import type { ChainErrorService } from "@src/billing/services/chain-error/chain-error.service";
import type { CreateLogger, JobQueueService } from "@src/core";
import type { DeploymentSettingRepository, DeploymentSettingsOutput } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import type { ActiveLeaseOnProvider, LeaseRepository } from "@src/deployment/repositories/lease/lease.repository";
import type { DeploymentConfigService } from "@src/deployment/services/deployment-config/deployment-config.service";
import type { DeploymentWriterService } from "@src/deployment/services/deployment-writer/deployment-writer.service";
import type { ProviderOutage, ProviderOutagesHttpService } from "@src/deployment/services/provider-outages-http/provider-outages-http.service";
import { UnreachableProviderDeploymentsCloserService } from "./unreachable-provider-deployments-closer.service";

import { mockConfigService } from "@test/mocks/config-service.mock";

const CLOSE_AFTER_DAYS = 14;
const DEPLOY_WEB_BASE_URL = "https://console.akash.network";
const OWNER = "akash1owner";
const DSEQ = "1784768430632";
const DARK_PROVIDER = "akash1dark";
const OTHER_DARK_PROVIDER = "akash1darker";
const HEALTHY_PROVIDER = "akash1healthy";
const DOWN_SINCE = "2026-07-24T00:00:00.000Z";
const LONGER_OUTAGE_SINCE = "2026-07-01T00:00:00.000Z";
const NOW = "2026-07-31T00:00:00.000Z";
const DAYS_SINCE_LONGER_OUTAGE = 30;

describe(UnreachableProviderDeploymentsCloserService.name, () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("asks for outages at least the configured number of days old", async () => {
    const { service, providerOutagesHttpService } = setup({});

    await service.closeUnreachableProviderDeployments({ dryRun: false });

    expect(providerOutagesHttpService.findOutagesOlderThanDays).toHaveBeenCalledWith(CLOSE_AFTER_DAYS);
  });

  it("closes a deployment whose every lease sits on an unreachable provider", async () => {
    const { service, deploymentWriterService, deploymentSettingRepository } = setup({
      outages: [anOutage({})],
      leases: [aLease({})]
    });

    const result = await service.closeUnreachableProviderDeployments({ dryRun: false });

    expect(result.ok).toBe(true);
    expect(deploymentWriterService.close).toHaveBeenCalledWith(expect.objectContaining({ address: OWNER }), DSEQ);
    expect(deploymentSettingRepository.markClosed).toHaveBeenCalledWith({ userId: "user-1", dseq: DSEQ });
  });

  it("leaves a deployment alone while one of its leases is still on a provider that answers", async () => {
    const { service, deploymentWriterService } = setup({
      outages: [anOutage({})],
      leases: [aLease({}), aLease({ providerAddress: HEALTHY_PROVIDER })]
    });

    await service.closeUnreachableProviderDeployments({ dryRun: false });

    expect(deploymentWriterService.close).not.toHaveBeenCalled();
  });

  it("closes a deployment spread across several providers once all of them are dark, naming the one gone longest and for how long", async () => {
    vi.useFakeTimers({ now: new Date(NOW) });
    const { service, deploymentWriterService, jobQueueService } = setup({
      outages: [anOutage({}), anOutage({ provider: OTHER_DARK_PROVIDER, hostUri: "https://darker:8443", startedAt: LONGER_OUTAGE_SINCE })],
      leases: [aLease({}), aLease({ providerAddress: OTHER_DARK_PROVIDER })]
    });

    await service.closeUnreachableProviderDeployments({ dryRun: false });

    expect(deploymentWriterService.close).toHaveBeenCalledTimes(1);
    expect(jobQueueService.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          vars: expect.objectContaining({ hostUri: "https://darker:8443", downForDays: DAYS_SINCE_LONGER_OUTAGE })
        })
      }),
      expect.anything()
    );
  });

  it("tells the owner their deployment was closed and why", async () => {
    const { service, jobQueueService } = setup({
      outages: [anOutage({})],
      leases: [aLease({})]
    });

    await service.closeUnreachableProviderDeployments({ dryRun: false });

    expect(jobQueueService.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          template: "providerUnreachableClosed",
          userId: "user-1",
          vars: expect.objectContaining({ dseq: DSEQ, hostUri: "https://dark:8443" })
        })
      }),
      { singletonKey: `notification.providerUnreachableClosed.${DSEQ}.7` }
    );
  });

  it("leaves self-custody deployments alone", async () => {
    const { service, deploymentWriterService } = setup({
      outages: [anOutage({})],
      leases: [aLease({})],
      wallet: null
    });

    await service.closeUnreachableProviderDeployments({ dryRun: false });

    expect(deploymentWriterService.close).not.toHaveBeenCalled();
  });

  it("skips a deployment already recorded as closed", async () => {
    const { service, deploymentWriterService } = setup({
      outages: [anOutage({})],
      leases: [aLease({})],
      setting: mock<DeploymentSettingsOutput>({ closed: true })
    });

    await service.closeUnreachableProviderDeployments({ dryRun: false });

    expect(deploymentWriterService.close).not.toHaveBeenCalled();
  });

  it("closes nothing on a dry run", async () => {
    const { service, deploymentWriterService, deploymentSettingRepository, jobQueueService } = setup({
      outages: [anOutage({})],
      leases: [aLease({})]
    });

    await service.closeUnreachableProviderDeployments({ dryRun: true });

    expect(deploymentWriterService.close).not.toHaveBeenCalled();
    expect(deploymentSettingRepository.markClosed).not.toHaveBeenCalled();
    expect(jobQueueService.enqueue).not.toHaveBeenCalled();
  });

  it("moves on when the chain will not settle the escrow yet", async () => {
    const { service, deploymentWriterService, chainErrorService, deploymentSettingRepository } = setup({
      outages: [anOutage({})],
      leases: [aLease({})]
    });
    deploymentWriterService.close.mockRejectedValue(new Error("escrow not settled"));
    chainErrorService.isUnsettleableDeploymentError.mockReturnValue(true);

    const result = await service.closeUnreachableProviderDeployments({ dryRun: false });

    expect(result.ok).toBe(true);
    expect(deploymentSettingRepository.markClosed).not.toHaveBeenCalled();
  });

  it("keeps closing the other deployments after one close fails", async () => {
    const { service, deploymentWriterService } = setup({
      outages: [anOutage({})],
      leases: [aLease({}), aLease({ owner: "akash1other", dseq: "999" })]
    });
    deploymentWriterService.close.mockRejectedValueOnce(new Error("broadcast failed"));

    const result = await service.closeUnreachableProviderDeployments({ dryRun: false });

    expect(deploymentWriterService.close).toHaveBeenCalledTimes(2);
    expect(result.err).toBe(true);
  });

  it("still tells the owner when recording the close fails", async () => {
    const { service, deploymentSettingRepository, jobQueueService } = setup({
      outages: [anOutage({})],
      leases: [aLease({})]
    });
    deploymentSettingRepository.markClosed.mockRejectedValue(new Error("connection terminated"));

    const result = await service.closeUnreachableProviderDeployments({ dryRun: false });

    expect(result.err).toBe(true);
    expect(jobQueueService.enqueue).toHaveBeenCalledTimes(1);
  });

  it("reports a queue that refuses the closure email without undoing the close", async () => {
    const { service, jobQueueService, deploymentSettingRepository } = setup({
      outages: [anOutage({})],
      leases: [aLease({})]
    });
    jobQueueService.enqueue.mockRejectedValue(new Error("queue is down"));

    const result = await service.closeUnreachableProviderDeployments({ dryRun: false });

    expect(result.err).toBe(true);
    expect(deploymentSettingRepository.markClosed).toHaveBeenCalledWith({ userId: "user-1", dseq: DSEQ });
  });

  it("closes nothing when the outage record cannot be trusted", async () => {
    const { service, providerOutagesHttpService, leaseRepository, deploymentWriterService } = setup({});
    providerOutagesHttpService.findOutagesOlderThanDays.mockRejectedValue(new Error("stale"));

    await expect(service.closeUnreachableProviderDeployments({ dryRun: false })).rejects.toThrow("stale");
    expect(leaseRepository.findActiveLeasesOfDeploymentsOnProviders).not.toHaveBeenCalled();
    expect(deploymentWriterService.close).not.toHaveBeenCalled();
  });

  function setup(input: { outages?: ProviderOutage[]; leases?: ActiveLeaseOnProvider[]; wallet?: null; setting?: DeploymentSettingsOutput }) {
    const providerOutagesHttpService = mock<ProviderOutagesHttpService>();
    providerOutagesHttpService.findOutagesOlderThanDays.mockResolvedValue(input.outages ?? []);

    const leaseRepository = mock<LeaseRepository>();
    leaseRepository.findActiveLeasesOfDeploymentsOnProviders.mockResolvedValue(input.leases ?? []);

    const userWalletRepository = mock<UserWalletRepository>();
    userWalletRepository.findOneByAddress.mockImplementation(async address =>
      input.wallet === null ? undefined : mock<Awaited<ReturnType<UserWalletRepository["findOneByAddress"]>>>({ id: 7, userId: "user-1", address })
    );

    const deploymentSettingRepository = mock<DeploymentSettingRepository>();
    deploymentSettingRepository.findOneBy.mockResolvedValue(input.setting);

    const deploymentWriterService = mock<DeploymentWriterService>();
    const chainErrorService = mock<ChainErrorService>();
    chainErrorService.isUnsettleableDeploymentError.mockReturnValue(false);
    const jobQueueService = mock<JobQueueService>();

    const config = mockConfigService<DeploymentConfigService>({
      PROVIDER_UNREACHABLE_CLOSE_AFTER_DAYS: CLOSE_AFTER_DAYS,
      DEPLOY_WEB_BASE_URL
    });
    const createLogger = vi.fn<CreateLogger>(() => mock<ReturnType<CreateLogger>>());

    const service = new UnreachableProviderDeploymentsCloserService(
      providerOutagesHttpService,
      leaseRepository,
      userWalletRepository,
      deploymentSettingRepository,
      deploymentWriterService,
      chainErrorService,
      jobQueueService,
      config,
      createLogger
    );

    return {
      service,
      providerOutagesHttpService,
      leaseRepository,
      userWalletRepository,
      deploymentSettingRepository,
      deploymentWriterService,
      chainErrorService,
      jobQueueService
    };
  }
});

function anOutage(overrides: Partial<ProviderOutage>): ProviderOutage {
  return {
    provider: overrides.provider ?? DARK_PROVIDER,
    hostUri: overrides.hostUri ?? "https://dark:8443",
    startedAt: overrides.startedAt ?? DOWN_SINCE
  };
}

function aLease(overrides: Partial<ActiveLeaseOnProvider>): ActiveLeaseOnProvider {
  return {
    owner: overrides.owner ?? OWNER,
    dseq: overrides.dseq ?? DSEQ,
    providerAddress: overrides.providerAddress ?? DARK_PROVIDER
  };
}
