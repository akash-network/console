import { mock } from "jest-mock-extended";

import type { LoggerService } from "@src/core/providers/logging.provider";
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
      userId: "user-123"
    } as unknown as NotificationJob["data"]);

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
      userId: "non-existent-user"
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
      userId: user.id
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
      conditions: { trial: true } // User doesn't have trial: true
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

    await handler.handle({
      template: "trialEnded",
      userId: user.id,
      conditions: { trial: true }
    });

    expect(userRepository.findById).toHaveBeenCalledWith(user.id);
    expect(notificationService.createNotification).toHaveBeenCalledWith(trialEndedNotification(user));
  });

  it("creates notification when no conditions are provided", async () => {
    const user = UserSeeder.create({
      id: "user-123",
      email: "user@example.com"
    });

    const { handler, userRepository, notificationService } = setup({
      findUserById: jest.fn().mockResolvedValue(user)
    });

    await handler.handle({
      template: "startTrial",
      userId: user.id
    });

    expect(userRepository.findById).toHaveBeenCalledWith(user.id);
    expect(notificationService.createNotification).toHaveBeenCalledWith(startTrialNotification(user));
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

    const { handler, userRepository, notificationService } = setup({
      findUserById: jest.fn().mockResolvedValue(user)
    });

    const trialEndsAt = "2023-10-15T12:00:00Z";
    await handler.handle({
      template: "beforeTrialEnds",
      userId: user.id,
      vars: { trialEndsAt },
      conditions: { trial: true }
    });

    expect(userRepository.findById).toHaveBeenCalledWith(user.id);
    expect(notificationService.createNotification).toHaveBeenCalledWith(beforeTrialEndsNotification(user, { trialEndsAt }));

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

    await handler.handle({
      template: "afterTrialEnds",
      userId: user.id,
      conditions: { trial: true }
    });

    expect(userRepository.findById).toHaveBeenCalledWith(user.id);
    expect(notificationService.createNotification).toHaveBeenCalledWith(afterTrialEndsNotification(user));
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

    await handler.handle({
      template: "trialEnded",
      userId: user.id,
      conditions: {
        trial: true,
        emailVerified: true
      }
    });

    expect(userRepository.findById).toHaveBeenCalledWith(user.id);
    expect(notificationService.createNotification).toHaveBeenCalledWith(trialEndedNotification(user));
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
      conditions: {
        trial: true,
        emailVerified: true
      }
    });

    expect(userRepository.findById).toHaveBeenCalledWith(user.id);
    expect(notificationService.createNotification).not.toHaveBeenCalled();
  });

  function setup(input?: { findUserById?: UserRepository["findById"]; createNotification?: NotificationService["createNotification"] }) {
    const mocks = {
      notificationService: mock<NotificationService>({
        createNotification: input?.createNotification ?? jest.fn().mockResolvedValue(undefined)
      }),
      userRepository: mock<UserRepository>({
        findById: input?.findUserById ?? jest.fn()
      }),
      logger: mock<LoggerService>()
    };

    const handler = new NotificationHandler(mocks.notificationService, mocks.logger, mocks.userRepository);

    return { handler, ...mocks };
  }
});
