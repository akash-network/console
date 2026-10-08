import { faker } from "@faker-js/faker";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ReferralService } from "@src/affiliate/services/referral/referral.service";
import { ACCOUNT_UNAVAILABLE_ERROR_CODE, ACCOUNT_UNAVAILABLE_MESSAGE } from "@src/auth/lib/account-unavailable/account-unavailable";
import type { Auth0Service } from "@src/auth/services/auth0/auth0.service";
import type { EmailVerificationCodeService } from "@src/auth/services/email-verification-code/email-verification-code.service";
import type { TrialActivationJobService } from "@src/billing/services/trial-activation-job/trial-activation-job.service";
import type { WalletInitializerService } from "@src/billing/services/wallet-initializer/wallet-initializer.service";
import type { CreateLogger } from "@src/core/providers/logging.provider";
import type { AnalyticsService } from "@src/core/services/analytics/analytics.service";
import type { NotificationService } from "@src/notifications/services/notification/notification.service";
import type { DataKeyService } from "@src/secret/services/data-key/data-key.service";
import type { UserRepository } from "@src/user/repositories/user/user.repository";
import type { BlockedEmailDomainService } from "@src/workload-abuse/services/blocked-email-domain/blocked-email-domain.service";
import type { RegisterUserInput } from "./user.service";
import { UserService } from "./user.service";

import { createDataKey } from "@test/seeders/data-key.seeder";
import { createUser } from "@test/seeders/user.seeder";
import { createUserWallet } from "@test/seeders/user-wallet.seeder";

describe(UserService.name, () => {
  describe("registerUser", () => {
    describe("when the email domain is blocked", () => {
      it("refuses an account that does not exist yet", async () => {
        const { service, userRepository, blockedEmailDomainService } = setup();
        blockedEmailDomainService.isBlockedEmail.mockResolvedValue(true);
        userRepository.findByUserId.mockResolvedValue(undefined);

        await expect(service.registerUser(createRegisterInput())).rejects.toMatchObject({
          status: 403,
          message: ACCOUNT_UNAVAILABLE_MESSAGE,
          errorCode: ACCOUNT_UNAVAILABLE_ERROR_CODE
        });
        expect(userRepository.upsertOnExternalIdConflict).not.toHaveBeenCalled();
      });

      it("registers an account that already exists, so a later block never locks an established user out", async () => {
        const user = createUser({ emailVerified: true });
        const { service, userRepository, notificationService, blockedEmailDomainService } = setup();
        blockedEmailDomainService.isBlockedEmail.mockResolvedValue(true);
        userRepository.findByUserId.mockResolvedValue(user);
        userRepository.upsertOnExternalIdConflict.mockResolvedValue({ user, wasInserted: false });
        notificationService.createDefaultChannel.mockResolvedValue(undefined);

        const result = await service.registerUser(createRegisterInput({ emailVerified: true }));

        expect(result.id).toBe(user.id);
      });
    });

    it("registers without looking the user up when the email domain is not blocked", async () => {
      const user = createUser({ emailVerified: true });
      const { service, userRepository, notificationService } = setup();
      userRepository.upsertOnExternalIdConflict.mockResolvedValue({ user, wasInserted: true });
      notificationService.createDefaultChannel.mockResolvedValue(undefined);

      await service.registerUser(createRegisterInput({ emailVerified: true }));

      expect(userRepository.findByUserId).not.toHaveBeenCalled();
    });

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

    it("attributes the referral when a new user registers with a referral code", async () => {
      const user = createUser({ emailVerified: true });
      const { service, userRepository, notificationService, referralService } = setup();
      userRepository.upsertOnExternalIdConflict.mockResolvedValue({ user, wasInserted: true });
      notificationService.createDefaultChannel.mockResolvedValue(undefined);

      await service.registerUser(createRegisterInput({ emailVerified: true, referralCode: "friendcode" }));

      expect(referralService.attribute).toHaveBeenCalledWith({ referredUserId: user.id, code: "friendcode" });
    });

    it("does not attribute a referral when the user already existed", async () => {
      const user = createUser({ emailVerified: true });
      const { service, userRepository, notificationService, referralService } = setup();
      userRepository.upsertOnExternalIdConflict.mockResolvedValue({ user, wasInserted: false });
      notificationService.createDefaultChannel.mockResolvedValue(undefined);

      await service.registerUser(createRegisterInput({ emailVerified: true, referralCode: "friendcode" }));

      expect(referralService.attribute).not.toHaveBeenCalled();
    });

    it("does not attribute a referral when no referral code is given", async () => {
      const user = createUser({ emailVerified: true });
      const { service, userRepository, notificationService, referralService } = setup();
      userRepository.upsertOnExternalIdConflict.mockResolvedValue({ user, wasInserted: true });
      notificationService.createDefaultChannel.mockResolvedValue(undefined);

      await service.registerUser(createRegisterInput({ emailVerified: true, referralCode: undefined }));

      expect(referralService.attribute).not.toHaveBeenCalled();
    });

    it("logs error but does not throw when referral attribution fails", async () => {
      const user = createUser({ emailVerified: true });
      const { service, userRepository, notificationService, referralService, logger } = setup();
      const attributionError = new Error("insert failed");
      userRepository.upsertOnExternalIdConflict.mockResolvedValue({ user, wasInserted: true });
      notificationService.createDefaultChannel.mockResolvedValue(undefined);
      referralService.attribute.mockRejectedValue(attributionError);

      const result = await service.registerUser(createRegisterInput({ emailVerified: true, referralCode: "friendcode" }));

      expect(result.id).toBe(user.id);
      expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ event: "FAILED_TO_ATTRIBUTE_REFERRAL", id: user.id, error: attributionError }));
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

  describe("updateUserDetails", () => {
    it("records the opt-out time when product updates are switched off", async () => {
      const user = createUser({ productUpdatesUnsubscribedAt: null });
      const { service, userRepository } = setup();
      userRepository.findById.mockResolvedValue(user);

      await service.updateUserDetails(user.id, { subscribedToProductUpdates: false });

      expect(userRepository.updateById).toHaveBeenCalledWith(user.id, { productUpdatesUnsubscribedAt: expect.any(Date) });
    });

    it("keeps the original opt-out time when product updates stay switched off", async () => {
      const unsubscribedAt = faker.date.past();
      const user = createUser({ productUpdatesUnsubscribedAt: unsubscribedAt });
      const { service, userRepository } = setup();
      userRepository.findById.mockResolvedValue(user);

      await service.updateUserDetails(user.id, { subscribedToProductUpdates: false });

      expect(userRepository.updateById).toHaveBeenCalledWith(user.id, { productUpdatesUnsubscribedAt: unsubscribedAt });
    });

    it("clears the opt-out when product updates are switched back on", async () => {
      const user = createUser({ productUpdatesUnsubscribedAt: faker.date.past() });
      const { service, userRepository } = setup();
      userRepository.findById.mockResolvedValue(user);

      await service.updateUserDetails(user.id, { subscribedToProductUpdates: true });

      expect(userRepository.updateById).toHaveBeenCalledWith(user.id, { productUpdatesUnsubscribedAt: null });
    });

    it("leaves the opt-out untouched when the product updates preference is not sent", async () => {
      const user = createUser({ productUpdatesUnsubscribedAt: faker.date.past() });
      const { service, userRepository } = setup();
      userRepository.findById.mockResolvedValue(user);

      await service.updateUserDetails(user.id, { bio: "Builds on Akash" });

      expect(userRepository.updateById).toHaveBeenCalledWith(user.id, { bio: "Builds on Akash" });
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

  describe("acceptFairUsePolicy", () => {
    it("persists the acceptance time with a set-if-null guard so it is written once and never overwritten", async () => {
      const userId = faker.string.uuid();
      const { service, userRepository } = setup();

      await service.acceptFairUsePolicy(userId);

      expect(userRepository.updateBy).toHaveBeenCalledWith({ id: userId, fairUsePolicyAcceptedAt: null }, { fairUsePolicyAcceptedAt: expect.any(Date) });
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
    const blockedEmailDomainService = mock<BlockedEmailDomainService>({ isBlockedEmail: vi.fn().mockResolvedValue(false) });
    const referralService = mock<ReferralService>({ attribute: vi.fn().mockResolvedValue(undefined) });

    const service = new UserService(
      userRepository,
      analyticsService,
      createLogger,
      notificationService,
      auth0Service,
      emailVerificationCodeService,
      walletInitializerService,
      trialActivationJobService,
      dataKeyService,
      blockedEmailDomainService,
      referralService
    );

    return {
      blockedEmailDomainService,
      service,
      userRepository,
      analyticsService,
      logger,
      createLogger,
      notificationService,
      auth0Service,
      emailVerificationCodeService,
      walletInitializerService,
      dataKeyService,
      referralService
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
