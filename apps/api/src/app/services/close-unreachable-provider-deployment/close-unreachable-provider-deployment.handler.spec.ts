import { afterEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { UserWalletRepository } from "@src/billing/repositories";
import type { ChainErrorService } from "@src/billing/services/chain-error/chain-error.service";
import type { CreateLogger, JobPayload, JobQueueService } from "@src/core";
import type { TxService } from "@src/core/services/tx/tx.service";
import type { CloseUnreachableProviderDeploymentCommand } from "@src/deployment/commands/close-unreachable-provider-deployment.command";
import type { DarkDeployment } from "@src/deployment/lib/dark-deployment/dark-deployment";
import type { DeploymentSettingRepository, DeploymentSettingsOutput } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import type { DeploymentConfigService } from "@src/deployment/services/deployment-config/deployment-config.service";
import type { DeploymentWriterService } from "@src/deployment/services/deployment-writer/deployment-writer.service";
import type { SystemCloseActivityService } from "@src/deployment/services/system-close-activity/system-close-activity.service";
import type { UnreachableProviderDeploymentsCloserService } from "@src/deployment/services/unreachable-provider-deployments-closer/unreachable-provider-deployments-closer.service";
import { CloseUnreachableProviderDeploymentHandler } from "./close-unreachable-provider-deployment.handler";

import { mockConfigService } from "@test/mocks/config-service.mock";
import { createOrganizationWallet, createUserWallet } from "@test/seeders/user-wallet.seeder";

const DEPLOY_WEB_BASE_URL = "https://console.akash.network";
const OWNER = "akash1owner";
const DSEQ = "1784768430632";
const HOST_URI = "https://dark:8443";
const DOWN_SINCE = "2026-07-01T00:00:00.000Z";
const NOW = "2026-07-31T00:00:00.000Z";
const DAYS_DOWN = 30;
const WALLET_ID = 7;
const ORGANIZATION_ID = "0b6f7c2e-3d4a-4e5f-8a9b-1c2d3e4f5a6b";
const USER_ID = "user-1";

describe(CloseUnreachableProviderDeploymentHandler.name, () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("closes a deployment whose every provider is still dark and records it", async () => {
    const { handler, deploymentWriterService, deploymentSettingRepository } = setup();

    await handler.handle(aPayload());

    expect(deploymentWriterService.close).toHaveBeenCalledWith(expect.objectContaining({ address: OWNER }), DSEQ, { reason: "provider_unreachable" });
    expect(deploymentSettingRepository.markClosed).toHaveBeenCalledWith({ userId: USER_ID, dseq: DSEQ, organizationId: ORGANIZATION_ID });
  });

  it("records the close in the owner's feed as Console's, because the provider stopped responding", async () => {
    const { handler, systemCloseActivityService } = setup();

    await handler.handle(aPayload());

    expect(systemCloseActivityService.record).toHaveBeenCalledWith({
      wallet: expect.objectContaining({ id: WALLET_ID, userId: USER_ID, organizationId: ORGANIZATION_ID, address: OWNER }),
      dseq: DSEQ,
      reason: "provider_unreachable"
    });
  });

  it("records a team deployment's close with the organization's wallet, so it reaches the member behind the deployment", async () => {
    const { handler, systemCloseActivityService } = setup({ teamWallet: true, setting: mock<DeploymentSettingsOutput>({ closed: false, userId: "member-2" }) });

    await handler.handle(aPayload());

    expect(systemCloseActivityService.record).toHaveBeenCalledWith({
      wallet: expect.objectContaining({ id: WALLET_ID, userId: null, organizationId: ORGANIZATION_ID, address: OWNER }),
      dseq: DSEQ,
      reason: "provider_unreachable"
    });
  });

  it("keeps the feed entry of a close it made when the transaction that marks it closed fails, so the retry neither loses nor repeats it", async () => {
    const { handler, systemCloseActivityService, txService } = setup();
    txService.transaction.mockRejectedValue(new Error("deadlock detected"));

    await expect(handler.handle(aPayload())).rejects.toThrow("deadlock detected");

    expect(systemCloseActivityService.record).toHaveBeenCalledTimes(1);
  });

  it("tells the owner which host went dark and for how long", async () => {
    vi.useFakeTimers({ now: new Date(NOW) });
    const { handler, jobQueueService } = setup();

    await handler.handle(aPayload());

    expect(jobQueueService.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          template: "providerUnreachableClosed",
          userId: USER_ID,
          vars: expect.objectContaining({ dseq: DSEQ, hostUri: HOST_URI, downForDays: DAYS_DOWN, redeployUrl: `${DEPLOY_WEB_BASE_URL}/new-deployment` })
        })
      }),
      { singletonKey: `notification.providerUnreachableClosed.${DSEQ}.${WALLET_ID}` }
    );
  });

  it("records the close and queues the email in one transaction", async () => {
    const { handler, txService } = setup();

    await handler.handle(aPayload());

    expect(txService.transaction).toHaveBeenCalledTimes(1);
  });

  it("leaves a self-custody deployment alone", async () => {
    const { handler, deploymentWriterService } = setup({ wallet: null });

    await handler.handle(aPayload());

    expect(deploymentWriterService.close).not.toHaveBeenCalled();
  });

  it("records a team deployment's close and tells the member who filed it", async () => {
    const { handler, deploymentWriterService, deploymentSettingRepository, jobQueueService } = setup({
      teamWallet: true,
      setting: mock<DeploymentSettingsOutput>({ closed: false, userId: "member-2" })
    });

    await handler.handle(aPayload());

    expect(deploymentWriterService.close).toHaveBeenCalledWith(expect.objectContaining({ id: WALLET_ID, userId: null }), DSEQ, {
      reason: "provider_unreachable"
    });
    expect(deploymentSettingRepository.markClosed).toHaveBeenCalledWith({ userId: "member-2", dseq: DSEQ, organizationId: ORGANIZATION_ID });
    expect(jobQueueService.enqueue).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ userId: "member-2" }) }), expect.anything());
  });

  it("closes a team deployment nobody filed without telling anyone", async () => {
    const { handler, deploymentWriterService, deploymentSettingRepository, jobQueueService } = setup({ teamWallet: true });

    await handler.handle(aPayload());

    expect(deploymentWriterService.close).toHaveBeenCalled();
    expect(deploymentSettingRepository.markClosed).not.toHaveBeenCalled();
    expect(jobQueueService.enqueue).not.toHaveBeenCalled();
  });

  it("skips a deployment already recorded as closed", async () => {
    const { handler, deploymentWriterService, closeJobService } = setup({ setting: mock<DeploymentSettingsOutput>({ closed: true }) });

    await handler.handle(aPayload());

    expect(deploymentWriterService.close).not.toHaveBeenCalled();
    expect(closeJobService.findStillDarkDeployment).not.toHaveBeenCalled();
  });

  it("closes nothing once a provider hosting the deployment answers again", async () => {
    const { handler, deploymentWriterService, deploymentSettingRepository, jobQueueService } = setup({ stillDark: null });

    await handler.handle(aPayload());

    expect(deploymentWriterService.close).not.toHaveBeenCalled();
    expect(deploymentSettingRepository.markClosed).not.toHaveBeenCalled();
    expect(jobQueueService.enqueue).not.toHaveBeenCalled();
  });

  it("tries again later when the chain will not settle the escrow yet", async () => {
    const { handler, closeJobService, deploymentSettingRepository, jobQueueService, systemCloseActivityService } = setup({
      closeError: new Error("escrow not settled"),
      isUnsettleable: true
    });

    await handler.handle(aPayload());

    expect(closeJobService.schedule).toHaveBeenCalledWith({ owner: OWNER, dseq: DSEQ }, { startAfter: expect.any(Date) });
    expect(deploymentSettingRepository.markClosed).not.toHaveBeenCalled();
    expect(jobQueueService.enqueue).not.toHaveBeenCalled();
    expect(systemCloseActivityService.record).not.toHaveBeenCalled();
  });

  it("throws any other close failure so the queue retries it", async () => {
    const { handler, closeJobService } = setup({ closeError: new Error("broadcast failed") });

    await expect(handler.handle(aPayload())).rejects.toThrow("broadcast failed");
    expect(closeJobService.schedule).not.toHaveBeenCalled();
  });

  it("still tells the owner when the close had already landed on chain, since a retry of its own broadcast looks the same", async () => {
    const { handler, deploymentSettingRepository, jobQueueService } = setup({ alreadyClosedOnChain: true });

    await handler.handle(aPayload());

    expect(deploymentSettingRepository.markClosed).toHaveBeenCalledWith({ userId: USER_ID, dseq: DSEQ, organizationId: ORGANIZATION_ID });
    expect(jobQueueService.enqueue).toHaveBeenCalledTimes(1);
  });

  it("adds nothing to the feed for a close that had already landed on chain, since only the close that went through records itself", async () => {
    const { handler, systemCloseActivityService } = setup({ alreadyClosedOnChain: true });

    await handler.handle(aPayload());

    expect(systemCloseActivityService.record).not.toHaveBeenCalled();
  });

  it("queues the email in the same transaction as the record, so neither can land without the other", async () => {
    const { handler, deploymentSettingRepository, jobQueueService, txService } = setup();
    txService.transaction.mockRejectedValue(new Error("deadlock detected"));

    await expect(handler.handle(aPayload())).rejects.toThrow("deadlock detected");
    expect(deploymentSettingRepository.markClosed).not.toHaveBeenCalled();
    expect(jobQueueService.enqueue).not.toHaveBeenCalled();
  });

  it("throws when recording the close fails so the queue retries it", async () => {
    const { handler, deploymentSettingRepository } = setup();
    deploymentSettingRepository.markClosed.mockRejectedValue(new Error("connection terminated"));

    await expect(handler.handle(aPayload())).rejects.toThrow("connection terminated");
  });

  it("declares no permissions for its execution", () => {
    const { handler } = setup();

    expect(handler.requiresPermission()).toEqual([]);
  });

  function aPayload(): JobPayload<CloseUnreachableProviderDeploymentCommand> {
    return { owner: OWNER, dseq: DSEQ, version: 1 };
  }

  function setup(
    input: {
      wallet?: null;
      teamWallet?: boolean;
      setting?: DeploymentSettingsOutput;
      stillDark?: DarkDeployment | null;
      closeError?: Error;
      isUnsettleable?: boolean;
      alreadyClosedOnChain?: boolean;
    } = {}
  ) {
    const userWalletRepository = mock<UserWalletRepository>();
    userWalletRepository.findOneByAddress.mockResolvedValue(
      input.wallet === null
        ? undefined
        : input.teamWallet
          ? createOrganizationWallet({ id: WALLET_ID, address: OWNER, organizationId: ORGANIZATION_ID })
          : createUserWallet({ id: WALLET_ID, userId: USER_ID, address: OWNER, organizationId: ORGANIZATION_ID })
    );

    const deploymentSettingRepository = mock<DeploymentSettingRepository>();
    deploymentSettingRepository.findOneOfWallet.mockResolvedValue(input.setting);

    const deploymentWriterService = mock<DeploymentWriterService>();
    if (input.closeError) {
      deploymentWriterService.close.mockRejectedValue(input.closeError);
    } else {
      deploymentWriterService.close.mockResolvedValue(!input.alreadyClosedOnChain);
    }

    const closeJobService = mock<UnreachableProviderDeploymentsCloserService>();
    closeJobService.findStillDarkDeployment.mockResolvedValue(
      input.stillDark === undefined ? { owner: OWNER, dseq: DSEQ, hostUri: HOST_URI, downSince: DOWN_SINCE } : input.stillDark
    );

    const chainErrorService = mock<ChainErrorService>();
    chainErrorService.isUnsettleableDeploymentError.mockReturnValue(input.isUnsettleable ?? false);

    const jobQueueService = mock<JobQueueService>();
    jobQueueService.enqueue.mockResolvedValue("job-id");

    const txService = mock<TxService>();
    txService.transaction.mockImplementation(async callback => await callback());

    const config = mockConfigService<DeploymentConfigService>({ DEPLOY_WEB_BASE_URL });
    const systemCloseActivityService = mock<SystemCloseActivityService>();
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);

    const handler = new CloseUnreachableProviderDeploymentHandler(
      userWalletRepository,
      deploymentSettingRepository,
      deploymentWriterService,
      closeJobService,
      chainErrorService,
      jobQueueService,
      txService,
      config,
      systemCloseActivityService,
      createLogger
    );

    return {
      handler,
      userWalletRepository,
      deploymentSettingRepository,
      deploymentWriterService,
      closeJobService,
      chainErrorService,
      jobQueueService,
      txService,
      systemCloseActivityService,
      logger
    };
  }
});
