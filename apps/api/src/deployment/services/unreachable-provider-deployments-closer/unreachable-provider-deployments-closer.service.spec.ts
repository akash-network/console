import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { UserWalletRepository } from "@src/billing/repositories";
import type { CreateLogger, JobQueueService } from "@src/core";
import type { DeploymentSettingRepository, DeploymentSettingsOutput } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import type { ActiveLeaseOnProvider, LeaseRepository } from "@src/deployment/repositories/lease/lease.repository";
import type { DeploymentConfigService } from "@src/deployment/services/deployment-config/deployment-config.service";
import type { ProviderOutage, ProviderOutagesHttpService } from "@src/deployment/services/provider-outages-http/provider-outages-http.service";
import { UnreachableProviderDeploymentsCloserService } from "./unreachable-provider-deployments-closer.service";

import { mockConfigService } from "@test/mocks/config-service.mock";

const CLOSE_AFTER_DAYS = 14;
const OWNER = "akash1owner";
const DSEQ = "1784768430632";
const DARK_PROVIDER = "akash1dark";
const OTHER_DARK_PROVIDER = "akash1darker";
const HEALTHY_PROVIDER = "akash1healthy";
const DOWN_SINCE = "2026-07-24T00:00:00.000Z";
const LONGER_OUTAGE_SINCE = "2026-07-01T00:00:00.000Z";
const SINGLETON_KEY = `CloseUnreachableProviderDeploymentCommand.${OWNER}.${DSEQ}`;

describe(UnreachableProviderDeploymentsCloserService.name, () => {
  describe("closeUnreachableProviderDeployments", () => {
    it("asks for outages at least the configured number of days old", async () => {
      const { service, providerOutagesHttpService } = setup({});

      await service.closeUnreachableProviderDeployments({ dryRun: false });

      expect(providerOutagesHttpService.findOutagesOlderThanDays).toHaveBeenCalledWith(CLOSE_AFTER_DAYS);
    });

    it("hands a fully dark deployment to its own close job", async () => {
      const { service, jobQueueService } = setup({ outages: [anOutage({})], leases: [aLease({})] });

      const result = await service.closeUnreachableProviderDeployments({ dryRun: false });

      expect(result.ok).toBe(true);
      expect(jobQueueService.enqueue).toHaveBeenCalledWith(expect.objectContaining({ data: { owner: OWNER, dseq: DSEQ } }), { singletonKey: SINGLETON_KEY });
    });

    it("schedules nothing while one of its leases is still on a provider that answers", async () => {
      const { service, jobQueueService } = setup({ outages: [anOutage({})], leases: [aLease({}), aLease({ providerAddress: HEALTHY_PROVIDER })] });

      await service.closeUnreachableProviderDeployments({ dryRun: false });

      expect(jobQueueService.enqueue).not.toHaveBeenCalled();
    });

    it("schedules a deployment spread across several providers once all of them are dark", async () => {
      const { service, jobQueueService } = setup({
        outages: [anOutage({}), anOutage({ provider: OTHER_DARK_PROVIDER, startedAt: LONGER_OUTAGE_SINCE })],
        leases: [aLease({}), aLease({ providerAddress: OTHER_DARK_PROVIDER })]
      });

      await service.closeUnreachableProviderDeployments({ dryRun: false });

      expect(jobQueueService.enqueue).toHaveBeenCalledTimes(1);
    });

    it("leaves self-custody deployments alone", async () => {
      const { service, jobQueueService } = setup({ outages: [anOutage({})], leases: [aLease({})], wallet: null });

      await service.closeUnreachableProviderDeployments({ dryRun: false });

      expect(jobQueueService.enqueue).not.toHaveBeenCalled();
    });

    it("skips a deployment already recorded as closed", async () => {
      const { service, jobQueueService } = setup({
        outages: [anOutage({})],
        leases: [aLease({})],
        setting: mock<DeploymentSettingsOutput>({ closed: true })
      });

      await service.closeUnreachableProviderDeployments({ dryRun: false });

      expect(jobQueueService.enqueue).not.toHaveBeenCalled();
    });

    it("leaves a deployment that already holds a pending close job alone", async () => {
      const { service, jobQueueService } = setup({ outages: [anOutage({})], leases: [aLease({})], pendingKeys: [SINGLETON_KEY] });

      await service.closeUnreachableProviderDeployments({ dryRun: false });

      expect(jobQueueService.enqueue).not.toHaveBeenCalled();
    });

    it("schedules nothing on a dry run", async () => {
      const { service, jobQueueService } = setup({ outages: [anOutage({})], leases: [aLease({})] });

      const result = await service.closeUnreachableProviderDeployments({ dryRun: true });

      expect(result.ok).toBe(true);
      expect(jobQueueService.enqueue).not.toHaveBeenCalled();
      expect(jobQueueService.findPendingSingletonKeys).not.toHaveBeenCalled();
    });

    it("reports which deployments it would close on a dry run", async () => {
      const { service, logger } = setup({ outages: [anOutage({})], leases: [aLease({})] });

      await service.closeUnreachableProviderDeployments({ dryRun: true });

      expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ event: "UNREACHABLE_PROVIDER_DEPLOYMENT_WOULD_CLOSE", dseq: DSEQ, owner: OWNER }));
    });

    it("keeps scheduling the other deployments after one enqueue fails", async () => {
      const { service, jobQueueService } = setup({ outages: [anOutage({})], leases: [aLease({}), aLease({ owner: "akash1other", dseq: "999" })] });
      jobQueueService.enqueue.mockRejectedValueOnce(new Error("queue is down"));

      const result = await service.closeUnreachableProviderDeployments({ dryRun: false });

      expect(jobQueueService.enqueue).toHaveBeenCalledTimes(2);
      expect(result.err).toBe(true);
    });

    it("keeps screening the other deployments after one lookup fails", async () => {
      const { service, userWalletRepository, jobQueueService } = setup({
        outages: [anOutage({})],
        leases: [aLease({}), aLease({ owner: "akash1other", dseq: "999" })]
      });
      userWalletRepository.findOneByAddress.mockRejectedValueOnce(new Error("connection reset"));

      const result = await service.closeUnreachableProviderDeployments({ dryRun: false });

      expect(jobQueueService.enqueue).toHaveBeenCalledTimes(1);
      expect(result.err).toBe(true);
    });

    it("schedules nothing when the outage record cannot be trusted", async () => {
      const { service, providerOutagesHttpService, leaseRepository, jobQueueService } = setup({});
      providerOutagesHttpService.findOutagesOlderThanDays.mockRejectedValue(new Error("stale"));

      await expect(service.closeUnreachableProviderDeployments({ dryRun: false })).rejects.toThrow("stale");
      expect(leaseRepository.findActiveLeasesOfDeploymentsOnProviders).not.toHaveBeenCalled();
      expect(jobQueueService.enqueue).not.toHaveBeenCalled();
    });
  });

  describe("schedule", () => {
    it("throws when the queue refuses to create the job", async () => {
      const { service, jobQueueService } = setup({});
      jobQueueService.enqueue.mockResolvedValue(null);

      await expect(service.schedule({ owner: OWNER, dseq: DSEQ })).rejects.toThrow(DSEQ);
    });

    it("never asks the queue to start a job in the past", async () => {
      const { service, jobQueueService } = setup({});

      await service.schedule({ owner: OWNER, dseq: DSEQ }, { startAfter: new Date("2020-01-01T00:00:00.000Z") });

      const [, options] = jobQueueService.enqueue.mock.calls[0];
      expect(new Date(options!.startAfter as string).getTime()).toBeGreaterThan(new Date("2020-01-01T00:00:00.000Z").getTime());
    });
  });

  describe("findStillDarkDeployment", () => {
    it("resolves the deployment while every one of its leases is still dark", async () => {
      const { service } = setup({ outages: [anOutage({})], deploymentLeases: [aLease({})] });

      const result = await service.findStillDarkDeployment({ owner: OWNER, dseq: DSEQ });

      expect(result).toEqual({ owner: OWNER, dseq: DSEQ, hostUri: "https://dark:8443", downSince: DOWN_SINCE });
    });

    it("resolves nothing once one of its providers answers again", async () => {
      const { service } = setup({ outages: [anOutage({})], deploymentLeases: [aLease({}), aLease({ providerAddress: HEALTHY_PROVIDER })] });

      const result = await service.findStillDarkDeployment({ owner: OWNER, dseq: DSEQ });

      expect(result).toBeNull();
    });

    it("resolves nothing without asking about outages when the deployment has no active leases left", async () => {
      const { service, providerOutagesHttpService } = setup({ outages: [anOutage({})], deploymentLeases: [] });

      const result = await service.findStillDarkDeployment({ owner: OWNER, dseq: DSEQ });

      expect(result).toBeNull();
      expect(providerOutagesHttpService.findOutagesOlderThanDays).not.toHaveBeenCalled();
    });
  });

  function setup(input: {
    outages?: ProviderOutage[];
    leases?: ActiveLeaseOnProvider[];
    deploymentLeases?: ActiveLeaseOnProvider[];
    wallet?: null;
    setting?: DeploymentSettingsOutput;
    pendingKeys?: string[];
  }) {
    const providerOutagesHttpService = mock<ProviderOutagesHttpService>();
    providerOutagesHttpService.findOutagesOlderThanDays.mockResolvedValue(input.outages ?? []);

    const leaseRepository = mock<LeaseRepository>();
    leaseRepository.findActiveLeasesOfDeploymentsOnProviders.mockResolvedValue(input.leases ?? []);
    leaseRepository.findActiveLeasesOfDeployment.mockResolvedValue(input.deploymentLeases ?? []);

    const userWalletRepository = mock<UserWalletRepository>();
    userWalletRepository.findOneByAddress.mockImplementation(async address =>
      input.wallet === null ? undefined : mock<Awaited<ReturnType<UserWalletRepository["findOneByAddress"]>>>({ id: 7, userId: "user-1", address })
    );

    const deploymentSettingRepository = mock<DeploymentSettingRepository>();
    deploymentSettingRepository.findOneBy.mockResolvedValue(input.setting);

    const jobQueueService = mock<JobQueueService>();
    jobQueueService.enqueue.mockResolvedValue("job-id");
    jobQueueService.findPendingSingletonKeys.mockResolvedValue(new Set(input.pendingKeys ?? []));

    const config = mockConfigService<DeploymentConfigService>({ PROVIDER_UNREACHABLE_CLOSE_AFTER_DAYS: CLOSE_AFTER_DAYS });
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);

    const service = new UnreachableProviderDeploymentsCloserService(
      providerOutagesHttpService,
      leaseRepository,
      userWalletRepository,
      deploymentSettingRepository,
      jobQueueService,
      config,
      createLogger
    );

    return { service, providerOutagesHttpService, leaseRepository, userWalletRepository, deploymentSettingRepository, jobQueueService, logger };
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
