import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { UserWalletRepository, WalletSettingRepository } from "@src/billing/repositories";
import type { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import type { BillingContactsService } from "@src/billing/services/billing-contacts/billing-contacts.service";
import type { WalletReloadJobService } from "@src/billing/services/wallet-reload-job/wallet-reload-job.service";
import type { NotificationService } from "@src/notifications/services/notification/notification.service";
import type { UserOutput } from "@src/user/repositories";
import { AutoReloadPauseService } from "./auto-reload-pause.service";

import { mockConfigService } from "@test/mocks/config-service.mock";
import { createTeamPayer } from "@test/seeders/payer.seeder";
import { createUser } from "@test/seeders/user.seeder";
import { createUserWallet } from "@test/seeders/user-wallet.seeder";
import { generateWalletSetting } from "@test/seeders/wallet-setting.seeder";

describe(AutoReloadPauseService.name, () => {
  describe("calculateChargeCooldownMinutes", () => {
    it.each([
      [0, 60],
      [1, 60],
      [2, 120],
      [3, 240]
    ])("waits %i doublings of the base cooldown after %i declines", (failureCount, expected) => {
      const { service } = setup();

      expect(service.calculateChargeCooldownMinutes(failureCount)).toBe(expected);
    });

    it("stops growing at the configured ceiling", () => {
      const { service } = setup({ backoffMaxMinutes: 180 });

      expect(service.calculateChargeCooldownMinutes(8)).toBe(180);
    });

    it("keeps a zero cooldown disabled", () => {
      const { service } = setup({ cooldownMinutes: 0 });

      expect(service.calculateChargeCooldownMinutes(3)).toBe(0);
    });

    it("never lets a ceiling below the base cooldown shorten the gap", () => {
      const { service } = setup({ cooldownMinutes: 60, backoffMaxMinutes: 0 });

      expect(service.calculateChargeCooldownMinutes(3)).toBe(60);
    });
  });

  describe("recordDecline", () => {
    it("counts the decline against the configured limit", async () => {
      const { service, walletSettingRepository, claim, payer, target } = setup({ maxConsecutiveDeclines: 4 });
      walletSettingRepository.recordChargeDecline.mockResolvedValue({ failureCount: 1, pausedAt: null });

      await service.recordDecline({ claim, payer, target, decline: { declineCode: "generic_decline", isTerminal: false } });

      expect(walletSettingRepository.recordChargeDecline).toHaveBeenCalledWith(claim, { maxConsecutiveDeclines: 4, isTerminal: false });
    });

    it("emails the user on the first decline so a dead card is not discovered hours later", async () => {
      const { service, walletSettingRepository, notificationService, claim, user, payer, target } = setup();
      walletSettingRepository.recordChargeDecline.mockResolvedValue({ failureCount: 1, pausedAt: null });

      await service.recordDecline({ claim, payer, target, decline: { declineCode: "generic_decline", isTerminal: false } });

      expect(notificationService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          notificationId: `autoTopUpChargeFailed.${user.id}.${claim.claimedAt}`,
          user: { id: user.id, email: user.email }
        })
      );
    });

    it("does not email again on the declines that follow the first", async () => {
      const { service, walletSettingRepository, notificationService, claim, payer, target } = setup();
      walletSettingRepository.recordChargeDecline.mockResolvedValue({ failureCount: 3, pausedAt: null });

      await service.recordDecline({ claim, payer, target, decline: { isTerminal: false } });

      expect(notificationService.createNotification).not.toHaveBeenCalled();
    });

    it("stays quiet about a decline that landed after the user already replaced the card", async () => {
      const { service, walletSettingRepository, notificationService, claim, payer, target } = setup();
      walletSettingRepository.recordChargeDecline.mockResolvedValue({ failureCount: 0, pausedAt: null });

      await service.recordDecline({ claim, payer, target, decline: { isTerminal: false } });

      expect(notificationService.createNotification).not.toHaveBeenCalled();
    });

    it("sends only the pause email when the very first decline is terminal", async () => {
      const { service, walletSettingRepository, notificationService, claim, user, payer, target } = setup();
      const pausedAt = new Date("2026-09-01T12:00:00.000Z");
      walletSettingRepository.recordChargeDecline.mockResolvedValue({ failureCount: 1, pausedAt });

      await service.recordDecline({ claim, payer, target, decline: { declineCode: "stolen_card", isTerminal: true } });

      expect(notificationService.createNotification).toHaveBeenCalledTimes(1);
      expect(notificationService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({ notificationId: `autoTopUpPaused.${user.id}.${pausedAt.toISOString()}` })
      );
    });

    it("sends the add-funds email instead of the declined-card one when the bank demanded authentication", async () => {
      const { service, walletSettingRepository, notificationService, claim, user, payer, target } = setup();
      const pausedAt = new Date("2026-09-01T12:00:00.000Z");
      walletSettingRepository.recordChargeDecline.mockResolvedValue({ failureCount: 1, pausedAt });

      await service.recordDecline({ claim, payer, target, decline: { declineCode: "authentication_required", isTerminal: true } });

      expect(notificationService.createNotification).toHaveBeenCalledTimes(1);
      expect(notificationService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          notificationId: `autoTopUpAuthenticationRequired.${user.id}.${pausedAt.toISOString()}`,
          payload: expect.objectContaining({ actions: [{ label: "Add funds", url: "https://console.akash.network/billing?openPayment=true" }] })
        })
      );
    });

    it("leaves the wallet alone while the card still has chances left", async () => {
      const { service, walletSettingRepository, walletReloadJobService, notificationService, claim, payer, target } = setup();
      walletSettingRepository.recordChargeDecline.mockResolvedValue({ failureCount: 2, pausedAt: null });

      await service.recordDecline({ claim, payer, target, decline: { isTerminal: false } });

      expect(notificationService.createNotification).not.toHaveBeenCalled();
      expect(walletReloadJobService.cancelReloadCheck).not.toHaveBeenCalled();
    });

    it("emails the user and hands the wallet to the credits-low check once it pauses", async () => {
      const pausedAt = new Date("2026-09-01T12:00:00.000Z");
      const { service, walletSettingRepository, walletReloadJobService, notificationService, claim, user, payer, target } = setup();
      walletSettingRepository.recordChargeDecline.mockResolvedValue({ failureCount: 4, pausedAt });

      await service.recordDecline({ claim, payer, target, decline: { declineCode: "generic_decline", isTerminal: false } });

      expect(walletReloadJobService.cancelReloadCheck).toHaveBeenCalledWith(target);
      expect(walletReloadJobService.scheduleCreditsLowCheck).toHaveBeenCalledWith(target, { withCleanup: true });
      expect(notificationService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          notificationId: `autoTopUpPaused.${user.id}.${pausedAt.toISOString()}`,
          user: { id: user.id, email: user.email }
        })
      );
    });

    it("still emails the user when cancelling the queued reload check fails", async () => {
      const { service, walletSettingRepository, walletReloadJobService, notificationService, claim, payer, target } = setup();
      walletSettingRepository.recordChargeDecline.mockResolvedValue({ failureCount: 4, pausedAt: new Date() });
      walletReloadJobService.cancelReloadCheck.mockRejectedValue(new Error("queue unavailable"));

      await service.recordDecline({ claim, payer, target, decline: { isTerminal: false } });

      expect(walletReloadJobService.scheduleCreditsLowCheck).toHaveBeenCalledWith(target, { withCleanup: true });
      expect(notificationService.createNotification).toHaveBeenCalled();
    });

    it("emails the user before scheduling the credits-low check, since the pause never transitions twice", async () => {
      const { service, walletSettingRepository, walletReloadJobService, notificationService, claim, payer, target } = setup();
      walletSettingRepository.recordChargeDecline.mockResolvedValue({ failureCount: 4, pausedAt: new Date() });
      walletReloadJobService.scheduleCreditsLowCheck.mockRejectedValue(new Error("queue unavailable"));

      await expect(service.recordDecline({ claim, payer, target, decline: { isTerminal: false } })).rejects.toThrow("queue unavailable");

      expect(notificationService.createNotification).toHaveBeenCalled();
    });

    it("keeps a failed first-decline email from surfacing as a failure to record the decline", async () => {
      const { service, walletSettingRepository, notificationService, claim, payer, target } = setup();
      walletSettingRepository.recordChargeDecline.mockResolvedValue({ failureCount: 1, pausedAt: null });
      notificationService.createNotification.mockRejectedValue(new Error("notifications unavailable"));

      await expect(service.recordDecline({ claim, payer, target, decline: { isTerminal: false } })).resolves.toBeUndefined();
    });

    it("keeps a failed pause email from surfacing as a failure to record the decline", async () => {
      const { service, walletSettingRepository, walletReloadJobService, notificationService, claim, payer, target } = setup();
      walletSettingRepository.recordChargeDecline.mockResolvedValue({ failureCount: 4, pausedAt: new Date() });
      notificationService.createNotification.mockRejectedValue(new Error("notifications unavailable"));

      await expect(service.recordDecline({ claim, payer, target, decline: { isTerminal: false } })).resolves.toBeUndefined();

      expect(walletReloadJobService.scheduleCreditsLowCheck).toHaveBeenCalledWith(target, { withCleanup: true });
    });

    it("links the email at billing rather than the add funds modal", async () => {
      const { service, walletSettingRepository, notificationService, claim, payer, target } = setup();
      walletSettingRepository.recordChargeDecline.mockResolvedValue({ failureCount: 4, pausedAt: new Date() });

      await service.recordDecline({ claim, payer, target, decline: { isTerminal: false } });

      const notification = notificationService.createNotification.mock.calls[0][0];
      expect(notification.payload.actions).toEqual([{ label: "Update payment method", url: "https://console.akash.network/billing" }]);
    });
  });

  describe("resume", () => {
    it("clears the pause and lets the next check charge straight away", async () => {
      const setting = generateWalletSetting({ autoReloadEnabled: true, autoReloadPausedAt: new Date(), autoReloadFailureCount: 4 });
      const { service, walletSettingRepository, walletReloadJobService } = setup({ setting });

      await service.resume({ userId: setting.userId });

      expect(walletSettingRepository.clearChargeState).toHaveBeenCalledWith(setting.id);
      expect(walletReloadJobService.scheduleForWalletSetting).toHaveBeenCalledWith(setting, { withCleanup: true });
    });

    it("clears the credits-low latch the pause left behind", async () => {
      const setting = generateWalletSetting({ autoReloadEnabled: true, autoReloadPausedAt: new Date() });
      const { service, walletReloadJobService, userWalletRepository } = setup({ setting });

      await service.resume({ userId: setting.userId });

      expect(walletReloadJobService.cancelCreditsLowCheck).toHaveBeenCalledWith({ userId: setting.userId });
      expect(userWalletRepository.updateById).toHaveBeenCalledWith(setting.walletId, {
        creditsLowNotifiedAt: null,
        creditsSufficientSince: null,
        creditsLowSince: null
      });
    });

    it("does nothing for a wallet that was never paused", async () => {
      const setting = generateWalletSetting({ autoReloadEnabled: true, autoReloadPausedAt: null });
      const { service, walletSettingRepository, walletReloadJobService } = setup({ setting });

      await service.resume({ userId: setting.userId });

      expect(walletSettingRepository.clearChargeState).not.toHaveBeenCalled();
      expect(walletReloadJobService.scheduleForWalletSetting).not.toHaveBeenCalled();
    });

    it("clears the pause without scheduling a check when the user turned auto top-up off", async () => {
      const setting = generateWalletSetting({ autoReloadEnabled: false, autoReloadPausedAt: new Date() });
      const { service, walletSettingRepository, walletReloadJobService } = setup({ setting });

      await service.resume({ userId: setting.userId });

      expect(walletSettingRepository.clearChargeState).toHaveBeenCalledWith(setting.id);
      expect(walletReloadJobService.scheduleForWalletSetting).not.toHaveBeenCalled();
    });

    it("leaves the credits-low latch to the check itself when the user turned auto top-up off", async () => {
      const setting = generateWalletSetting({ autoReloadEnabled: false, autoReloadPausedAt: new Date() });
      const { service, userWalletRepository } = setup({ setting });

      await service.resume({ userId: setting.userId });

      expect(userWalletRepository.updateById).not.toHaveBeenCalled();
    });
  });

  describe("when a team organization pays", () => {
    it("emails every owner and billing member of the team, and keys the follow-up check by the team's wallet", async () => {
      const contacts = [createUser(), createUser()];
      const { service, walletSettingRepository, walletReloadJobService, notificationService, claim } = setup({ teamContacts: contacts });
      const payer = createTeamPayer();
      const target = { walletId: 42 };
      walletSettingRepository.recordChargeDecline.mockResolvedValue({ failureCount: 4, pausedAt: new Date("2026-09-01T12:00:00Z") });

      await service.recordDecline({ claim, payer, target, decline: { isTerminal: false } });

      expect(notificationService.createNotification).toHaveBeenCalledTimes(2);
      expect(notificationService.createNotification).toHaveBeenCalledWith(expect.objectContaining({ user: { id: contacts[0].id, email: contacts[0].email } }));
      expect(notificationService.createNotification).toHaveBeenCalledWith(expect.objectContaining({ user: { id: contacts[1].id, email: contacts[1].email } }));
      expect(walletReloadJobService.cancelReloadCheck).toHaveBeenCalledWith(target);
      expect(walletReloadJobService.scheduleCreditsLowCheck).toHaveBeenCalledWith(target, { withCleanup: true });
    });

    it("resumes the auto reload of the team's wallet", async () => {
      const setting = generateWalletSetting({ autoReloadEnabled: true, autoReloadPausedAt: new Date(), walletId: 42 });
      const { service, walletSettingRepository, userWalletRepository, walletReloadJobService } = setup();
      userWalletRepository.findOneByOrganizationId.mockResolvedValue(createUserWallet({ id: 42, organizationId: "org-1" }));
      walletSettingRepository.findOneBy.mockResolvedValue(setting);

      await service.resume({ organizationId: "org-1" });

      expect(userWalletRepository.findOneByOrganizationId).toHaveBeenCalledWith("org-1");
      expect(walletSettingRepository.findOneBy).toHaveBeenCalledWith({ walletId: 42 });
      expect(walletSettingRepository.findByUserId).not.toHaveBeenCalled();
      expect(walletSettingRepository.clearChargeState).toHaveBeenCalledWith(setting.id);
      expect(walletReloadJobService.scheduleForWalletSetting).toHaveBeenCalledWith(setting, { withCleanup: true });
    });

    it("does nothing for a team without a wallet", async () => {
      const { service, walletSettingRepository, userWalletRepository } = setup();
      userWalletRepository.findOneByOrganizationId.mockResolvedValue(undefined);

      await service.resume({ organizationId: "org-1" });

      expect(walletSettingRepository.findOneBy).not.toHaveBeenCalled();
      expect(walletSettingRepository.clearChargeState).not.toHaveBeenCalled();
    });
  });

  function setup(input?: {
    cooldownMinutes?: number;
    backoffMaxMinutes?: number;
    maxConsecutiveDeclines?: number;
    setting?: ReturnType<typeof generateWalletSetting>;
    teamContacts?: UserOutput[];
  }) {
    const user = createUser();
    const walletSettingRepository = mock<WalletSettingRepository>();
    walletSettingRepository.findByUserId.mockResolvedValue(input?.setting);
    const userWalletRepository = mock<UserWalletRepository>();
    const walletReloadJobService = mock<WalletReloadJobService>();
    walletReloadJobService.targetOf.mockImplementation(async setting => ({ userId: setting.userId }));
    const billingContactsService = mock<BillingContactsService>();
    billingContactsService.findForPayer.mockImplementation(async payer => (payer.team ? input?.teamContacts ?? [] : [payer.user]));
    const notificationService = mock<NotificationService>();
    const billingConfig = mockConfigService<BillingConfigService>({
      AUTO_RELOAD_CHARGE_COOLDOWN_IN_MIN: input?.cooldownMinutes ?? 60,
      AUTO_RELOAD_CHARGE_BACKOFF_MAX_IN_MIN: input?.backoffMaxMinutes ?? 1440,
      AUTO_RELOAD_MAX_CONSECUTIVE_DECLINES: input?.maxConsecutiveDeclines ?? 4,
      CONSOLE_WEB_PAYMENT_LINK: "https://console.akash.network/billing?openPayment=true"
    });
    const service = new AutoReloadPauseService(
      walletSettingRepository,
      userWalletRepository,
      walletReloadJobService,
      notificationService,
      billingConfig,
      billingContactsService,
      () => mock()
    );

    return {
      service,
      walletSettingRepository,
      userWalletRepository,
      walletReloadJobService,
      notificationService,
      billingConfig,
      user,
      payer: { user, stripeCustomerId: user.stripeCustomerId },
      target: { userId: user.id },
      claim: { id: input?.setting?.id ?? "wallet-setting-1", claimedAt: "2026-09-01 12:00:00" }
    };
  }
});
