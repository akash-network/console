import { addDays } from "date-fns";
import { mock } from "jest-mock-extended";

import type { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import type { LoggerService } from "@src/core/providers/logging.provider";
import type { JobQueueService } from "@src/core/services/job-queue/job-queue.service";
import type { NotificationService } from "@src/notifications/services/notification/notification.service";
import { NotificationJob } from "@src/notifications/services/notification-handler/notification.handler";
import type { UserRepository } from "@src/user/repositories";
import { TrialStartedHandler } from "./trial-started.handler";

import { UserSeeder } from "@test/seeders/user.seeder";

describe(TrialStartedHandler.name, () => {
  describe("handle", () => {
    it("returns early when user is not found", async () => {
      const { handler, userRepository, notificationService, jobQueueManager, logger } = setup({
        findUserById: jest.fn().mockResolvedValue(null)
      });

      await handler.handle({ userId: "non-existent-user" });

      expect(userRepository.findById).toHaveBeenCalledWith("non-existent-user");
      expect(notificationService.createNotification).not.toHaveBeenCalled();
      expect(jobQueueManager.enqueue).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ event: "TRIAL_STARTED_USER_NOT_FOUND" }));
    });

    it("does not send start trial notification when user has no email but enqueues notification jobs", async () => {
      const user = UserSeeder.create({
        id: "user-123",
        email: null,
        emailVerified: false,
        subscribedToNewsletter: false
      });

      const { handler, userRepository, notificationService, jobQueueManager, logger } = setup({
        findUserById: jest.fn().mockResolvedValue(user),
        trialExpirationDays: 30
      });

      await handler.handle({ userId: user.id });

      expect(userRepository.findById).toHaveBeenCalledWith(user.id);
      expect(notificationService.createNotification).not.toHaveBeenCalled();
      expect(logger.warn).not.toHaveBeenCalled();
      expect(jobQueueManager.enqueue).toHaveBeenCalledTimes(4);
    });

    it("sends start trial notification when user has email and enqueues notification jobs", async () => {
      const user = UserSeeder.create({
        id: "user-123",
        email: "user@example.com",
        emailVerified: true,
        subscribedToNewsletter: true
      });

      const { handler, userRepository, notificationService, jobQueueManager, logger } = setup({
        findUserById: jest.fn().mockResolvedValue(user),
        trialExpirationDays: 30
      });

      await handler.handle({ userId: user.id });

      expect(userRepository.findById).toHaveBeenCalledWith(user.id);
      expect(logger.info).toHaveBeenCalledWith({
        event: "START_TRIAL_NOTIFICATION_SENDING",
        userId: user.id
      });
      expect(notificationService.createNotification).toHaveBeenCalledWith({
        notificationId: `startTrial.${user.id}`,
        payload: {
          summary: "Start Trial",
          description: "You have started a trial of Akash Network"
        },
        user: {
          id: user.id,
          email: user.email
        }
      });
      expect(logger.info).toHaveBeenCalledWith({
        event: "START_TRIAL_NOTIFICATION_SENT",
        userId: user.id
      });
      expect(jobQueueManager.enqueue).toHaveBeenCalledTimes(4);
    });

    it("enqueues all notification jobs with correct timing and data", async () => {
      const currentDate = new Date("2023-10-15T12:00:00Z");
      const user = UserSeeder.create({
        id: "user-123",
        email: "user@example.com",
        emailVerified: true,
        subscribedToNewsletter: true,
        createdAt: currentDate
      });

      const trialDays = 14;
      const trialEndsAt = addDays(currentDate, trialDays).toISOString();
      jest.useFakeTimers({ now: currentDate });

      const { handler, jobQueueManager } = setup({
        findUserById: jest.fn().mockResolvedValue(user),
        trialExpirationDays: trialDays
      });

      await handler.handle({ userId: user.id });

      expect(jobQueueManager.enqueue).toHaveBeenCalledWith(
        new NotificationJob({
          template: "beforeTrialEnds",
          userId: user.id,
          conditions: { trial: true },
          vars: { trialEndsAt }
        }),
        {
          singletonKey: `beforeTrialEnds.${user.id}.${trialDays - 7}`,
          startAfter: addDays(currentDate, trialDays - 7)
        }
      );

      expect(jobQueueManager.enqueue).toHaveBeenCalledWith(
        new NotificationJob({
          template: "beforeTrialEnds",
          userId: user.id,
          conditions: { trial: true },
          vars: { trialEndsAt }
        }),
        {
          singletonKey: `beforeTrialEnds.${user.id}.${trialDays - 1}`,
          startAfter: addDays(currentDate, trialDays - 1)
        }
      );

      expect(jobQueueManager.enqueue).toHaveBeenCalledWith(
        new NotificationJob({
          template: "trialEnded",
          userId: user.id,
          conditions: { trial: true }
        }),
        {
          singletonKey: `trialEnded.${user.id}`,
          startAfter: addDays(currentDate, trialDays)
        }
      );

      expect(jobQueueManager.enqueue).toHaveBeenCalledWith(
        new NotificationJob({
          template: "afterTrialEnds",
          userId: user.id,
          conditions: { trial: true }
        }),
        {
          singletonKey: `afterTrialEnds.${user.id}`,
          startAfter: addDays(currentDate, trialDays + 7)
        }
      );

      jest.useRealTimers();
    });

    it("handles different trial expiration days configuration", async () => {
      const user = UserSeeder.create({
        id: "user-123",
        email: "user@example.com",
        emailVerified: true,
        subscribedToNewsletter: true
      });

      const trialDays = 7;
      const currentDate = new Date("2023-10-15T12:00:00Z");
      jest.useFakeTimers({ now: currentDate });

      const { handler, jobQueueManager } = setup({
        findUserById: jest.fn().mockResolvedValue(user),
        trialExpirationDays: trialDays
      });

      await handler.handle({ userId: user.id });

      expect(jobQueueManager.enqueue).toHaveBeenCalledWith(expect.any(NotificationJob), {
        singletonKey: `beforeTrialEnds.${user.id}.0`,
        startAfter: addDays(currentDate, 0) // Same day
      });

      expect(jobQueueManager.enqueue).toHaveBeenCalledWith(expect.any(NotificationJob), {
        singletonKey: `beforeTrialEnds.${user.id}.6`,
        startAfter: addDays(currentDate, 6)
      });

      jest.useRealTimers();
    });
  });

  function setup(input?: {
    findUserById?: UserRepository["findById"];
    createNotification?: NotificationService["createNotification"];
    enqueueJob?: JobQueueService["enqueue"];
    trialExpirationDays?: number;
  }) {
    const mocks = {
      notificationService: mock<NotificationService>({
        createNotification: input?.createNotification ?? jest.fn().mockResolvedValue(undefined)
      }),
      jobQueueManager: mock<JobQueueService>({
        enqueue: input?.enqueueJob ?? jest.fn().mockResolvedValue(undefined)
      }),
      userRepository: mock<UserRepository>({
        findById: input?.findUserById ?? jest.fn()
      }),
      logger: mock<LoggerService>(),
      coreConfig: mock<BillingConfigService>({
        get: jest.fn().mockReturnValue(input?.trialExpirationDays ?? 30)
      })
    };

    const handler = new TrialStartedHandler(mocks.notificationService, mocks.jobQueueManager, mocks.userRepository, mocks.logger, mocks.coreConfig);

    return { handler, ...mocks };
  }
});
