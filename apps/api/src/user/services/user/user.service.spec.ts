import { faker } from "@faker-js/faker";
import { PostgresError } from "postgres";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { ACCOUNT_UNAVAILABLE_ERROR_CODE, ACCOUNT_UNAVAILABLE_MESSAGE } from "@src/auth/lib/account-unavailable/account-unavailable";
import type { Auth0Service } from "@src/auth/services/auth0/auth0.service";
import type { EmailVerificationCodeService } from "@src/auth/services/email-verification-code/email-verification-code.service";
import type { VerifiedEmailService } from "@src/auth/services/verified-email/verified-email.service";
import type { TrialActivationJobService } from "@src/billing/services/trial-activation-job/trial-activation-job.service";
import type { WalletInitializerService } from "@src/billing/services/wallet-initializer/wallet-initializer.service";
import type { CreateLogger } from "@src/core/providers/logging.provider";
import type { AnalyticsService } from "@src/core/services/analytics/analytics.service";
import type { TxService } from "@src/core/services/tx/tx.service";
import type { NotificationService } from "@src/notifications/services/notification/notification.service";
import type { PersonalOrganizationService } from "@src/organization/services/personal-organization/personal-organization.service";
import type { DataKeyService } from "@src/secret/services/data-key/data-key.service";
import type { UserRepository } from "@src/user/repositories/user/user.repository";
import type { BlockedEmailDomainService } from "@src/workload-abuse/services/blocked-email-domain/blocked-email-domain.service";
import type { RegisterUserInput } from "./user.service";
import { UserService } from "./user.service";

import { createDataKey } from "@test/seeders/data-key.seeder";
import { createAdoptedRowCounts, createOrganization } from "@test/seeders/organization.seeder";
import { createUser } from "@test/seeders/user.seeder";
import { createUserWallet } from "@test/seeders/user-wallet.seeder";

describe(UserService.name, () => {
  describe("registerUser", () => {
    it.each([true, false])("stores the address Auth0 holds for the user and whether Auth0 verified it (%s)", async emailVerified => {
      const signInEmail = { email: faker.internet.email(), emailVerified };
      const user = createUser(signInEmail);
      const input = createRegisterInput();
      const { service, userRepository, verifiedEmailService } = setup({ signInEmail });
      userRepository.upsertOnExternalIdConflict.mockResolvedValue({ user, wasInserted: true });

      await service.registerUser(input);

      expect(verifiedEmailService.getEmail).toHaveBeenCalledWith(input.userId);
      expect(userRepository.upsertOnExternalIdConflict).toHaveBeenCalledWith(expect.objectContaining({ userId: input.userId, ...signInEmail }));
    });

    it("refuses a user Auth0 holds no address for, without storing anything", async () => {
      const { service, userRepository } = setup({ signInEmail: null });

      await expect(service.registerUser(createRegisterInput())).rejects.toMatchObject({ status: 400, message: "The account has no email address" });
      expect(userRepository.upsertOnExternalIdConflict).not.toHaveBeenCalled();
    });

    describe("when the email domain is blocked", () => {
      it("checks the domain of the address Auth0 holds for the user", async () => {
        const signInEmail = { email: faker.internet.email(), emailVerified: true };
        const { service, userRepository, blockedEmailDomainService } = setup({ signInEmail });
        blockedEmailDomainService.isBlockedEmail.mockImplementation(async email => email === signInEmail.email);
        userRepository.findByUserId.mockResolvedValue(undefined);

        await expect(service.registerUser(createRegisterInput())).rejects.toMatchObject({ status: 403 });
      });

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

        const result = await service.registerUser(createRegisterInput());

        expect(result.id).toBe(user.id);
      });
    });

    it("registers without looking the user up when the email domain is not blocked", async () => {
      const user = createUser({ emailVerified: true });
      const { service, userRepository, notificationService } = setup();
      userRepository.upsertOnExternalIdConflict.mockResolvedValue({ user, wasInserted: true });
      notificationService.createDefaultChannel.mockResolvedValue(undefined);

      await service.registerUser(createRegisterInput());

      expect(userRepository.findByUserId).not.toHaveBeenCalled();
    });

    it("sends verification code when Auth0 has not verified the address", async () => {
      const user = createUser({ emailVerified: false, email: "test@example.com" });
      const { service, emailVerificationCodeService, userRepository, notificationService } = setup({
        signInEmail: { email: user.email!, emailVerified: false }
      });

      userRepository.upsertOnExternalIdConflict.mockResolvedValue({ user, wasInserted: true });
      notificationService.createDefaultChannel.mockResolvedValue(undefined);
      emailVerificationCodeService.sendCode.mockResolvedValue({ codeSentAt: new Date().toISOString() });

      await service.registerUser(createRegisterInput());

      expect(emailVerificationCodeService.sendCode).toHaveBeenCalledWith(user.id);
    });

    it("does not send verification code when Auth0 has verified the address", async () => {
      const user = createUser({ emailVerified: true, email: "test@example.com" });
      const { service, emailVerificationCodeService, userRepository, notificationService } = setup({
        signInEmail: { email: user.email!, emailVerified: true }
      });

      userRepository.upsertOnExternalIdConflict.mockResolvedValue({ user, wasInserted: true });
      notificationService.createDefaultChannel.mockResolvedValue(undefined);

      await service.registerUser(createRegisterInput());

      expect(emailVerificationCodeService.sendCode).not.toHaveBeenCalled();
    });

    it("logs error but does not throw when verification code send fails", async () => {
      const user = createUser({ emailVerified: false, email: "test@example.com" });
      const { service, emailVerificationCodeService, userRepository, notificationService, logger } = setup({
        signInEmail: { email: user.email!, emailVerified: false }
      });
      const sendError = new Error("Send failed");

      userRepository.upsertOnExternalIdConflict.mockResolvedValue({ user, wasInserted: true });
      notificationService.createDefaultChannel.mockResolvedValue(undefined);
      emailVerificationCodeService.sendCode.mockRejectedValue(sendError);

      const result = await service.registerUser(createRegisterInput());

      expect(result.id).toBe(user.id);
      expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ event: "FAILED_TO_SEND_INITIAL_VERIFICATION_CODE", id: user.id, error: sendError }));
    });

    it("returns isNewUser true when the user was newly created", async () => {
      const user = createUser({ emailVerified: true, email: "test@example.com" });
      const { service, userRepository, notificationService } = setup();

      userRepository.upsertOnExternalIdConflict.mockResolvedValue({ user, wasInserted: true });
      notificationService.createDefaultChannel.mockResolvedValue(undefined);

      const result = await service.registerUser(createRegisterInput());

      expect(result.isNewUser).toBe(true);
    });

    it("returns isNewUser false when the user already existed", async () => {
      const user = createUser({ emailVerified: true, email: "test@example.com" });
      const { service, userRepository, notificationService } = setup();

      userRepository.upsertOnExternalIdConflict.mockResolvedValue({ user, wasInserted: false });
      notificationService.createDefaultChannel.mockResolvedValue(undefined);

      const result = await service.registerUser(createRegisterInput());

      expect(result.isNewUser).toBe(false);
    });

    it("ensures the user has a wallet even when the user already existed", async () => {
      const user = createUser({ emailVerified: true, email: "test@example.com" });
      const { service, userRepository, notificationService, walletInitializerService } = setup();

      userRepository.upsertOnExternalIdConflict.mockResolvedValue({ user, wasInserted: false });
      notificationService.createDefaultChannel.mockResolvedValue(undefined);

      await service.registerUser(createRegisterInput());

      expect(walletInitializerService.ensureWallet).toHaveBeenCalledWith(user.id);
    });

    it("ensures the user has a data key even when the user already existed", async () => {
      const user = createUser({ emailVerified: true, email: "test@example.com" });
      const { service, userRepository, notificationService, dataKeyService } = setup();

      userRepository.upsertOnExternalIdConflict.mockResolvedValue({ user, wasInserted: false });
      notificationService.createDefaultChannel.mockResolvedValue(undefined);

      await service.registerUser(createRegisterInput());

      expect(dataKeyService.ensureDataKey).toHaveBeenCalledWith({ userId: user.id });
    });

    it("logs error but does not throw when data key creation fails", async () => {
      const user = createUser({ emailVerified: true, email: "test@example.com" });
      const { service, userRepository, notificationService, dataKeyService, logger } = setup();
      const dataKeyError = new Error("wrapping failed");

      userRepository.upsertOnExternalIdConflict.mockResolvedValue({ user, wasInserted: true });
      notificationService.createDefaultChannel.mockResolvedValue(undefined);
      dataKeyService.ensureDataKey.mockRejectedValue(dataKeyError);

      const result = await service.registerUser(createRegisterInput());

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

      const result = await service.registerUser(createRegisterInput());

      expect(result.id).toBe(user.id);
      expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ event: "FAILED_TO_ENSURE_USER_WALLET", id: user.id, error: walletError }));
    });

    it("creates the user's personal organization inside the transaction that upserts the user", async () => {
      const user = createUser({ emailVerified: true });
      const { service, userRepository, notificationService, personalOrganizationService, txService } = setup();
      const order: string[] = [];
      txService.transaction.mockImplementation(async cb => {
        order.push("begin");
        const result = await cb();
        order.push("commit");
        return result;
      });
      userRepository.upsertOnExternalIdConflict.mockImplementation(async () => {
        order.push("upsert");
        return { user, wasInserted: true };
      });
      personalOrganizationService.ensureForUser.mockImplementation(async () => {
        order.push("organization");
        return createOrganization();
      });
      notificationService.createDefaultChannel.mockResolvedValue(undefined);

      await service.registerUser(createRegisterInput());

      expect(order).toEqual(["begin", "upsert", "organization", "commit"]);
      expect(personalOrganizationService.ensureForUser).toHaveBeenCalledWith(user);
    });

    it("fails the registration when the personal organization cannot be created", async () => {
      const user = createUser();
      const { service, userRepository, personalOrganizationService, walletInitializerService } = setup();
      userRepository.upsertOnExternalIdConflict.mockResolvedValue({ user, wasInserted: true });
      personalOrganizationService.ensureForUser.mockRejectedValue(new Error("organizations are down"));

      await expect(service.registerUser(createRegisterInput())).rejects.toThrow("organizations are down");

      expect(walletInitializerService.ensureWallet).not.toHaveBeenCalled();
      expect(personalOrganizationService.adoptUserRows).not.toHaveBeenCalled();
    });

    it("retries the whole registration with an adjusted username when the wanted one is taken", async () => {
      const user = createUser({ emailVerified: true });
      const { service, userRepository, notificationService, personalOrganizationService, txService } = setup();
      userRepository.upsertOnExternalIdConflict.mockRejectedValueOnce(createUsernameTakenError()).mockResolvedValueOnce({ user, wasInserted: true });
      notificationService.createDefaultChannel.mockResolvedValue(undefined);

      await service.registerUser(createRegisterInput({ wantedUsername: "taken" }));

      expect(txService.transaction).toHaveBeenCalledTimes(2);
      expect(userRepository.upsertOnExternalIdConflict.mock.calls.map(([input]) => input.username)).toEqual(["taken", expect.stringMatching(/^taken\d{4}$/)]);
      expect(personalOrganizationService.ensureForUser).toHaveBeenCalledOnce();
    });

    it("files the user's existing rows into the personal organization once the wallet exists", async () => {
      const user = createUser({ emailVerified: true });
      const { service, userRepository, notificationService, personalOrganizationService, walletInitializerService, organization } = setup();
      userRepository.upsertOnExternalIdConflict.mockResolvedValue({ user, wasInserted: false });
      notificationService.createDefaultChannel.mockResolvedValue(undefined);

      await service.registerUser(createRegisterInput());

      expect(personalOrganizationService.adoptUserRows).toHaveBeenCalledWith(user, organization);
      expect(walletInitializerService.ensureWallet.mock.invocationCallOrder[0]).toBeLessThan(
        personalOrganizationService.adoptUserRows.mock.invocationCallOrder[0]
      );
    });

    it("logs error but does not throw when filing the user's rows fails", async () => {
      const user = createUser({ emailVerified: true });
      const { service, userRepository, notificationService, personalOrganizationService, organization, logger } = setup();
      const adoptionError = new Error("stamping failed");
      userRepository.upsertOnExternalIdConflict.mockResolvedValue({ user, wasInserted: false });
      notificationService.createDefaultChannel.mockResolvedValue(undefined);
      personalOrganizationService.adoptUserRows.mockRejectedValue(adoptionError);

      const result = await service.registerUser(createRegisterInput());

      expect(result.id).toBe(user.id);
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ event: "FAILED_TO_ADOPT_USER_ROWS", id: user.id, organizationId: organization.id, error: adoptionError })
      );
    });
    describe("when the browser reports a timezone", () => {
      it("remembers it on an account that has none yet", async () => {
        const user = createUser({ timezone: null, timezonePickedAt: null });
        const { service, userRepository } = setup();
        userRepository.upsertOnExternalIdConflict.mockResolvedValue({ user, wasInserted: true });
        userRepository.updateBy.mockImplementation(vi.fn().mockResolvedValue({ ...user, timezone: "Europe/Paris" }));

        const result = await service.registerUser(createRegisterInput({ timezone: "Europe/Paris" }));

        expect(userRepository.updateBy).toHaveBeenCalledWith({ id: user.id, timezonePickedAt: null }, { timezone: "Europe/Paris" }, { returning: true });
        expect(result.timezone).toBe("Europe/Paris");
      });

      it("dates the alert emails of the default notification channel in the detected timezone", async () => {
        const user = createUser({ timezone: null, timezonePickedAt: null });
        const { service, userRepository, notificationService } = setup();
        userRepository.upsertOnExternalIdConflict.mockResolvedValue({ user, wasInserted: true });
        userRepository.updateBy.mockImplementation(vi.fn().mockResolvedValue({ ...user, timezone: "Europe/Paris" }));

        await service.registerUser(createRegisterInput({ timezone: "Europe/Paris" }));

        expect(notificationService.createDefaultChannel).toHaveBeenCalledWith(expect.objectContaining({ id: user.id, timezone: "Europe/Paris" }));
      });

      it("keeps the alert emails of the default notification channel in the picked timezone when another one is detected", async () => {
        const user = createUser({ timezone: "Europe/Paris", timezonePickedAt: faker.date.past() });
        const { service, userRepository, notificationService } = setup();
        userRepository.upsertOnExternalIdConflict.mockResolvedValue({ user, wasInserted: false });

        await service.registerUser(createRegisterInput({ timezone: "Asia/Tokyo" }));

        expect(notificationService.createDefaultChannel).toHaveBeenCalledWith(expect.objectContaining({ id: user.id, timezone: "Europe/Paris" }));
      });

      it("stores the canonical name of a timezone alias", async () => {
        const user = createUser({ timezone: null, timezonePickedAt: null });
        const { service, userRepository } = setup();
        userRepository.upsertOnExternalIdConflict.mockResolvedValue({ user, wasInserted: true });

        await service.registerUser(createRegisterInput({ timezone: "Etc/UTC" }));

        expect(userRepository.updateBy).toHaveBeenCalledWith({ id: user.id, timezonePickedAt: null }, { timezone: "UTC" }, { returning: true });
      });

      it("refreshes a detected timezone when the user signs in from another zone", async () => {
        const user = createUser({ timezone: "America/New_York", timezonePickedAt: null });
        const { service, userRepository } = setup();
        userRepository.upsertOnExternalIdConflict.mockResolvedValue({ user, wasInserted: false });
        userRepository.updateBy.mockImplementation(vi.fn().mockResolvedValue({ ...user, timezone: "Asia/Tokyo" }));

        const result = await service.registerUser(createRegisterInput({ timezone: "Asia/Tokyo" }));

        expect(userRepository.updateBy).toHaveBeenCalledWith({ id: user.id, timezonePickedAt: null }, { timezone: "Asia/Tokyo" }, { returning: true });
        expect(result.timezone).toBe("Asia/Tokyo");
      });

      it("never overwrites a timezone the user picked in their profile", async () => {
        const user = createUser({ timezone: "Europe/Paris", timezonePickedAt: faker.date.past() });
        const { service, userRepository } = setup();
        userRepository.upsertOnExternalIdConflict.mockResolvedValue({ user, wasInserted: false });

        const result = await service.registerUser(createRegisterInput({ timezone: "Asia/Tokyo" }));

        expect(userRepository.updateBy).not.toHaveBeenCalled();
        expect(result.timezone).toBe("Europe/Paris");
      });

      it("writes nothing when the timezone has not changed", async () => {
        const user = createUser({ timezone: "Europe/Paris", timezonePickedAt: null });
        const { service, userRepository } = setup();
        userRepository.upsertOnExternalIdConflict.mockResolvedValue({ user, wasInserted: false });

        await service.registerUser(createRegisterInput({ timezone: "Europe/Paris" }));

        expect(userRepository.updateBy).not.toHaveBeenCalled();
      });

      it.each(["Mars/Olympus", "+05:00"])("ignores %s, which names no timezone", async timezone => {
        const user = createUser({ timezone: "Europe/Paris", timezonePickedAt: null });
        const { service, userRepository } = setup();
        userRepository.upsertOnExternalIdConflict.mockResolvedValue({ user, wasInserted: false });

        const result = await service.registerUser(createRegisterInput({ timezone }));

        expect(userRepository.updateBy).not.toHaveBeenCalled();
        expect(result.timezone).toBe("Europe/Paris");
      });

      it("keeps the stored timezone when the user picks one while the sign-in is under way", async () => {
        const user = createUser({ timezone: null, timezonePickedAt: null });
        const { service, userRepository } = setup();
        userRepository.upsertOnExternalIdConflict.mockResolvedValue({ user, wasInserted: false });
        userRepository.updateBy.mockImplementation(vi.fn().mockResolvedValue(undefined));

        const result = await service.registerUser(createRegisterInput({ timezone: "Europe/Paris" }));

        expect(result.timezone).toBeNull();
      });
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

    it("records a picked timezone along with when it was picked", async () => {
      const user = createUser({ timezone: "America/New_York", timezonePickedAt: null });
      const { service, userRepository } = setup();
      userRepository.findById.mockResolvedValue(user);

      await service.updateUserDetails(user.id, { timezone: "Europe/Paris" });

      expect(userRepository.updateById).toHaveBeenCalledWith(user.id, { timezone: "Europe/Paris", timezonePickedAt: expect.any(Date) });
    });

    it("moves the user's alert emails to the timezone they picked", async () => {
      const user = createUser({ timezone: "America/New_York", timezonePickedAt: null });
      const { service, userRepository, notificationService } = setup();
      userRepository.findById.mockResolvedValue(user);

      await service.updateUserDetails(user.id, { timezone: "Europe/Paris" });

      expect(notificationService.createDefaultChannel).toHaveBeenCalledWith({ id: user.id, email: user.email, timezone: "Europe/Paris" });
    });

    it("keeps the picked timezone when the alert emails cannot be moved to it", async () => {
      const user = createUser({ timezone: null, timezonePickedAt: null });
      const error = new Error("notifications unavailable");
      const { service, userRepository, notificationService, logger } = setup();
      userRepository.findById.mockResolvedValue(user);
      notificationService.createDefaultChannel.mockRejectedValue(error);

      await service.updateUserDetails(user.id, { timezone: "Europe/Paris" });

      expect(userRepository.updateById).toHaveBeenCalledWith(user.id, { timezone: "Europe/Paris", timezonePickedAt: expect.any(Date) });
      expect(logger.error).toHaveBeenCalledWith({ event: "FAILED_TO_SHARE_TIMEZONE_WITH_ALERT_EMAILS", id: user.id, error });
    });

    it("leaves the alert emails alone when no timezone is picked", async () => {
      const user = createUser();
      const { service, userRepository, notificationService } = setup();
      userRepository.findById.mockResolvedValue(user);

      await service.updateUserDetails(user.id, { bio: "Builds on Akash" });

      expect(notificationService.createDefaultChannel).not.toHaveBeenCalled();
    });

    it("leaves the alert emails alone for a user without an email address", async () => {
      const user = createUser({ email: null });
      const { service, userRepository, notificationService } = setup();
      userRepository.findById.mockResolvedValue(user);

      await service.updateUserDetails(user.id, { timezone: "Europe/Paris" });

      expect(notificationService.createDefaultChannel).not.toHaveBeenCalled();
    });

    it("renames the personal organization to the new username", async () => {
      const user = createUser({ username: "alice" });
      const { service, userRepository, personalOrganizationService } = setup();
      userRepository.findById.mockResolvedValue(user);
      userRepository.findOneBy.mockResolvedValue(undefined);

      await service.updateUserDetails(user.id, { username: "alice-renamed" });

      expect(userRepository.updateById).toHaveBeenCalledWith(user.id, { username: "alice-renamed" });
      expect(personalOrganizationService.renameToUsername).toHaveBeenCalledWith({ id: user.id, username: "alice-renamed" });
    });

    it("refuses a username someone else holds without renaming anything", async () => {
      const user = createUser({ username: "alice" });
      const { service, userRepository, personalOrganizationService } = setup();
      userRepository.findById.mockResolvedValue(user);
      userRepository.findOneBy.mockResolvedValue(createUser({ username: "bob" }));

      await expect(service.updateUserDetails(user.id, { username: "bob" })).rejects.toMatchObject({
        status: 422,
        message: `Username not available: bob (${user.id})`
      });

      expect(userRepository.findOneBy).toHaveBeenCalledWith({ username: "bob" });
      expect(userRepository.updateById).not.toHaveBeenCalled();
      expect(personalOrganizationService.renameToUsername).not.toHaveBeenCalled();
    });

    it("leaves the personal organization alone when the username is unchanged", async () => {
      const user = createUser({ username: "alice" });
      const { service, userRepository, personalOrganizationService } = setup();
      userRepository.findById.mockResolvedValue(user);

      await service.updateUserDetails(user.id, { username: "alice", bio: "Builds on Akash" });

      expect(userRepository.findOneBy).not.toHaveBeenCalled();
      expect(personalOrganizationService.renameToUsername).not.toHaveBeenCalled();
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
    it("marks the user onboarded", async () => {
      const userId = faker.string.uuid();
      const { service, userRepository } = setup();

      await service.skipOnboarding(userId);

      expect(userRepository.markOnboarded).toHaveBeenCalledWith(userId);
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

  function setup(input: { signInEmail?: { email: string; emailVerified: boolean } | null } = {}) {
    const userRepository = mock<UserRepository>();
    const analyticsService = mock<AnalyticsService>();
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);
    const notificationService = mock<NotificationService>({ createDefaultChannel: vi.fn().mockResolvedValue(undefined) });
    const auth0Service = mock<Auth0Service>();
    const emailVerificationCodeService = mock<EmailVerificationCodeService>({
      sendCode: vi.fn().mockResolvedValue({ codeSentAt: new Date().toISOString() })
    });
    const walletInitializerService = mock<WalletInitializerService>({
      ensureWallet: vi.fn().mockResolvedValue(createUserWallet())
    });
    const trialActivationJobService = mock<TrialActivationJobService>({ schedule: vi.fn().mockResolvedValue(undefined) });
    const dataKeyService = mock<DataKeyService>({ ensureDataKey: vi.fn().mockResolvedValue(createDataKey()) });
    const blockedEmailDomainService = mock<BlockedEmailDomainService>({ isBlockedEmail: vi.fn().mockResolvedValue(false) });
    const organization = createOrganization({ type: "personal" });
    const personalOrganizationService = mock<PersonalOrganizationService>({
      ensureForUser: vi.fn().mockResolvedValue(organization),
      adoptUserRows: vi.fn().mockResolvedValue(createAdoptedRowCounts())
    });
    const txService = mock<TxService>({ transaction: vi.fn(cb => cb()) });
    const verifiedEmailService = mock<VerifiedEmailService>({
      getEmail: vi.fn().mockResolvedValue(input.signInEmail === undefined ? { email: faker.internet.email(), emailVerified: true } : input.signInEmail)
    });

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
      personalOrganizationService,
      txService,
      verifiedEmailService
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
      personalOrganizationService,
      txService,
      verifiedEmailService,
      organization
    };
  }

  function createUsernameTakenError() {
    const driverError = Object.assign(Object.create(PostgresError.prototype), {
      name: "PostgresError",
      code: "23505",
      constraint_name: "userSetting_username_unique",
      message: 'duplicate key value violates unique constraint "userSetting_username_unique"'
    });

    return new Error("Failed query: insert into userSetting", { cause: driverError });
  }

  function createRegisterInput(overrides: Partial<RegisterUserInput> = {}): RegisterUserInput {
    return {
      userId: faker.string.uuid(),
      wantedUsername: faker.internet.userName(),
      subscribedToNewsletter: false,
      ip: faker.internet.ip(),
      userAgent: faker.internet.userAgent(),
      fingerprint: faker.string.uuid(),
      ...overrides
    };
  }
});
