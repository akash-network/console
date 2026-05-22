import "@test/mocks/logger-service.mock";

import { faker } from "@faker-js/faker";
import { mock } from "vitest-mock-extended";

import type { Auth0Service } from "@src/auth/services/auth0/auth0.service";
import type { EmailVerificationCodeService } from "@src/auth/services/email-verification-code/email-verification-code.service";
import type { LoggerService } from "@src/core/providers/logging.provider";
import type { AnalyticsService } from "@src/core/services/analytics/analytics.service";
import type { DomainEventsService } from "@src/core/services/domain-events/domain-events.service";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import type { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import type { NotificationService } from "@src/notifications/services/notification/notification.service";
import type { UserRepository } from "@src/user/repositories/user/user.repository";
import type { RegisterUserInput } from "./user.service";
import { UserService } from "./user.service";

import { createUser } from "@test/seeders/user.seeder";

describe(UserService.name, () => {
  describe("registerUser", () => {
    it("sends verification code when email is not verified", async () => {
      const user = createUser({ emailVerified: false, email: "test@example.com" });
      const { service, emailVerificationCodeService, userRepository, notificationService } = setup();

      userRepository.upsertOnExternalIdConflict.mockResolvedValue({ user, wasInserted: true });
      notificationService.createDefaultChannel.mockResolvedValue(undefined);
      emailVerificationCodeService.sendCode.mockResolvedValue({ codeSentAt: new Date().toISOString() });

      await service.registerUser(createRegisterInput({ emailVerified: false }));

      expect(emailVerificationCodeService.sendCode).toHaveBeenCalledWith(user.id);
    });

    it("does not send verification code when email is already verified", async () => {
      const user = createUser({ emailVerified: true, email: "test@example.com" });
      const { service, emailVerificationCodeService, userRepository, notificationService } = setup();

      userRepository.upsertOnExternalIdConflict.mockResolvedValue({ user, wasInserted: true });
      notificationService.createDefaultChannel.mockResolvedValue(undefined);

      await service.registerUser(createRegisterInput({ emailVerified: true }));

      expect(emailVerificationCodeService.sendCode).not.toHaveBeenCalled();
    });

    it("logs error but does not throw when verification code send fails", async () => {
      const user = createUser({ emailVerified: false, email: "test@example.com" });
      const { service, emailVerificationCodeService, userRepository, notificationService, logger } = setup();
      const sendError = new Error("Send failed");

      userRepository.upsertOnExternalIdConflict.mockResolvedValue({ user, wasInserted: true });
      notificationService.createDefaultChannel.mockResolvedValue(undefined);
      emailVerificationCodeService.sendCode.mockRejectedValue(sendError);

      const result = await service.registerUser(createRegisterInput({ emailVerified: false }));

      expect(result.id).toBe(user.id);
      expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ event: "FAILED_TO_SEND_INITIAL_VERIFICATION_CODE", id: user.id, error: sendError }));
    });
  });

  describe("registerUser - onboarding redesign FF", () => {
    it("publishes OnboardingStarted when FF is on and the user is newly created", async () => {
      const user = createUser({ id: "user-1", emailVerified: true });
      const { service, userRepository, notificationService, domainEvents, featureFlagsService } = setup();

      userRepository.upsertOnExternalIdConflict.mockResolvedValue({ user, wasInserted: true });
      notificationService.createDefaultChannel.mockResolvedValue(undefined);
      featureFlagsService.isEnabled.mockImplementation(flag => flag === FeatureFlags.CONSOLE_ONBOARDING_REDESIGN);

      await service.registerUser(createRegisterInput({ emailVerified: true }));

      expect(domainEvents.publish).toHaveBeenCalledWith(expect.objectContaining({ name: "OnboardingStarted", data: { userId: "user-1" } }));
    });

    it("does not publish OnboardingStarted when FF is off", async () => {
      const user = createUser({ id: "user-1", emailVerified: true });
      const { service, userRepository, notificationService, domainEvents, featureFlagsService } = setup();

      userRepository.upsertOnExternalIdConflict.mockResolvedValue({ user, wasInserted: true });
      notificationService.createDefaultChannel.mockResolvedValue(undefined);
      featureFlagsService.isEnabled.mockReturnValue(false);

      await service.registerUser(createRegisterInput({ emailVerified: true }));

      expect(domainEvents.publish).not.toHaveBeenCalled();
    });

    it("does not publish OnboardingStarted when FF is on but the user already existed", async () => {
      const user = createUser({ id: "user-1", emailVerified: true });
      const { service, userRepository, notificationService, domainEvents, featureFlagsService } = setup();

      userRepository.upsertOnExternalIdConflict.mockResolvedValue({ user, wasInserted: false });
      notificationService.createDefaultChannel.mockResolvedValue(undefined);
      featureFlagsService.isEnabled.mockReturnValue(true);

      await service.registerUser(createRegisterInput({ emailVerified: true }));

      expect(domainEvents.publish).not.toHaveBeenCalled();
    });
  });

  function setup() {
    const userRepository = mock<UserRepository>();
    const analyticsService = mock<AnalyticsService>();
    const logger = mock<LoggerService>();
    const notificationService = mock<NotificationService>();
    const auth0Service = mock<Auth0Service>();
    const emailVerificationCodeService = mock<EmailVerificationCodeService>();
    const domainEvents = mock<DomainEventsService>();
    const featureFlagsService = mock<FeatureFlagsService>();

    const service = new UserService(
      userRepository,
      analyticsService,
      logger,
      notificationService,
      auth0Service,
      emailVerificationCodeService,
      domainEvents,
      featureFlagsService
    );

    return {
      service,
      userRepository,
      analyticsService,
      logger,
      notificationService,
      auth0Service,
      emailVerificationCodeService,
      domainEvents,
      featureFlagsService
    };
  }

  function createRegisterInput(overrides: Partial<RegisterUserInput> = {}): RegisterUserInput {
    return {
      userId: faker.string.uuid(),
      wantedUsername: faker.internet.userName(),
      email: faker.internet.email(),
      emailVerified: false,
      subscribedToNewsletter: false,
      ip: faker.internet.ip(),
      userAgent: faker.internet.userAgent(),
      fingerprint: faker.string.uuid(),
      ...overrides
    };
  }
});
