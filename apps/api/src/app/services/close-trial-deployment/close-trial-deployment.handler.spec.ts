import type { DeploymentHttpService } from "@akashnetwork/http-sdk";
import { describe, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { UserWalletRepository } from "@src/billing/repositories";
import type { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import type { LoggerService } from "@src/core/providers/logging.provider";
import { JOB_NAME, type JobPayload, type JobQueueService } from "@src/core/services/job-queue/job-queue.service";
import type { GetDeploymentResponse } from "@src/deployment/http-schemas/deployment.schema";
import type { DeploymentWriterService } from "@src/deployment/services/deployment-writer/deployment-writer.service";
import { NotificationJob } from "@src/notifications/services/notification-handler/notification.handler";
import { CloseTrialDeployment, CloseTrialDeploymentHandler } from "./close-trial-deployment.handler";

import { UserWalletSeeder } from "@test/seeders/user-wallet.seeder";

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
    const wallet = UserWalletSeeder.create({
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
    const wallet = UserWalletSeeder.create({
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
    expect(deploymentWriterService.close).toHaveBeenCalledWith(wallet, payload.dseq);

    expect(jobQueueService.enqueue).toHaveBeenCalledWith(
      new NotificationJob({
        template: "trialDeploymentClosed",
        userId: wallet.userId!,
        vars: {
          dseq: payload.dseq,
          owner: wallet.address!,
          deploymentLifetimeInHours: 24
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

  it("logs debug and skips close and notification when deployment is already closed", async () => {
    const wallet = UserWalletSeeder.create({
      id: 123,
      userId: "user-123",
      address: "akash1test",
      isTrialing: true
    });

    const { handler, deploymentWriterService, jobQueueService, logger } = setup({
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
    const wallet = UserWalletSeeder.create({
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

  it("logs error when find deployment returns an error", async () => {
    const wallet = UserWalletSeeder.create({ id: 123, userId: "user-123", address: "akash1test", isTrialing: true });

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
    const wallet = UserWalletSeeder.create({
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
            UserWalletSeeder.create({
              id: 123,
              userId: "user-123",
              address: "akash1test",
              isTrialing: true
            })
          )
      }),
      logger: mock<LoggerService>(),
      jobQueueService: mock<JobQueueService>({
        enqueue: input?.enqueueJob ?? vi.fn().mockResolvedValue(undefined)
      }),
      deploymentWriterService: mock<DeploymentWriterService>({
        close: input?.closeDeployment ?? vi.fn().mockResolvedValue(undefined)
      }),
      deploymentService: mock<DeploymentHttpService>({
        findByOwnerAndDseq: input?.findDeployment ?? vi.fn().mockResolvedValue({ deployment: { state: "active" } })
      }),
      billingConfig: mock<BillingConfigService>({
        get: vi.fn().mockReturnValue(input?.trialDeploymentLifetimeInHours ?? 24)
      })
    };

    const handler = new CloseTrialDeploymentHandler(
      mocks.userWalletRepository,
      mocks.logger,
      mocks.jobQueueService,
      mocks.deploymentWriterService,
      mocks.deploymentService,
      mocks.billingConfig
    );

    return { handler, ...mocks };
  }
});
