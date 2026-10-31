import { faker } from "@faker-js/faker";
import type { ConfigService } from "@nestjs/config";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { LoggerService } from "@src/common/services/logger/logger.service";
import type { PendingAddressRepository } from "@src/modules/notifications/repositories/pending-address/pending-address.repository";
import type { EmailSenderService } from "../email-sender/email-sender.service";
import {
  AddressConfirmationService,
  MAX_CONFIRMATION_EMAILS_PER_ADDRESS_PER_DAY,
  MAX_CONFIRMATION_EMAILS_PER_USER_PER_DAY,
  splitAddresses
} from "./address-confirmation.service";

const WEB_URL = "https://console.example.com";

describe(AddressConfirmationService.name, () => {
  describe("splitAddresses", () => {
    it("keeps the channel's confirmed addresses as given and holds every other address, normalized and once, for confirmation", () => {
      const result = splitAddresses(["Ops@Example.com", " New@Example.com", "new@example.com"], { confirmed: ["ops@example.com"], accountEmail: null });

      expect(result).toEqual({ confirmed: ["Ops@Example.com"], pending: ["new@example.com"] });
    });

    it("confirms the requester's own email at once when it is verified", () => {
      const result = splitAddresses(["owner@example.com", "teammate@example.com"], {
        confirmed: [],
        accountEmail: { address: "Owner@Example.com", isVerified: true }
      });

      expect(result).toEqual({ confirmed: ["owner@example.com"], pending: ["teammate@example.com"] });
    });

    it("holds the requester's own email for confirmation while it is unverified", () => {
      const result = splitAddresses(["owner@example.com"], { confirmed: [], accountEmail: { address: "owner@example.com", isVerified: false } });

      expect(result).toEqual({ confirmed: [], pending: ["owner@example.com"] });
    });
  });

  describe("pendingAddressesOf", () => {
    it("groups the pending addresses by channel, with none for a channel that has none", async () => {
      const { service, pendingAddressRepository } = setup();
      pendingAddressRepository.findByChannelIds.mockResolvedValue([
        { notificationChannelId: "channel-1", address: "a@example.com" },
        { notificationChannelId: "channel-1", address: "b@example.com" }
      ]);

      const result = await service.pendingAddressesOf(["channel-1", "channel-2"]);

      expect(pendingAddressRepository.findByChannelIds).toHaveBeenCalledWith(["channel-1", "channel-2"]);
      expect(result).toEqual(
        new Map([
          ["channel-1", ["a@example.com", "b@example.com"]],
          ["channel-2", []]
        ])
      );
    });
  });

  describe("requestConfirmations", () => {
    it("holds each address under a token and emails each its confirmation link from the channel's owner", async () => {
      const { service, pendingAddressRepository, emailSenderService, loggerService, channel, requester } = setup();

      await service.requestConfirmations(channel, ["teammate@example.com"], requester);

      const [[pending]] = pendingAddressRepository.upsert.mock.calls;
      const [[email]] = emailSenderService.send.mock.calls;
      const token = new URL(email.actions![0].url).searchParams.get("token")!;
      expect(pending).toEqual([{ notificationChannelId: channel.id, address: "teammate@example.com", tokenHash: sha256(token) }]);
      expect(email).toEqual(
        expect.objectContaining({
          userId: channel.userId,
          addresses: ["teammate@example.com"],
          subject: "Confirm your email address for Akash Console alerts",
          actions: [{ label: "Confirm email address", url: `${WEB_URL}/alerts/confirm-address?token=${token}` }],
          receivingReason: "this address was added to a notification channel on Akash Console"
        })
      );
      expect(email.content).toContain("No alerts are sent to this address until it is confirmed.");
      expect(pendingAddressRepository.recordConfirmationEmail).toHaveBeenCalledWith(requester.userId, "teammate@example.com");
      expect(loggerService.info).toHaveBeenCalledWith(expect.objectContaining({ event: "ADDRESS_CONFIRMATION_EMAIL_SENT", notificationChannelId: channel.id }));
    });

    it("holds the requester's own unverified email without emailing it, since verifying the account confirms it", async () => {
      const { service, pendingAddressRepository, emailSenderService, channel, requester } = setup({
        accountEmail: { address: "Owner@Example.com", isVerified: false }
      });

      await service.requestConfirmations(channel, ["owner@example.com"], requester);

      expect(pendingAddressRepository.upsert).toHaveBeenCalledWith([expect.objectContaining({ address: "owner@example.com" })]);
      expect(emailSenderService.send).not.toHaveBeenCalled();
    });

    it("emails no address when there is none to confirm", async () => {
      const { service, emailSenderService, channel, requester } = setup();

      await service.requestConfirmations(channel, [], requester);

      expect(emailSenderService.send).not.toHaveBeenCalled();
    });

    it.each([
      { case: "the requester reached the daily limit", sentByUser: MAX_CONFIRMATION_EMAILS_PER_USER_PER_DAY, sentToAddress: 0 },
      { case: "the address reached the daily limit", sentByUser: 0, sentToAddress: MAX_CONFIRMATION_EMAILS_PER_ADDRESS_PER_DAY }
    ])("holds the address without emailing it once $case", async ({ sentByUser, sentToAddress }) => {
      const { service, pendingAddressRepository, emailSenderService, loggerService, channel, requester } = setup({ sentByUser, sentToAddress });

      await service.requestConfirmations(channel, ["teammate@example.com"], requester);

      expect(pendingAddressRepository.upsert).toHaveBeenCalled();
      expect(pendingAddressRepository.recordConfirmationEmail).not.toHaveBeenCalled();
      expect(emailSenderService.send).not.toHaveBeenCalled();
      expect(loggerService.warn).toHaveBeenCalledWith(expect.objectContaining({ event: "ADDRESS_CONFIRMATION_EMAIL_DEFERRED", userId: requester.userId }));
    });

    it("counts the emails of the last day by requester and by address", async () => {
      const { service, pendingAddressRepository, channel, requester } = setup();
      const before = Date.now();

      await service.requestConfirmations(channel, ["teammate@example.com"], requester);

      const [[byUser, userSince], [byAddress, addressSince]] = pendingAddressRepository.countConfirmationEmailsSince.mock.calls;
      expect([byUser, byAddress]).toEqual([{ userId: requester.userId }, { address: "teammate@example.com" }]);
      expect(userSince.getTime()).toBeGreaterThanOrEqual(before - 24 * 60 * 60 * 1000);
      expect(userSince.getTime()).toBeLessThanOrEqual(Date.now() - 24 * 60 * 60 * 1000);
      expect(addressSince).toEqual(userSince);
    });

    it("emails up to the last confirmation each limit allows", async () => {
      const { service, emailSenderService, channel, requester } = setup({
        sentByUser: MAX_CONFIRMATION_EMAILS_PER_USER_PER_DAY - 1,
        sentToAddress: MAX_CONFIRMATION_EMAILS_PER_ADDRESS_PER_DAY - 1
      });

      await service.requestConfirmations(channel, ["teammate@example.com"], requester);

      expect(emailSenderService.send).toHaveBeenCalled();
    });

    it("logs an email that fails and goes on with the next address", async () => {
      const { service, emailSenderService, loggerService, channel, requester } = setup();
      const error = new Error("Novu is unavailable");
      emailSenderService.send.mockRejectedValueOnce(error);

      await service.requestConfirmations(channel, ["first@example.com", "second@example.com"], requester);

      expect(emailSenderService.send).toHaveBeenCalledTimes(2);
      expect(loggerService.error).toHaveBeenCalledWith({
        event: "ADDRESS_CONFIRMATION_EMAIL_FAILED",
        notificationChannelId: channel.id,
        userId: requester.userId,
        error
      });
    });

    it("sends nothing and logs why when the Console web URL is not configured", async () => {
      const { service, emailSenderService, loggerService, channel, requester } = setup({ webUrl: undefined });

      await service.requestConfirmations(channel, ["teammate@example.com"], requester);

      expect(emailSenderService.send).not.toHaveBeenCalled();
      expect(loggerService.error).toHaveBeenCalledWith(
        expect.objectContaining({ error: new Error("CONSOLE_WEB_URL must be set to send address confirmation emails") })
      );
    });
  });

  describe("forget", () => {
    it("drops the pending addresses from the channel", async () => {
      const { service, pendingAddressRepository } = setup();

      await service.forget("channel-1", ["a@example.com"]);

      expect(pendingAddressRepository.deleteFromChannel).toHaveBeenCalledWith("channel-1", ["a@example.com"]);
    });
  });

  describe("resend", () => {
    it("emails a new link to a pending address, whose token replaces the previous one", async () => {
      const { service, pendingAddressRepository, emailSenderService, channel, requester } = setup();
      pendingAddressRepository.replaceToken.mockResolvedValue(true);

      const result = await service.resend(channel, "Teammate@Example.com", requester);

      const [[email]] = emailSenderService.send.mock.calls;
      const token = new URL(email.actions![0].url).searchParams.get("token")!;
      expect(result.ok).toBe(true);
      expect(pendingAddressRepository.replaceToken).toHaveBeenCalledWith({
        notificationChannelId: channel.id,
        address: "teammate@example.com",
        tokenHash: sha256(token)
      });
      expect(email.addresses).toEqual(["teammate@example.com"]);
    });

    it("refuses an address that doesn't wait for confirmation on the channel", async () => {
      const { service, pendingAddressRepository, emailSenderService, channel, requester } = setup();
      pendingAddressRepository.replaceToken.mockResolvedValue(false);

      const result = await service.resend(channel, "teammate@example.com", requester);

      expect(result.val).toBe("NOT_PENDING");
      expect(emailSenderService.send).not.toHaveBeenCalled();
    });

    it("refuses without replacing the link once a daily limit is reached", async () => {
      const { service, pendingAddressRepository, emailSenderService, channel, requester } = setup({
        sentToAddress: MAX_CONFIRMATION_EMAILS_PER_ADDRESS_PER_DAY
      });

      const result = await service.resend(channel, "teammate@example.com", requester);

      expect(result.val).toBe("RATE_LIMITED");
      expect(pendingAddressRepository.replaceToken).not.toHaveBeenCalled();
      expect(emailSenderService.send).not.toHaveBeenCalled();
    });
  });

  describe("confirm", () => {
    it.each([true, false])("confirms the address of the token's hash and answers %s as the repository does", async confirmed => {
      const { service, pendingAddressRepository } = setup();
      pendingAddressRepository.confirmByTokenHash.mockResolvedValue(confirmed);

      const result = await service.confirm("token-1");

      expect(pendingAddressRepository.confirmByTokenHash).toHaveBeenCalledWith(sha256("token-1"));
      expect(result).toBe(confirmed);
    });
  });

  describe("confirmVerifiedEmail", () => {
    it("confirms the verified email, normalized, on the user's channels", async () => {
      const { service, pendingAddressRepository } = setup();

      await service.confirmVerifiedEmail("user-1", { address: " Owner@Example.com", isVerified: true });

      expect(pendingAddressRepository.confirmOnChannelsOf).toHaveBeenCalledWith("user-1", "owner@example.com");
    });

    it.each([null, { address: "owner@example.com", isVerified: false }])("confirms nothing for %j", async accountEmail => {
      const { service, pendingAddressRepository } = setup();

      await service.confirmVerifiedEmail("user-1", accountEmail);

      expect(pendingAddressRepository.confirmOnChannelsOf).not.toHaveBeenCalled();
    });
  });

  function setup(
    input: { accountEmail?: { address: string; isVerified: boolean }; sentByUser?: number; sentToAddress?: number; webUrl?: string } = { webUrl: WEB_URL }
  ) {
    const pendingAddressRepository = mock<PendingAddressRepository>();
    const emailSenderService = mock<EmailSenderService>();
    const configService = mock<ConfigService>();
    const loggerService = mock<LoggerService>();
    const webUrl = "webUrl" in input ? input.webUrl : WEB_URL;
    configService.get.mockImplementation((key: string) => (key === "notifications.CONSOLE_WEB_URL" ? webUrl : undefined));
    pendingAddressRepository.countConfirmationEmailsSince.mockImplementation(async sentTo =>
      "userId" in sentTo ? input.sentByUser ?? 0 : input.sentToAddress ?? 0
    );
    const service = new AddressConfirmationService(pendingAddressRepository, emailSenderService, configService, loggerService);
    const channel = { id: faker.string.uuid(), userId: faker.string.uuid() };
    const requester = { userId: faker.string.uuid(), accountEmail: input.accountEmail ?? null };

    return { service, pendingAddressRepository, emailSenderService, loggerService, channel, requester };
  }
});

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
