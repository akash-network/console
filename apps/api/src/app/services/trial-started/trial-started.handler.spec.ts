import { faker } from "@faker-js/faker";
import { addDays, subDays } from "date-fns";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { UserWalletRepository } from "@src/billing/repositories";
import type { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import type { CreateLogger } from "@src/core/providers/logging.provider";
import type { JobQueueService } from "@src/core/services/job-queue/job-queue.service";
import type { NotificationService } from "@src/notifications/services/notification/notification.service";
import { NotificationJob } from "@src/notifications/services/notification-handler/notification.handler";
import { startTrialNotification } from "@src/notifications/services/notification-templates/start-trial-notification";
import type { UserRepository } from "@src/user/repositories";
import { TrialStartedHandler } from "./trial-started.handler";

import { createUser } from "@test/seeders/user.seeder";
import { createUserWallet } from "@test/seeders/user-wallet.seeder";
import { mockConfig } from "@test/services/mock-config.service";

describe(TrialStartedHandler.name, () => {
  describe("handle", () => {
    it("returns early when user is not found", async () => {
      const { handler, userRepository, notificationService, jobQueueManager, logger } = setup({
        findUserById: vi.fn().mockResolvedValue(null)
      });

      await handler.handle({ userId: "non-existent-user", version: 1 });

      expect(userRepository.findById).toHaveBeenCalledWith("non-existent-user");
      expect(notificationService.createNotification).not.toHaveBeenCalled();
      expect(jobQueueManager.enqueue).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ event: "TRIAL_STARTED_USER_NOT_FOUND" }));
    });

    it("returns early when the user's wallet is not found", async () => {
      const user = createUser({ id: "user-123", email: "user@example.com" });
      const { handler, userWalletRepository, notificationService, jobQueueManager, logger } = setup({
        findUserById: vi.fn().mockResolvedValue(user),
        findWalletByUserId: vi.fn().mockResolvedValue(undefined)
      });

      await handler.handle({ userId: user.id, version: 1 });

      expect(userWalletRepository.findOneByUserId).toHaveBeenCalledWith(user.id);
      expect(notificationService.createNotification).not.toHaveBeenCalled();
      expect(jobQueueManager.enqueue).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith({ event: "TRIAL_STARTED_WALLET_NOT_FOUND", userId: user.id });
    });

    it("does not send start trial notification when user has no email but enqueues notification jobs", async () => {
      const user = createUser({
        id: "user-123",
        email: null,
        emailVerified: false,
        subscribedToNewsletter: false
      });

      const { handler, userRepository, notificationService, jobQueueManager, logger } = setup({
        findUserById: vi.fn().mockResolvedValue(user),
        findWalletByUserId: vi.fn().mockResolvedValue(createUserWallet({ userId: user.id })),
        trialExpirationDays: 30
      });

      await handler.handle({ userId: user.id, version: 1 });

      expect(userRepository.findById).toHaveBeenCalledWith(user.id);
      expect(notificationService.createNotification).not.toHaveBeenCalled();
      expect(logger.warn).not.toHaveBeenCalled();
      expect(jobQueueManager.enqueue).toHaveBeenCalledTimes(4);
    });

    it("sends start trial notification when user has email and enqueues notification jobs", async () => {
      const TRIAL_STARTED_AT = new Date("2025-09-22T07:58:47.770Z");
      const TRIAL_ENDS_AT = "2025-10-22T07:58:47.770Z";
      const user = createUser({
        id: "user-123",
        email: "user@example.com",
        emailVerified: true,
        subscribedToNewsletter: true,
        createdAt: new Date("2025-08-01T10:00:00.000Z")
      });
      const deploymentLifetimeInHours = faker.number.int({ min: 1, max: 24 });

      const { handler, userRepository, notificationService, jobQueueManager, logger } = setup({
        findUserById: vi.fn().mockResolvedValue(user),
        findWalletByUserId: vi.fn().mockResolvedValue(createUserWallet({ userId: user.id, activatedAt: TRIAL_STARTED_AT })),
        trialExpirationDays: 30,
        deploymentLifetimeInHours
      });

      await handler.handle({ userId: user.id, version: 1 });

      expect(userRepository.findById).toHaveBeenCalledWith(user.id);
      expect(logger.info).toHaveBeenCalledWith({
        event: "START_TRIAL_NOTIFICATION_SENDING",
        userId: user.id
      });
      expect(notificationService.createNotification).toHaveBeenCalledWith(
        startTrialNotification(user, {
          trialEndsAt: TRIAL_ENDS_AT,
          deploymentLifetimeInHours
        })
      );
      expect(logger.info).toHaveBeenCalledWith({
        event: "START_TRIAL_NOTIFICATION_SENT",
        userId: user.id
      });
      expect(jobQueueManager.enqueue).toHaveBeenCalledTimes(4);
    });

    it("enqueues all notification jobs with correct timing and data", async () => {
      const user = createUser({
        id: "user-123",
        email: "user@example.com",
        emailVerified: true,
        subscribedToNewsletter: true,
        createdAt: new Date("2023-10-15T12:00:00Z")
      });
      const wallet = createUserWallet({ userId: user.id, activatedAt: new Date("2023-12-01T09:30:00Z") });

      const trialDays = 30;
      const trialEndsAt = addDays(wallet.activatedAt!, trialDays);

      const { handler, jobQueueManager, paymentLink } = setup({
        findUserById: vi.fn().mockResolvedValue(user),
        findWalletByUserId: vi.fn().mockResolvedValue(wallet),
        trialExpirationDays: trialDays
      });

      await handler.handle({ userId: user.id, version: 1 });

      expect(jobQueueManager.enqueue).toHaveBeenCalledWith(
        new NotificationJob({
          template: "beforeTrialEnds",
          userId: user.id,
          conditions: { trial: true },
          vars: {
            trialEndsAt: trialEndsAt.toISOString(),
            paymentLink,
            remainingCredits: "$resolved",
            activeDeployments: "$resolved",
            firstPurchaseBonus: "$resolved"
          }
        }),
        {
          singletonKey: `notification.beforeTrialEnds.${user.id}.${trialDays - 7}`,
          startAfter: subDays(trialEndsAt, 7).toISOString()
        }
      );

      expect(jobQueueManager.enqueue).toHaveBeenCalledWith(
        new NotificationJob({
          template: "beforeTrialEnds",
          userId: user.id,
          conditions: { trial: true },
          vars: {
            trialEndsAt: trialEndsAt.toISOString(),
            paymentLink,
            remainingCredits: "$resolved",
            activeDeployments: "$resolved",
            firstPurchaseBonus: "$resolved"
          }
        }),
        {
          singletonKey: `notification.beforeTrialEnds.${user.id}.${trialDays - 1}`,
          startAfter: subDays(trialEndsAt, 1).toISOString()
        }
      );

      expect(jobQueueManager.enqueue).toHaveBeenCalledWith(
        new NotificationJob({
          template: "trialEnded",
          userId: user.id,
          vars: {
            paymentLink,
            firstPurchaseBonus: "$resolved"
          },
          conditions: { trial: true }
        }),
        {
          singletonKey: `notification.trialEnded.${user.id}`,
          startAfter: trialEndsAt.toISOString()
        }
      );

      expect(jobQueueManager.enqueue).toHaveBeenCalledWith(
        new NotificationJob({
          template: "afterTrialEnds",
          userId: user.id,
          conditions: { trial: true },
          vars: {
            paymentLink,
            firstPurchaseBonus: "$resolved"
          }
        }),
        {
          singletonKey: `notification.afterTrialEnds.${user.id}.${trialDays + 7}`,
          startAfter: addDays(trialEndsAt, 7).toISOString()
        }
      );
    });

    it("handles different trial expiration days configuration", async () => {
      const user = createUser({
        id: "user-123",
        email: "user@example.com",
        emailVerified: true,
        subscribedToNewsletter: true,
        createdAt: new Date("2023-10-15T12:00:00Z")
      });
      const wallet = createUserWallet({ userId: user.id, activatedAt: new Date("2023-12-01T09:30:00Z") });

      const trialDays = 10;
      const trialEndsAt = addDays(wallet.activatedAt!, trialDays);

      const { handler, jobQueueManager } = setup({
        findUserById: vi.fn().mockResolvedValue(user),
        findWalletByUserId: vi.fn().mockResolvedValue(wallet),
        trialExpirationDays: trialDays
      });

      await handler.handle({ userId: user.id, version: 1 });

      expect(jobQueueManager.enqueue).toHaveBeenCalledWith(expect.any(NotificationJob), {
        singletonKey: `notification.beforeTrialEnds.${user.id}.3`,
        startAfter: subDays(trialEndsAt, 7).toISOString()
      });
      expect(jobQueueManager.enqueue).toHaveBeenCalledWith(expect.any(NotificationJob), {
        singletonKey: `notification.beforeTrialEnds.${user.id}.9`,
        startAfter: subDays(trialEndsAt, 1).toISOString()
      });
      expect(jobQueueManager.enqueue).toHaveBeenCalledWith(expect.any(NotificationJob), {
        singletonKey: `notification.trialEnded.${user.id}`,
        startAfter: trialEndsAt.toISOString()
      });
      expect(jobQueueManager.enqueue).toHaveBeenCalledWith(expect.any(NotificationJob), {
        singletonKey: `notification.afterTrialEnds.${user.id}.17`,
        startAfter: addDays(trialEndsAt, 7).toISOString()
      });
    });
  });

  it("creates the logger with the service context", () => {
    const { createLogger } = setup();

    expect(createLogger).toHaveBeenCalledWith({ context: TrialStartedHandler.name });
  });

  it("declares no permissions for its execution", () => {
    const { handler } = setup();

    expect(handler.requiresPermission()).toEqual([]);
  });

  function setup(input?: {
    findUserById?: UserRepository["findById"];
    findWalletByUserId?: UserWalletRepository["findOneByUserId"];
    createNotification?: NotificationService["createNotification"];
    enqueueJob?: JobQueueService["enqueue"];
    trialExpirationDays?: number;
    deploymentLifetimeInHours?: number;
  }) {
    const paymentLink = "https://console.akash.network/billing?openPayment=true";
    const mocks = {
      notificationService: mock<NotificationService>({
        createNotification: input?.createNotification ?? vi.fn().mockResolvedValue(undefined)
      }),
      jobQueueManager: mock<JobQueueService>({
        enqueue: input?.enqueueJob ?? vi.fn().mockResolvedValue(undefined)
      }),
      userRepository: mock<UserRepository>({
        findById: input?.findUserById ?? vi.fn()
      }),
      userWalletRepository: mock<UserWalletRepository>({
        findOneByUserId: input?.findWalletByUserId ?? vi.fn()
      }),
      logger: mock<ReturnType<CreateLogger>>(),
      coreConfig: mockConfig<BillingConfigService>({
        TRIAL_ALLOWANCE_EXPIRATION_DAYS: input?.trialExpirationDays ?? 30,
        CONSOLE_WEB_PAYMENT_LINK: paymentLink,
        TRIAL_DEPLOYMENT_CLEANUP_HOURS: input?.deploymentLifetimeInHours ?? 24
      })
    };

    const createLogger = vi.fn<CreateLogger>(() => mocks.logger);

    const handler = new TrialStartedHandler(
      mocks.notificationService,
      mocks.jobQueueManager,
      mocks.userRepository,
      mocks.userWalletRepository,
      createLogger,
      mocks.coreConfig
    );

    return { handler, createLogger, ...mocks, paymentLink };
  }
});
