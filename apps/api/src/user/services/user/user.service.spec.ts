import { faker } from "@faker-js/faker";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { Auth0Service } from "@src/auth/services/auth0/auth0.service";
import type { EmailVerificationCodeService } from "@src/auth/services/email-verification-code/email-verification-code.service";
import type { TrialActivationJobService } from "@src/billing/services/trial-activation-job/trial-activation-job.service";
import type { WalletInitializerService } from "@src/billing/services/wallet-initializer/wallet-initializer.service";
import type { CreateLogger } from "@src/core/providers/logging.provider";
import type { AnalyticsService } from "@src/core/services/analytics/analytics.service";
import type { NotificationService } from "@src/notifications/services/notification/notification.service";
import type { DataKeyService } from "@src/secret/services/data-key/data-key.service";
import type { UserRepository } from "@src/user/repositories/user/user.repository";
import type { RegisterUserInput } from "./user.service";
import { UserService } from "./user.service";

import { createDataKey } from "@test/seeders/data-key.seeder";
import { createUser } from "@test/seeders/user.seeder";
import { createUserWallet } from "@test/seeders/user-wallet.seeder";

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

    it("returns isNewUser true when the user was newly created", async () => {
      const user = createUser({ emailVerified: true, email: "test@example.com" });
      const { service, userRepository, notificationService } = setup();

      userRepository.upsertOnExternalIdConflict.mockResolvedValue({ user, wasInserted: true });
      notificationService.createDefaultChannel.mockResolvedValue(undefined);

      const result = await service.registerUser(createRegisterInput({ emailVerified: true }));

      expect(result.isNewUser).toBe(true);
    });

    it("returns isNewUser false when the user already existed", async () => {
      const user = createUser({ emailVerified: true, email: "test@example.com" });
      const { service, userRepository, notificationService } = setup();

      userRepository.upsertOnExternalIdConflict.mockResolvedValue({ user, wasInserted: false });
      notificationService.createDefaultChannel.mockResolvedValue(undefined);

      const result = await service.registerUser(createRegisterInput({ emailVerified: true }));

      expect(result.isNewUser).toBe(false);
    });

    it("ensures the user has a wallet even when the user already existed", async () => {
      const user = createUser({ emailVerified: true, email: "test@example.com" });
      const { service, userRepository, notificationService, walletInitializerService } = setup();

      userRepository.upsertOnExternalIdConflict.mockResolvedValue({ user, wasInserted: false });
      notificationService.createDefaultChannel.mockResolvedValue(undefined);

      await service.registerUser(createRegisterInput({ emailVerified: true }));

      expect(walletInitializerService.ensureWallet).toHaveBeenCalledWith(user.id);
    });

    it("ensures the user has a data key even when the user already existed", async () => {
      const user = createUser({ emailVerified: true, email: "test@example.com" });
      const { service, userRepository, notificationService, dataKeyService } = setup();

      userRepository.upsertOnExternalIdConflict.mockResolvedValue({ user, wasInserted: false });
      notificationService.createDefaultChannel.mockResolvedValue(undefined);

      await service.registerUser(createRegisterInput({ emailVerified: true }));

      expect(dataKeyService.ensureDataKey).toHaveBeenCalledWith(user.id);
    });

    it("logs error but does not throw when data key creation fails", async () => {
      const user = createUser({ emailVerified: true, email: "test@example.com" });
      const { service, userRepository, notificationService, dataKeyService, logger } = setup();
      const dataKeyError = new Error("wrapping failed");

      userRepository.upsertOnExternalIdConflict.mockResolvedValue({ user, wasInserted: true });
      notificationService.createDefaultChannel.mockResolvedValue(undefined);
      dataKeyService.ensureDataKey.mockRejectedValue(dataKeyError);

      const result = await service.registerUser(createRegisterInput({ emailVerified: true }));

      expect(result.id).toBe(user.id);
      expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ event: "FAILED_TO_ENSURE_USER_DATA_KEY", id: user.id, error: dataKeyError }));
    });

    it("logs error but does not throw when wallet creation fails", async () => {
      const user = createUser({ emailVerified: true, email: "test@example.com" });
      const { service, userRepository, notificationService, walletInitializerService, logger } = setup();
      const walletError = new Error("derivation failed");

      userRepository.upsertOnExternalIdConflict.mockResolvedValue({ user, wasInserted: true });
      notificationService.createDefaultChannel.mockResolvedValue(undefined);
      walletInitializerService.ensureWallet.mockRejectedValue(walletError);

      const result = await service.registerUser(createRegisterInput({ emailVerified: true }));

      expect(result.id).toBe(user.id);
      expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ event: "FAILED_TO_ENSURE_USER_WALLET", id: user.id, error: walletError }));
    });
  });

  describe("skipOnboarding", () => {
    it("persists the skip time with a set-if-null guard so it is written once and never overwritten", async () => {
      const userId = faker.string.uuid();
      const { service, userRepository } = setup();

      await service.skipOnboarding(userId);

      expect(userRepository.updateBy).toHaveBeenCalledWith({ id: userId, onboardingSkippedAt: null }, { onboardingSkippedAt: expect.any(Date) });
    });
  });

  it("creates the logger with the service context", () => {
    const { createLogger } = setup();

    expect(createLogger).toHaveBeenCalledWith({ context: UserService.name });
  });

  function setup() {
    const userRepository = mock<UserRepository>();
    const analyticsService = mock<AnalyticsService>();
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);
    const notificationService = mock<NotificationService>();
    const auth0Service = mock<Auth0Service>();
    const emailVerificationCodeService = mock<EmailVerificationCodeService>();
    const walletInitializerService = mock<WalletInitializerService>({
      ensureWallet: vi.fn().mockResolvedValue(createUserWallet())
    });
    const trialActivationJobService = mock<TrialActivationJobService>({ schedule: vi.fn().mockResolvedValue(undefined) });
    const dataKeyService = mock<DataKeyService>({ ensureDataKey: vi.fn().mockResolvedValue(createDataKey()) });

    const service = new UserService(
      userRepository,
      analyticsService,
      createLogger,
      notificationService,
      auth0Service,
      emailVerificationCodeService,
      walletInitializerService,
      trialActivationJobService,
      dataKeyService
    );

    return {
      service,
      userRepository,
      analyticsService,
      logger,
      createLogger,
      notificationService,
      auth0Service,
      emailVerificationCodeService,
      walletInitializerService,
      dataKeyService
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
