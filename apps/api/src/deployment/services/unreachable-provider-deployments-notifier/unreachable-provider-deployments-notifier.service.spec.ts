import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { UserWalletOutput, UserWalletRepository } from "@src/billing/repositories";
import type { CreateLogger } from "@src/core";
import type { DeploymentSettingRepository, DeploymentSettingsOutput } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import type { ActiveLeaseOnProvider, LeaseRepository } from "@src/deployment/repositories/lease/lease.repository";
import type { DeploymentConfigService } from "@src/deployment/services/deployment-config/deployment-config.service";
import type { ProviderOutage, ProviderOutagesHttpService } from "@src/deployment/services/provider-outages-http/provider-outages-http.service";
import type { NotificationService } from "@src/notifications/services/notification/notification.service";
import type { UserOutput, UserRepository } from "@src/user/repositories";
import { UnreachableProviderDeploymentsNotifierService } from "./unreachable-provider-deployments-notifier.service";

import { mockConfigService } from "@test/mocks/config-service.mock";

const NOTIFY_AFTER_DAYS = 3;
const CLOSE_AFTER_DAYS = 14;
const DEPLOY_WEB_BASE_URL = "https://console.akash.network";
const OWNER = "akash1owner";
const DSEQ = "1784768430632";
const DARK_PROVIDER = "akash1dark";
const HEALTHY_PROVIDER = "akash1healthy";
const DOWN_SINCE = "2026-07-24T00:00:00.000Z";
const LONGER_OUTAGE_SINCE = "2026-07-01T00:00:00.000Z";

describe(UnreachableProviderDeploymentsNotifierService.name, () => {
  it("asks for outages at least the configured number of days old", async () => {
    const { service, providerOutagesHttpService } = setup({});

    await service.notifyUnreachableProviderDeployments({ dryRun: false });

    expect(providerOutagesHttpService.findOutagesOlderThanDays).toHaveBeenCalledWith(NOTIFY_AFTER_DAYS);
  });

  it("emails the owner naming the deployment, the host and where to close it", async () => {
    const { service, notificationService } = setup({
      outages: [anOutage({})],
      leases: [aLease({})]
    });

    await service.notifyUnreachableProviderDeployments({ dryRun: false });

    expect(notificationService.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          description: expect.stringContaining(DSEQ)
        })
      })
    );
    const [{ payload }] = notificationService.createNotification.mock.calls[0];
    expect(payload.description).toContain("<strong>dark</strong>");
    expect(payload.description).toContain(`${DEPLOY_WEB_BASE_URL}/deployments/${DSEQ}`);
  });

  it("claims the outage before sending so a repeat sweep cannot email twice", async () => {
    const { service, deploymentSettingRepository } = setup({
      outages: [anOutage({})],
      leases: [aLease({})]
    });

    await service.notifyUnreachableProviderDeployments({ dryRun: false });

    expect(deploymentSettingRepository.claimProviderUnreachableNotification).toHaveBeenCalledWith({
      userId: "user-1",
      dseq: DSEQ,
      downSinceMarker: DOWN_SINCE
    });
  });

  it("warns about a deployment as soon as one of its leases is dark", async () => {
    const { service, notificationService } = setup({
      outages: [anOutage({})],
      leases: [aLease({}), aLease({ providerAddress: HEALTHY_PROVIDER })]
    });

    await service.notifyUnreachableProviderDeployments({ dryRun: false });

    expect(notificationService.createNotification).toHaveBeenCalledTimes(1);
  });

  it("tells the owner how long the deployment has before it is closed for them", async () => {
    const { service, notificationService } = setup({
      outages: [anOutage({})],
      leases: [aLease({})]
    });

    await service.notifyUnreachableProviderDeployments({ dryRun: false });

    const [{ payload }] = notificationService.createNotification.mock.calls[0];
    expect(payload.description).toContain(`${CLOSE_AFTER_DAYS} days`);
  });

  it("reports the longest of several outages so the age names the real problem", async () => {
    const { service, deploymentSettingRepository } = setup({
      outages: [anOutage({}), anOutage({ provider: HEALTHY_PROVIDER, hostUri: "https://other:8443", startedAt: LONGER_OUTAGE_SINCE })],
      leases: [aLease({}), aLease({ providerAddress: HEALTHY_PROVIDER })]
    });

    await service.notifyUnreachableProviderDeployments({ dryRun: false });

    expect(deploymentSettingRepository.claimProviderUnreachableNotification).toHaveBeenCalledWith(
      expect.objectContaining({ downSinceMarker: LONGER_OUTAGE_SINCE })
    );
  });

  it("leaves self-custody deployments alone", async () => {
    const { service, notificationService, deploymentSettingRepository } = setup({
      outages: [anOutage({})],
      leases: [aLease({})],
      wallet: null
    });

    await service.notifyUnreachableProviderDeployments({ dryRun: false });

    expect(notificationService.createNotification).not.toHaveBeenCalled();
    expect(deploymentSettingRepository.claimProviderUnreachableNotification).not.toHaveBeenCalled();
  });

  it("does not claim an outage for an owner with no email to send to", async () => {
    const { service, notificationService, deploymentSettingRepository } = setup({
      outages: [anOutage({})],
      leases: [aLease({})],
      user: mock<UserOutput>({ id: "user-1", email: null })
    });

    await service.notifyUnreachableProviderDeployments({ dryRun: false });

    expect(notificationService.createNotification).not.toHaveBeenCalled();
    expect(deploymentSettingRepository.claimProviderUnreachableNotification).not.toHaveBeenCalled();
  });

  it("skips an outage already reported for this deployment without touching the claim", async () => {
    const { service, notificationService, deploymentSettingRepository } = setup({
      outages: [anOutage({})],
      leases: [aLease({})],
      setting: mock<DeploymentSettingsOutput>({ providerUnreachableNotifiedFor: new Date(DOWN_SINCE) })
    });

    await service.notifyUnreachableProviderDeployments({ dryRun: false });

    expect(notificationService.createNotification).not.toHaveBeenCalled();
    expect(deploymentSettingRepository.claimProviderUnreachableNotification).not.toHaveBeenCalled();
  });

  it("sends nothing on a dry run", async () => {
    const { service, notificationService, deploymentSettingRepository } = setup({
      outages: [anOutage({})],
      leases: [aLease({})]
    });

    await service.notifyUnreachableProviderDeployments({ dryRun: true });

    expect(notificationService.createNotification).not.toHaveBeenCalled();
    expect(deploymentSettingRepository.claimProviderUnreachableNotification).not.toHaveBeenCalled();
  });

  it("sends nothing when another pass took the claim first", async () => {
    const { service, notificationService } = setup({
      outages: [anOutage({})],
      leases: [aLease({})],
      claimed: false
    });

    await service.notifyUnreachableProviderDeployments({ dryRun: false });

    expect(notificationService.createNotification).not.toHaveBeenCalled();
  });

  it("gives the claim back and reports the failure when the email is rejected", async () => {
    const { service, notificationService, deploymentSettingRepository } = setup({
      outages: [anOutage({})],
      leases: [aLease({})]
    });
    notificationService.createNotification.mockRejectedValue(new Error("novu is down"));

    const result = await service.notifyUnreachableProviderDeployments({ dryRun: false });

    expect(result.err).toBe(true);
    expect(deploymentSettingRepository.releaseProviderUnreachableClaim).toHaveBeenCalledWith({
      userId: "user-1",
      dseq: DSEQ,
      downSinceMarker: DOWN_SINCE
    });
  });

  it("keeps warning the other owners after one email fails", async () => {
    const { service, notificationService } = setup({
      outages: [anOutage({})],
      leases: [aLease({}), aLease({ owner: "akash1other", dseq: "999" })]
    });
    notificationService.createNotification.mockRejectedValueOnce(new Error("novu is down"));

    const result = await service.notifyUnreachableProviderDeployments({ dryRun: false });

    expect(notificationService.createNotification).toHaveBeenCalledTimes(2);
    expect(result.err).toBe(true);
  });

  it("does nothing at all when the outage record cannot be trusted", async () => {
    const { service, providerOutagesHttpService, leaseRepository, notificationService } = setup({});
    providerOutagesHttpService.findOutagesOlderThanDays.mockRejectedValue(new Error("stale"));

    await expect(service.notifyUnreachableProviderDeployments({ dryRun: false })).rejects.toThrow("stale");
    expect(leaseRepository.findActiveLeasesOfDeploymentsOnProviders).not.toHaveBeenCalled();
    expect(notificationService.createNotification).not.toHaveBeenCalled();
  });

  function setup(input: {
    outages?: ProviderOutage[];
    leases?: ActiveLeaseOnProvider[];
    wallet?: { userId: string } | null;
    user?: UserOutput;
    setting?: DeploymentSettingsOutput;
    claimed?: boolean;
  }) {
    const providerOutagesHttpService = mock<ProviderOutagesHttpService>();
    providerOutagesHttpService.findOutagesOlderThanDays.mockResolvedValue(input.outages ?? []);

    const leaseRepository = mock<LeaseRepository>();
    leaseRepository.findActiveLeasesOfDeploymentsOnProviders.mockResolvedValue(input.leases ?? []);

    const userWalletRepository = mock<UserWalletRepository>();
    userWalletRepository.findByAddresses.mockImplementation(async addresses =>
      input.wallet === null ? [] : addresses.map(address => mock<UserWalletOutput>({ userId: "user-1", address }))
    );

    const deploymentSettingRepository = mock<DeploymentSettingRepository>();
    deploymentSettingRepository.findOneBy.mockResolvedValue(input.setting);
    deploymentSettingRepository.claimProviderUnreachableNotification.mockResolvedValue(input.claimed ?? true);

    const userRepository = mock<UserRepository>();
    userRepository.findById.mockResolvedValue(input.user ?? mock<UserOutput>({ id: "user-1", email: "owner@example.com" }));

    const notificationService = mock<NotificationService>();
    const config = mockConfigService<DeploymentConfigService>({
      PROVIDER_UNREACHABLE_NOTIFY_AFTER_DAYS: NOTIFY_AFTER_DAYS,
      PROVIDER_UNREACHABLE_CLOSE_AFTER_DAYS: CLOSE_AFTER_DAYS,
      DEPLOY_WEB_BASE_URL
    });
    const createLogger = vi.fn<CreateLogger>(() => mock<ReturnType<CreateLogger>>());

    const service = new UnreachableProviderDeploymentsNotifierService(
      providerOutagesHttpService,
      leaseRepository,
      userWalletRepository,
      deploymentSettingRepository,
      userRepository,
      notificationService,
      config,
      createLogger
    );

    return { service, providerOutagesHttpService, leaseRepository, userWalletRepository, deploymentSettingRepository, userRepository, notificationService };
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
