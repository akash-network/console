import { addHours } from "date-fns";
import { mock } from "jest-mock-extended";

import { TrialDeploymentCreated } from "@src/billing/events/trial-deployment-created";
import type { UserWalletRepository } from "@src/billing/repositories";
import type { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import type { EventPayload } from "@src/core";
import { DOMAIN_EVENT_NAME } from "@src/core";
import type { LoggerService } from "@src/core/providers/logging.provider";
import type { JobQueueService } from "@src/core/services/job-queue/job-queue.service";
import { NotificationJob } from "@src/notifications/services/notification-handler/notification.handler";
import { CloseTrialDeployment } from "../close-trial-deployment/close-trial-deployment.handler";
import { TrialDeploymentCreatedHandler } from "./trial-deployment-created.handler";

import { UserWalletSeeder } from "@test/seeders/user-wallet.seeder";

describe(TrialDeploymentCreatedHandler.name, () => {
  it("logs a warning when wallet is not found", async () => {
    const { handler, userWalletRepository, jobQueueService, logger } = setup({
      findWalletById: jest.fn().mockResolvedValue(null)
    });

    const payload: EventPayload<TrialDeploymentCreated> = {
      walletId: 123,
      dseq: "test-dseq",
      createdAt: new Date().toISOString(),
      version: 1
    };

    await handler.handle(payload);

    expect(userWalletRepository.findById).toHaveBeenCalledWith(payload.walletId);
    expect(jobQueueService.enqueue).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith({
      event: "SKIP_TRIAL_DEPLOYMENT_CLOSING_TRIAL",
      reason: "Cannot find wallet by id",
      domainEvent: TrialDeploymentCreated[DOMAIN_EVENT_NAME],
      walletId: payload.walletId
    });
  });

  it("ignores non-trialing wallets", async () => {
    const wallet = UserWalletSeeder.create({
      id: 123,
      userId: "user-123",
      address: "akash1test",
      isTrialing: false
    });

    const { handler, userWalletRepository, jobQueueService, logger } = setup({
      findWalletById: jest.fn().mockResolvedValue(wallet)
    });

    const payload: EventPayload<TrialDeploymentCreated> = {
      walletId: wallet.id,
      dseq: "test-dseq",
      createdAt: new Date().toISOString(),
      version: 1
    };

    await handler.handle(payload);

    expect(userWalletRepository.findById).toHaveBeenCalledWith(payload.walletId);
    expect(jobQueueService.enqueue).not.toHaveBeenCalled();
    expect(logger.debug).toHaveBeenCalledWith({
      event: "SKIP_TRIAL_DEPLOYMENT_CLOSING_TRIAL",
      domainEvent: TrialDeploymentCreated[DOMAIN_EVENT_NAME],
      userId: wallet.userId,
      walletId: payload.walletId,
      dseq: payload.dseq,
      reason: "User wallet is not in trial anymore"
    });
  });

  it("enqueues notification and close job when wallet is in trial", async () => {
    const wallet = UserWalletSeeder.create({
      id: 123,
      userId: "user-123",
      address: "akash1test",
      isTrialing: true
    });

    const deploymentCreatedAt = new Date("2023-10-15T12:00:00Z");
    const trialDeploymentLifetimeInHours = 24;

    const { handler, userWalletRepository, jobQueueService, billingConfig } = setup({
      findWalletById: jest.fn().mockResolvedValue(wallet)
    });

    const payload: EventPayload<TrialDeploymentCreated> = {
      walletId: wallet.id,
      dseq: "test-dseq",
      createdAt: deploymentCreatedAt.toISOString(),
      version: 1
    };

    await handler.handle(payload);

    expect(userWalletRepository.findById).toHaveBeenCalledWith(payload.walletId);
    expect(billingConfig.get).toHaveBeenCalledWith("TRIAL_DEPLOYMENT_CLEANUP_HOURS");
    expect(jobQueueService.enqueue).toHaveBeenCalledWith(
      new NotificationJob({
        template: "beforeCloseTrialDeployment",
        userId: wallet.userId!,
        conditions: { trial: true },
        vars: {
          deploymentClosedAt: addHours(deploymentCreatedAt, trialDeploymentLifetimeInHours).toISOString(),
          dseq: payload.dseq,
          owner: wallet.address!
        }
      }),
      {
        startAfter: addHours(deploymentCreatedAt, trialDeploymentLifetimeInHours - 1).toISOString(),
        singletonKey: `notification.beforeCloseTrialDeployment.${payload.dseq}.${wallet.id}`
      }
    );
    expect(jobQueueService.enqueue).toHaveBeenCalledWith(
      new CloseTrialDeployment({
        walletId: wallet.id,
        dseq: payload.dseq
      }),
      {
        singletonKey: `closeTrialDeployment.${payload.dseq}.${wallet.id}`,
        startAfter: addHours(deploymentCreatedAt, trialDeploymentLifetimeInHours).toISOString()
      }
    );

    expect(jobQueueService.enqueue).toHaveBeenCalledTimes(2);
  });

  it("logs a warning when wallet address is missing", async () => {
    const wallet = UserWalletSeeder.create({
      id: 789,
      userId: "user-789",
      address: null,
      isTrialing: true
    });

    const { handler, jobQueueService, logger } = setup({
      findWalletById: jest.fn().mockResolvedValue(wallet)
    });

    const payload: EventPayload<TrialDeploymentCreated> = {
      walletId: wallet.id,
      dseq: "test-dseq-3",
      createdAt: new Date().toISOString(),
      version: 1
    };

    await handler.handle(payload);

    expect(jobQueueService.enqueue).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith({
      event: "SKIP_TRIAL_DEPLOYMENT_CLOSING_TRIAL",
      reason: "Wallet address is missing",
      domainEvent: TrialDeploymentCreated[DOMAIN_EVENT_NAME],
      dseq: payload.dseq,
      walletId: payload.walletId
    });
    expect(jobQueueService.enqueue).not.toHaveBeenCalled();
  });

  function setup(input?: {
    findWalletById?: UserWalletRepository["findById"];
    enqueueJob?: JobQueueService["enqueue"];
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
      billingConfig: mock<BillingConfigService>({
        get: jest.fn().mockReturnValue(input?.trialDeploymentLifetimeInHours ?? 24)
      })
    };

    const handler = new TrialDeploymentCreatedHandler(mocks.userWalletRepository, mocks.logger, mocks.jobQueueService, mocks.billingConfig);

    return { handler, ...mocks };
  }
});
