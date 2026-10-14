import type { BalanceHttpService, DeploymentHttpService } from "@akashnetwork/http-sdk";
import createError from "http-errors";
import { describe, expect, it, onTestFinished, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { UserWalletRepository } from "@src/billing/repositories";
import type { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import { ChainErrorService } from "@src/billing/services/chain-error/chain-error.service";
import type { TxManagerService } from "@src/billing/services/tx-manager/tx-manager.service";
import type { CreateLogger } from "@src/core/providers/logging.provider";
import { JOB_NAME, type JobPayload, type JobQueueService } from "@src/core/services/job-queue/job-queue.service";
import type { GetDeploymentResponse } from "@src/deployment/http-schemas/deployment.schema";
import type { DeploymentWriterService } from "@src/deployment/services/deployment-writer/deployment-writer.service";
import type { SystemCloseActivityService } from "@src/deployment/services/system-close-activity/system-close-activity.service";
import { NotificationJob } from "@src/notifications/services/notification-handler/notification.handler";
import { CloseTrialDeployment, CloseTrialDeploymentHandler } from "./close-trial-deployment.handler";

import { mockConfigService } from "@test/mocks/config-service.mock";
import { createUserWallet } from "@test/seeders/user-wallet.seeder";

const PAYMENT_LINK = "https://console.akash.network/billing?payment=true";

describe(CloseTrialDeploymentHandler.name, () => {
  it("logs warning and returns early when wallet is not found", async () => {
    const { handler, userWalletRepository, jobQueueService, logger, deploymentWriterService } = setup({
      findWalletById: vi.fn().mockResolvedValue(null)
    });

    const payload: JobPayload<CloseTrialDeployment> = {
      walletId: 123,
      dseq: "test-dseq",
      version: 1
    };

    await handler.handle(payload);

    expect(userWalletRepository.findById).toHaveBeenCalledWith(payload.walletId);
    expect(deploymentWriterService.close).not.toHaveBeenCalled();
    expect(jobQueueService.enqueue).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith({
      event: "SKIP_CLOSE_TRIAL_DEPLOYMENT_JOB",
      reason: "Wallet not found",
      job: CloseTrialDeployment[JOB_NAME],
      walletId: payload.walletId,
      dseq: payload.dseq
    });
  });

  it("logs debug and returns early when wallet is not in trial", async () => {
    const wallet = createUserWallet({
      id: 123,
      userId: "user-123",
      address: "akash1test",
      isTrialing: false
    });

    const { handler, userWalletRepository, jobQueueService, logger, deploymentWriterService } = setup({
      findWalletById: vi.fn().mockResolvedValue(wallet)
    });

    const payload: JobPayload<CloseTrialDeployment> = {
      walletId: wallet.id,
      dseq: "test-dseq",
      version: 1
    };

    await handler.handle(payload);

    expect(userWalletRepository.findById).toHaveBeenCalledWith(payload.walletId);
    expect(deploymentWriterService.close).not.toHaveBeenCalled();
    expect(jobQueueService.enqueue).not.toHaveBeenCalled();
    expect(logger.debug).toHaveBeenCalledWith({
      event: "SKIP_CLOSE_TRIAL_DEPLOYMENT_JOB",
      reason: "Wallet is not in trial",
      job: CloseTrialDeployment[JOB_NAME],
      walletId: payload.walletId,
      dseq: payload.dseq,
      userId: wallet.userId
    });
  });

  it("closes deployment and enqueues notification when wallet is found and in trial", async () => {
    const wallet = createUserWallet({
      id: 123,
      userId: "user-123",
      address: "akash1test",
      isTrialing: true
    });

    const { handler, userWalletRepository, jobQueueService, logger, deploymentWriterService } = setup({
      findWalletById: vi.fn().mockResolvedValue(wallet),
      findDeployment: vi.fn().mockResolvedValue({ deployment: { state: "active" } } as GetDeploymentResponse["data"]),
      trialDeploymentLifetimeInHours: 24
    });

    const payload: JobPayload<CloseTrialDeployment> = {
      walletId: wallet.id,
      dseq: "test-dseq",
      version: 1
    };

    await handler.handle(payload);

    expect(userWalletRepository.findById).toHaveBeenCalledWith(payload.walletId);
    expect(deploymentWriterService.close).toHaveBeenCalledWith(wallet, payload.dseq, { reason: "trial_ended" });

    expect(jobQueueService.enqueue).toHaveBeenCalledWith(
      new NotificationJob({
        template: "trialDeploymentClosed",
        userId: wallet.userId!,
        vars: {
          dseq: payload.dseq,
          owner: wallet.address!,
          deploymentLifetimeInHours: 24,
          paymentLink: PAYMENT_LINK,
          firstPurchaseBonus: "$resolved"
        }
      }),
      {
        singletonKey: `notification.trialDeploymentClosed.${payload.dseq}.${wallet.id}`
      }
    );
    expect(jobQueueService.enqueue).toHaveBeenCalledTimes(1);

    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.debug).not.toHaveBeenCalled();
  });

  it("records the close in the owner's feed as Console's, because the trial ended", async () => {
    const wallet = createUserWallet({ id: 123, userId: "user-123", address: "akash1test", isTrialing: true });
    const { handler, systemCloseActivityService } = setup({ findWalletById: vi.fn().mockResolvedValue(wallet) });

    await handler.handle({ walletId: wallet.id, dseq: "test-dseq", version: 1 });

    expect(systemCloseActivityService.record).toHaveBeenCalledWith({ wallet, dseq: "test-dseq", reason: "trial_ended" });
  });

  it("records nothing but still tells the owner when the deployment had already closed, since whoever closed it reports that close", async () => {
    const { handler, systemCloseActivityService, jobQueueService } = setup({ closeDeployment: vi.fn().mockResolvedValue(false) });

    await handler.handle({ walletId: 123, dseq: "test-dseq", version: 1 });

    expect(systemCloseActivityService.record).not.toHaveBeenCalled();
    expect(jobQueueService.enqueue).toHaveBeenCalledWith(expect.any(NotificationJob), expect.anything());
  });

  it("logs debug and skips close and notification when deployment is already closed", async () => {
    const wallet = createUserWallet({
      id: 123,
      userId: "user-123",
      address: "akash1test",
      isTrialing: true
    });

    const { handler, deploymentWriterService, jobQueueService, systemCloseActivityService, logger } = setup({
      findWalletById: vi.fn().mockResolvedValue(wallet),
      findDeployment: vi.fn().mockResolvedValue({ deployment: { state: "closed" } } as GetDeploymentResponse["data"])
    });

    const payload: JobPayload<CloseTrialDeployment> = {
      walletId: wallet.id,
      dseq: "test-dseq",
      version: 1
    };

    await handler.handle(payload);

    expect(deploymentWriterService.close).not.toHaveBeenCalled();
    expect(jobQueueService.enqueue).not.toHaveBeenCalled();
    expect(systemCloseActivityService.record).not.toHaveBeenCalled();
    expect(logger.debug).toHaveBeenCalledWith({
      event: "SKIP_CLOSE_TRIAL_DEPLOYMENT_JOB",
      reason: "Deployment is not active",
      job: CloseTrialDeployment[JOB_NAME],
      walletId: payload.walletId,
      dseq: payload.dseq,
      userId: wallet.userId,
      deploymentState: "closed"
    });
  });

  it("skips notification when close deployment fails", async () => {
    const wallet = createUserWallet({
      id: 123,
      userId: "user-123",
      address: "akash1test",
      isTrialing: true
    });

    const closeError = new Error("Deployment closed");

    const { handler, jobQueueService } = setup({
      findWalletById: vi.fn().mockResolvedValue(wallet),
      findDeployment: vi.fn().mockResolvedValue({ deployment: { state: "active" } } as GetDeploymentResponse["data"]),
      closeDeployment: vi.fn().mockRejectedValue(closeError)
    });

    const payload: JobPayload<CloseTrialDeployment> = {
      walletId: wallet.id,
      dseq: "test-dseq",
      version: 1
    };

    await expect(handler.handle(payload)).rejects.toThrow();

    expect(jobQueueService.enqueue).not.toHaveBeenCalled();
  });

  it("logs the unsettleable event and tries again later, recording and telling nothing yet, when escrow cannot be settled", async () => {
    vi.useFakeTimers({ now: new Date("2026-10-08T12:00:00.000Z"), toFake: ["Date"] });
    onTestFinished(() => {
      vi.useRealTimers();
    });
    const wallet = createUserWallet({
      id: 123,
      userId: "user-123",
      address: "akash1test",
      isTrialing: true
    });

    const closeError = createError(400, "Deployment escrow cannot be settled yet", {
      originalError: new Error("Query failed with (6): rpc error: code = Unknown desc = recovered: negative decimal coin amount: -2.000000000000000000")
    });

    const { handler, jobQueueService, systemCloseActivityService, logger } = setup({
      findWalletById: vi.fn().mockResolvedValue(wallet),
      findDeployment: vi.fn().mockResolvedValue({ deployment: { state: "active" } } as GetDeploymentResponse["data"]),
      closeDeployment: vi.fn().mockRejectedValue(closeError)
    });

    const payload: JobPayload<CloseTrialDeployment> = {
      walletId: wallet.id,
      dseq: "test-dseq",
      version: 1
    };

    await expect(handler.handle(payload)).resolves.toBeUndefined();

    expect(jobQueueService.enqueue).toHaveBeenCalledTimes(1);
    expect(jobQueueService.enqueue).toHaveBeenCalledWith(new CloseTrialDeployment({ walletId: wallet.id, dseq: "test-dseq" }), {
      singletonKey: `closeTrialDeployment.test-dseq.${wallet.id}`,
      startAfter: "2026-10-08T12:15:00.000Z"
    });
    expect(systemCloseActivityService.record).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith({
      event: "CLOSE_TRIAL_DEPLOYMENT_UNSETTLEABLE",
      reason: "Deployment escrow cannot be settled yet; chain rejects close until it settles",
      job: CloseTrialDeployment[JOB_NAME],
      walletId: payload.walletId,
      dseq: payload.dseq,
      owner: wallet.address,
      userId: wallet.userId
    });
  });

  it("logs error when find deployment returns an error", async () => {
    const wallet = createUserWallet({ id: 123, userId: "user-123", address: "akash1test", isTrialing: true });

    const errorResponse = { code: "error_code", message: "Error message", details: "Error details" };
    const { handler, jobQueueService, logger } = setup({
      findWalletById: vi.fn().mockResolvedValue(wallet),
      findDeployment: vi.fn().mockResolvedValue(errorResponse as unknown as GetDeploymentResponse["data"])
    });

    await expect(
      handler.handle({
        walletId: wallet.id,
        dseq: "test-dseq",
        version: 1
      })
    ).rejects.toThrow();

    expect(jobQueueService.enqueue).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith({
      event: "CLOSE_TRIAL_DEPLOYMENT_ERROR",
      reason: errorResponse.message,
      details: errorResponse.details,
      job: CloseTrialDeployment[JOB_NAME],
      walletId: wallet.id,
      dseq: "test-dseq",
      userId: wallet.userId
    });
  });

  it("logs error when find deployment returns an error", async () => {
    const wallet = createUserWallet({
      id: 123,
      userId: "user-123",
      address: "akash1test",
      isTrialing: true
    });

    const { handler, jobQueueService, logger } = setup({
      findWalletById: vi.fn().mockResolvedValue(wallet),
      findDeployment: vi.fn().mockResolvedValue(undefined)
    });

    await expect(
      handler.handle({
        walletId: wallet.id,
        dseq: "test-dseq",
        version: 1
      })
    ).rejects.toThrow();

    expect(jobQueueService.enqueue).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith({
      event: "CLOSE_TRIAL_DEPLOYMENT_ERROR",
      reason: "Deployment not found",
      job: CloseTrialDeployment[JOB_NAME],
      walletId: wallet.id,
      dseq: "test-dseq",
      userId: wallet.userId
    });
  });

  it("creates the logger with the service context", () => {
    const { createLogger } = setup();

    expect(createLogger).toHaveBeenCalledWith({ context: CloseTrialDeploymentHandler.name });
  });

  it("declares no permissions for its execution", () => {
    const { handler } = setup();

    expect(handler.requiresPermission()).toEqual([]);
  });

  it("declares the stately policy, so a trial deployment has one close queued however often its lease is announced", () => {
    const { handler } = setup();

    expect(handler.policy).toBe("stately");
  });

  function setup(input?: {
    findWalletById?: UserWalletRepository["findById"];
    enqueueJob?: JobQueueService["enqueue"];
    closeDeployment?: DeploymentWriterService["close"];
    findDeployment?: DeploymentHttpService["findByOwnerAndDseq"];
    trialDeploymentLifetimeInHours?: number;
  }) {
    const mocks = {
      userWalletRepository: mock<UserWalletRepository>({
        findById:
          input?.findWalletById ??
          vi.fn(async () =>
            createUserWallet({
              id: 123,
              userId: "user-123",
              address: "akash1test",
              isTrialing: true
            })
          )
      }),
      logger: mock<ReturnType<CreateLogger>>(),
      jobQueueService: mock<JobQueueService>({
        enqueue: input?.enqueueJob ?? vi.fn().mockResolvedValue(undefined)
      }),
      deploymentWriterService: mock<DeploymentWriterService>({
        close: input?.closeDeployment ?? vi.fn().mockResolvedValue(true)
      }),
      deploymentService: mock<DeploymentHttpService>({
        findByOwnerAndDseq: input?.findDeployment ?? vi.fn().mockResolvedValue({ deployment: { state: "active" } })
      }),
      billingConfig: mockConfigService<BillingConfigService>({
        TRIAL_DEPLOYMENT_CLEANUP_HOURS: input?.trialDeploymentLifetimeInHours ?? 24,
        CONSOLE_WEB_PAYMENT_LINK: PAYMENT_LINK
      }),
      chainErrorService: new ChainErrorService(mock<BalanceHttpService>(), mock<BillingConfigService>(), mock<TxManagerService>()),
      systemCloseActivityService: mock<SystemCloseActivityService>()
    };

    const createLogger = vi.fn<CreateLogger>(() => mocks.logger);

    const handler = new CloseTrialDeploymentHandler(
      mocks.userWalletRepository,
      createLogger,
      mocks.jobQueueService,
      mocks.deploymentWriterService,
      mocks.deploymentService,
      mocks.billingConfig,
      mocks.chainErrorService,
      mocks.systemCloseActivityService
    );

    return { handler, createLogger, ...mocks };
  }
});
