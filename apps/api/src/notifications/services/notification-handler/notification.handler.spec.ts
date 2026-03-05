import { faker } from "@faker-js/faker";
import { mock } from "vitest-mock-extended";

import type { LoggerService } from "@src/core/providers/logging.provider";
import type { JobPayload } from "@src/core/services/job-queue/job-queue.service";
import type { NotificationDataResolverService } from "@src/notifications/services/notification-data-resolver/notification-data-resolver.service";
import type { UserRepository } from "@src/user/repositories";
import type { NotificationService } from "../notification/notification.service";
import { afterTrialEndsNotification } from "../notification-templates/after-trial-ends-notification";
import { beforeTrialEndsNotification } from "../notification-templates/before-trial-ends-notification";
import { startTrialNotification } from "../notification-templates/start-trial-notification";
import { trialEndedNotification } from "../notification-templates/trial-ended-notification";
import type { NotificationJob } from "./notification.handler";
import { NotificationHandler } from "./notification.handler";

import { UserSeeder } from "@test/seeders/user.seeder";

describe(NotificationHandler.name, () => {
  it("logs error and returns early for unknown notification template", async () => {
    const { handler, logger, notificationService } = setup();

    await handler.handle({
      template: "unknownTemplate",
      userId: "user-123",
      version: 1
    } as unknown as JobPayload<NotificationJob>);

    expect(logger.error).toHaveBeenCalledWith({
      event: "UNKNOWN_NOTIFICATION_TYPE",
      type: "unknownTemplate"
    });
    expect(notificationService.createNotification).not.toHaveBeenCalled();
  });

  it("logs warning and returns early when user is not found", async () => {
    const { handler, userRepository, logger, notificationService } = setup({
      findUserById: jest.fn().mockResolvedValue(null)
    });

    await handler.handle({
      template: "trialEnded",
      userId: "non-existent-user",
      vars: {
        paymentLink: faker.internet.url()
      },
      version: 1
    });

    expect(userRepository.findById).toHaveBeenCalledWith("non-existent-user");
    expect(logger.warn).toHaveBeenCalledWith({
      event: "NOTIFICATION_SEND_FAILED",
      userId: "non-existent-user",
      reason: "User or email not found"
    });
    expect(notificationService.createNotification).not.toHaveBeenCalled();
  });

  it("logs warning and returns early when user has no email", async () => {
    const user = UserSeeder.create({
      id: "user-123",
      email: null
    });

    const { handler, userRepository, logger, notificationService } = setup({
      findUserById: jest.fn().mockResolvedValue(user)
    });

    await handler.handle({
      template: "trialEnded",
      userId: user.id,
      vars: {
        paymentLink: faker.internet.url()
      },
      version: 1
    });

    expect(userRepository.findById).toHaveBeenCalledWith(user.id);
    expect(logger.warn).toHaveBeenCalledWith({
      event: "NOTIFICATION_SEND_FAILED",
      userId: user.id,
      reason: "User or email not found"
    });
    expect(notificationService.createNotification).not.toHaveBeenCalled();
  });

  it("returns early when conditions are not met", async () => {
    const user = UserSeeder.create({
      id: "user-123",
      email: "user@example.com",
      trial: false
    });

    const { handler, userRepository, notificationService } = setup({
      findUserById: jest.fn().mockResolvedValue(user)
    });

    await handler.handle({
      template: "trialEnded",
      userId: user.id,
      vars: {
        paymentLink: faker.internet.url()
      },
      conditions: { trial: true }, // User doesn't have trial: true
      version: 1
    });

    expect(userRepository.findById).toHaveBeenCalledWith(user.id);
    expect(notificationService.createNotification).not.toHaveBeenCalled();
  });

  it("creates notification when conditions are met", async () => {
    const user = UserSeeder.create({
      id: "user-123",
      email: "user@example.com",
      trial: true
    });

    const { handler, userRepository, notificationService } = setup({
      findUserById: jest.fn().mockResolvedValue(user)
    });
    const vars = {
      paymentLink: faker.internet.url()
    };

    await handler.handle({
      template: "trialEnded",
      userId: user.id,
      vars,
      conditions: { trial: true },
      version: 1
    });

    expect(userRepository.findById).toHaveBeenCalledWith(user.id);
    expect(notificationService.createNotification).toHaveBeenCalledWith(trialEndedNotification(user, vars));
  });

  it("creates notification when no conditions are provided", async () => {
    const user = UserSeeder.create({
      id: "user-123",
      email: "user@example.com"
    });

    const { handler, userRepository, notificationService } = setup({
      findUserById: jest.fn().mockResolvedValue(user)
    });

    const initialCredits = faker.number.int({ min: 5_000_000, max: 10_000_000 });
    await handler.handle({
      template: "startTrial",
      userId: user.id,
      version: 1,
      vars: {
        trialEndsAt: "2023-11-13T12:00:00Z",
        deploymentLifetimeInHours: 24,
        initialCredits
      }
    });

    expect(userRepository.findById).toHaveBeenCalledWith(user.id);
    expect(notificationService.createNotification).toHaveBeenCalledWith(
      startTrialNotification(user, {
        trialEndsAt: "2023-11-13T12:00:00Z",
        deploymentLifetimeInHours: 24,
        initialCredits
      })
    );
  });

  it("creates beforeTrialEnds notification with correct days calculation", async () => {
    const createdDate = new Date("2023-10-01T12:00:00Z");
    const currentDate = new Date("2023-10-15T12:00:00Z");

    jest.useFakeTimers({ now: currentDate });

    const user = UserSeeder.create({
      id: "user-123",
      email: "user@example.com",
      createdAt: createdDate,
      trial: true
    });
    const resolvedVars = { remainingCredits: faker.number.int({ min: 1000, max: 10000 }), activeDeployments: faker.number.int({ min: 0, max: 10 }) };
    const resolveVars = jest.fn().mockImplementation(async (user, vars) => ({
      ...vars,
      ...resolvedVars
    }));

    const { handler, userRepository, notificationService } = setup({
      findUserById: jest.fn().mockResolvedValue(user),
      resolveVars
    });

    const trialEndsAt = "2023-10-15T12:00:00Z";
    const paymentLink = faker.internet.url();
    await handler.handle({
      template: "beforeTrialEnds",
      userId: user.id,
      vars: { trialEndsAt, paymentLink, remainingCredits: "$resolved", activeDeployments: "$resolved" },
      conditions: { trial: true },
      version: 1
    });

    expect(userRepository.findById).toHaveBeenCalledWith(user.id);
    expect(notificationService.createNotification).toHaveBeenCalledWith(beforeTrialEndsNotification(user, { trialEndsAt, paymentLink, ...resolvedVars }));

    jest.useRealTimers();
  });

  it("creates afterTrialEnds notification", async () => {
    const user = UserSeeder.create({
      id: "user-123",
      email: "user@example.com",
      trial: true
    });

    const { handler, userRepository, notificationService } = setup({
      findUserById: jest.fn().mockResolvedValue(user)
    });

    const vars = {
      paymentLink: "https://example.com/payment"
    };
    await handler.handle({
      template: "afterTrialEnds",
      userId: user.id,
      conditions: { trial: true },
      vars,
      version: 1
    });

    expect(userRepository.findById).toHaveBeenCalledWith(user.id);
    expect(notificationService.createNotification).toHaveBeenCalledWith(afterTrialEndsNotification(user, vars));
  });

  it("handles complex conditions with multiple properties", async () => {
    const user = UserSeeder.create({
      id: "user-123",
      email: "user@example.com",
      trial: true,
      emailVerified: true
    });

    const { handler, userRepository, notificationService } = setup({
      findUserById: jest.fn().mockResolvedValue(user)
    });

    const vars = {
      paymentLink: faker.internet.url()
    };

    await handler.handle({
      template: "trialEnded",
      userId: user.id,
      vars,
      conditions: {
        trial: true,
        emailVerified: true
      },
      version: 1
    });

    expect(userRepository.findById).toHaveBeenCalledWith(user.id);
    expect(notificationService.createNotification).toHaveBeenCalledWith(trialEndedNotification(user, vars));
  });

  it("returns early when complex conditions are not met", async () => {
    const user = UserSeeder.create({
      id: "user-123",
      email: "user@example.com",
      trial: true,
      emailVerified: false // This doesn't match the condition
    });

    const { handler, userRepository, notificationService } = setup({
      findUserById: jest.fn().mockResolvedValue(user)
    });

    await handler.handle({
      template: "trialEnded",
      userId: user.id,
      vars: {
        paymentLink: faker.internet.url()
      },
      conditions: {
        trial: true,
        emailVerified: true
      },
      version: 1
    });

    expect(userRepository.findById).toHaveBeenCalledWith(user.id);
    expect(notificationService.createNotification).not.toHaveBeenCalled();
  });

  function setup(input?: {
    findUserById?: UserRepository["findById"];
    createNotification?: NotificationService["createNotification"];
    resolveVars?: NotificationDataResolverService["resolve"];
  }) {
    const mocks = {
      notificationService: mock<NotificationService>({
        createNotification: input?.createNotification ?? jest.fn().mockResolvedValue(undefined)
      }),
      userRepository: mock<UserRepository>({
        findById: input?.findUserById ?? jest.fn()
      }),
      notificationDataResolverService: mock<NotificationDataResolverService>({
        resolve: input?.resolveVars ?? jest.fn().mockImplementation(async (user, vars) => vars)
      }),
      logger: mock<LoggerService>()
    };

    const handler = new NotificationHandler(mocks.notificationService, mocks.logger, mocks.userRepository, mocks.notificationDataResolverService);

    return { handler, ...mocks };
  }
});
