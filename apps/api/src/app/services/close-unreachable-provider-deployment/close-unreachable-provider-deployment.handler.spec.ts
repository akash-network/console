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
import type { UnreachableProviderDeploymentsCloserService } from "@src/deployment/services/unreachable-provider-deployments-closer/unreachable-provider-deployments-closer.service";
import { CloseUnreachableProviderDeploymentHandler } from "./close-unreachable-provider-deployment.handler";

import { mockConfigService } from "@test/mocks/config-service.mock";
import { createUserWallet } from "@test/seeders/user-wallet.seeder";

const DEPLOY_WEB_BASE_URL = "https://console.akash.network";
const OWNER = "akash1owner";
const DSEQ = "1784768430632";
const HOST_URI = "https://dark:8443";
const DOWN_SINCE = "2026-07-01T00:00:00.000Z";
const NOW = "2026-07-31T00:00:00.000Z";
const DAYS_DOWN = 30;
const WALLET_ID = 7;
const USER_ID = "user-1";

describe(CloseUnreachableProviderDeploymentHandler.name, () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("closes a deployment whose every provider is still dark and records it", async () => {
    const { handler, deploymentWriterService, deploymentSettingRepository } = setup();

    await handler.handle(aPayload());

    expect(deploymentWriterService.close).toHaveBeenCalledWith(expect.objectContaining({ address: OWNER }), DSEQ);
    expect(deploymentSettingRepository.markClosed).toHaveBeenCalledWith({ userId: USER_ID, dseq: DSEQ });
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
    const { handler, closeJobService, deploymentSettingRepository, jobQueueService } = setup({
      closeError: new Error("escrow not settled"),
      isUnsettleable: true
    });

    await handler.handle(aPayload());

    expect(closeJobService.schedule).toHaveBeenCalledWith({ owner: OWNER, dseq: DSEQ }, { startAfter: expect.any(Date) });
    expect(deploymentSettingRepository.markClosed).not.toHaveBeenCalled();
    expect(jobQueueService.enqueue).not.toHaveBeenCalled();
  });

  it("throws any other close failure so the queue retries it", async () => {
    const { handler, closeJobService } = setup({ closeError: new Error("broadcast failed") });

    await expect(handler.handle(aPayload())).rejects.toThrow("broadcast failed");
    expect(closeJobService.schedule).not.toHaveBeenCalled();
  });

  it("records a close that had already happened on chain without telling the owner about it", async () => {
    const { handler, deploymentSettingRepository, jobQueueService } = setup({ alreadyClosedOnChain: true });

    await handler.handle(aPayload());

    expect(deploymentSettingRepository.markClosed).toHaveBeenCalledWith({ userId: USER_ID, dseq: DSEQ });
    expect(jobQueueService.enqueue).not.toHaveBeenCalled();
  });

  it("throws when recording the close fails so the queue retries it", async () => {
    const { handler, deploymentSettingRepository } = setup();
    deploymentSettingRepository.markClosed.mockRejectedValue(new Error("connection terminated"));

    await expect(handler.handle(aPayload())).rejects.toThrow("connection terminated");
  });

  function aPayload(): JobPayload<CloseUnreachableProviderDeploymentCommand> {
    return { owner: OWNER, dseq: DSEQ, version: 1 };
  }

  function setup(
    input: {
      wallet?: null;
      setting?: DeploymentSettingsOutput;
      stillDark?: DarkDeployment | null;
      closeError?: Error;
      isUnsettleable?: boolean;
      alreadyClosedOnChain?: boolean;
    } = {}
  ) {
    const userWalletRepository = mock<UserWalletRepository>();
    userWalletRepository.findOneByAddress.mockResolvedValue(
      input.wallet === null ? undefined : createUserWallet({ id: WALLET_ID, userId: USER_ID, address: OWNER })
    );

    const deploymentSettingRepository = mock<DeploymentSettingRepository>();
    deploymentSettingRepository.findOneBy.mockResolvedValue(input.setting);

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
      logger
    };
  }
});
