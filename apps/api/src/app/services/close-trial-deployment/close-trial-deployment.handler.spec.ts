import { mock } from "vitest-mock-extended";

import type { UserWalletRepository } from "@src/billing/repositories";
import type { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import type { LoggerService } from "@src/core/providers/logging.provider";
import { JOB_NAME, type JobPayload, type JobQueueService } from "@src/core/services/job-queue/job-queue.service";
import type { GetDeploymentResponse } from "@src/deployment/http-schemas/deployment.schema";
import type { DeploymentReaderService } from "@src/deployment/services/deployment-reader/deployment-reader.service";
import type { DeploymentWriterService } from "@src/deployment/services/deployment-writer/deployment-writer.service";
import { NotificationJob } from "@src/notifications/services/notification-handler/notification.handler";
import { CloseTrialDeployment, CloseTrialDeploymentHandler } from "./close-trial-deployment.handler";

import { UserWalletSeeder } from "@test/seeders/user-wallet.seeder";

describe(CloseTrialDeploymentHandler.name, () => {
  it("logs warning and returns early when wallet is not found", async () => {
    const { handler, userWalletRepository, jobQueueService, logger, deploymentWriterService } = setup({
      findWalletById: jest.fn().mockResolvedValue(null)
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
      findWalletById: jest.fn().mockResolvedValue(wallet)
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
      findWalletById: jest.fn().mockResolvedValue(wallet),
      findDeployment: jest.fn().mockResolvedValue({ deployment: { state: "active" } } as GetDeploymentResponse["data"]),
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
      findWalletById: jest.fn().mockResolvedValue(wallet),
      findDeployment: jest.fn().mockResolvedValue({ deployment: { state: "closed" } } as GetDeploymentResponse["data"])
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
      reason: "Deployment is already closed",
      job: CloseTrialDeployment[JOB_NAME],
      walletId: payload.walletId,
      dseq: payload.dseq,
      userId: wallet.userId
    });
  });

  it("logs error and skips notification when close deployment fails", async () => {
    const wallet = UserWalletSeeder.create({
      id: 123,
      userId: "user-123",
      address: "akash1test",
      isTrialing: true
    });

    const closeError = new Error("Deployment closed");

    const { handler, jobQueueService, logger } = setup({
      findWalletById: jest.fn().mockResolvedValue(wallet),
      findDeployment: jest.fn().mockResolvedValue({ deployment: { state: "active" } } as GetDeploymentResponse["data"]),
      closeDeployment: jest.fn().mockRejectedValue(closeError)
    });

    const payload: JobPayload<CloseTrialDeployment> = {
      walletId: wallet.id,
      dseq: "test-dseq",
      version: 1
    };

    await handler.handle(payload);

    expect(jobQueueService.enqueue).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith({
      event: "CLOSE_TRIAL_DEPLOYMENT_FAILED",
      job: CloseTrialDeployment[JOB_NAME],
      walletId: payload.walletId,
      dseq: payload.dseq,
      userId: wallet.userId,
      error: closeError
    });
  });

  it("logs error and skips notification when fetching deployment fails", async () => {
    const wallet = UserWalletSeeder.create({
      id: 123,
      userId: "user-123",
      address: "akash1test",
      isTrialing: true
    });

    const fetchError = new Error("Deployment not found");

    const { handler, deploymentWriterService, jobQueueService, logger } = setup({
      findWalletById: jest.fn().mockResolvedValue(wallet),
      findDeployment: jest.fn().mockRejectedValue(fetchError)
    });

    const payload: JobPayload<CloseTrialDeployment> = {
      walletId: wallet.id,
      dseq: "test-dseq",
      version: 1
    };

    await handler.handle(payload);

    expect(deploymentWriterService.close).not.toHaveBeenCalled();
    expect(jobQueueService.enqueue).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith({
      event: "CLOSE_TRIAL_DEPLOYMENT_FAILED",
      job: CloseTrialDeployment[JOB_NAME],
      walletId: payload.walletId,
      dseq: payload.dseq,
      userId: wallet.userId,
      error: fetchError
    });
  });

  function setup(input?: {
    findWalletById?: UserWalletRepository["findById"];
    enqueueJob?: JobQueueService["enqueue"];
    closeDeployment?: DeploymentWriterService["close"];
    findDeployment?: DeploymentReaderService["findByWalletAndDseq"];
    trialDeploymentLifetimeInHours?: number;
  }) {
    const mocks = {
      userWalletRepository: mock<UserWalletRepository>({
        findById: input?.findWalletById ?? jest.fn()
      }),
      logger: mock<LoggerService>(),
      jobQueueService: mock<JobQueueService>({
        enqueue: input?.enqueueJob ?? jest.fn().mockResolvedValue(undefined)
      }),
      deploymentWriterService: mock<DeploymentWriterService>({
        close: input?.closeDeployment ?? jest.fn().mockResolvedValue(undefined)
      }),
      deploymentReaderService: mock<DeploymentReaderService>({
        findByWalletAndDseq: input?.findDeployment ?? jest.fn().mockResolvedValue({ deployment: { state: "active" } })
      }),
      billingConfig: mock<BillingConfigService>({
        get: jest.fn().mockReturnValue(input?.trialDeploymentLifetimeInHours ?? 24)
      })
    };

    const handler = new CloseTrialDeploymentHandler(
      mocks.userWalletRepository,
      mocks.logger,
      mocks.jobQueueService,
      mocks.deploymentWriterService,
      mocks.deploymentReaderService,
      mocks.billingConfig
    );

    return { handler, ...mocks };
  }
});
