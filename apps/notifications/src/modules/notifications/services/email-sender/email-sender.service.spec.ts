import { faker } from "@faker-js/faker";
import { ConfigService } from "@nestjs/config";
import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import { describe, expect, it } from "vitest";
import type { MockProxy } from "vitest-mock-extended";

import { LoggerService } from "@src/common/services/logger/logger.service";
import { SendgridMailClient } from "../sendgrid-mail-client/sendgrid-mail-client.service";
import { EmailSenderService } from "./email-sender.service";

import { MockProvider } from "@test/mocks/provider.mock";

const UNSUBSCRIBE = {
  url: "https://console.akash.network/unsubscribe?token=abc",
  oneClickUrl: "https://console-api.akash.network/v1/product-update-unsubscriptions?token=abc"
};

describe(EmailSenderService.name, () => {
  it("should be defined", async () => {
    const { service } = await setup();
    expect(service).toBeDefined();
  });

  describe("send", () => {
    it("sends the rendered email to SendGrid", async () => {
      const { service, sendgridMailClient } = await setup();
      const email = faker.internet.email();
      const params = {
        addresses: [email],
        subject: faker.lorem.sentence(),
        content: faker.lorem.paragraph(),
        userId: faker.string.uuid()
      };

      await service.send(params);

      expect(sendgridMailClient.send).toHaveBeenCalledWith({
        to: [email],
        subject: params.subject,
        html: expect.stringContaining(params.content)
      });
    });

    it("wraps the content in the branded layout document", async () => {
      const { service, sendgridMailClient } = await setup();
      const content = faker.lorem.paragraph();

      await service.send({
        addresses: [faker.internet.email()],
        subject: faker.lorem.sentence(),
        content,
        userId: faker.string.uuid()
      });

      const sentContent = sendgridMailClient.send.mock.calls[0][0].html;
      expect(sentContent).toContain("<!DOCTYPE html>");
      expect(sentContent).toContain(content);
    });

    it("renders the actions as buttons in the sent document", async () => {
      const { service, sendgridMailClient } = await setup();

      await service.send({
        addresses: [faker.internet.email()],
        subject: faker.lorem.sentence(),
        content: faker.lorem.paragraph(),
        userId: faker.string.uuid(),
        actions: [{ label: "Add credits", url: "https://console.akash.network/billing" }]
      });

      const sentContent = sendgridMailClient.send.mock.calls[0][0].html;
      expect(sentContent).toContain('href="https://console.akash.network/billing"');
      expect(sentContent).toContain(">Add credits</a>");
      expect(sentContent).toContain('class="btn-primary"');
    });

    it("sends to every address of the channel", async () => {
      const { service, sendgridMailClient } = await setup();
      const addresses = [faker.internet.email(), faker.internet.email(), faker.internet.email()];

      await service.send({
        addresses,
        subject: faker.lorem.sentence(),
        content: faker.lorem.paragraph(),
        userId: faker.string.uuid()
      });

      expect(sendgridMailClient.send).toHaveBeenCalledWith(expect.objectContaining({ to: addresses }));
    });

    it("logs which notification was emailed, how many recipients it reached and the SendGrid message id", async () => {
      const { service, loggerService, messageId } = await setup();
      const params = {
        addresses: [faker.internet.email(), faker.internet.email()],
        subject: faker.lorem.sentence(),
        content: faker.lorem.paragraph(),
        userId: faker.string.uuid(),
        notificationId: `creditsRunningLow.${faker.string.uuid()}`
      };

      await service.send(params);

      expect(loggerService.info).toHaveBeenCalledWith({
        event: "EMAIL_SENT",
        notificationId: params.notificationId,
        userId: params.userId,
        subject: params.subject,
        recipientCount: 2,
        messageId
      });
    });

    it("logs an undefined notificationId for alert emails that carry none", async () => {
      const { service, loggerService } = await setup();

      await service.send({
        addresses: [faker.internet.email()],
        subject: faker.lorem.sentence(),
        content: faker.lorem.paragraph(),
        userId: faker.string.uuid()
      });

      expect(loggerService.info).toHaveBeenCalledWith(expect.objectContaining({ event: "EMAIL_SENT", notificationId: undefined }));
    });

    it("leaves the subject out of the log for an email that carries a code", async () => {
      const { service, loggerService, messageId } = await setup();
      const code = faker.string.numeric(6);
      const params = {
        addresses: [faker.internet.email()],
        subject: `${code} is your Akash Console verification code`,
        content: faker.lorem.paragraph(),
        userId: faker.string.uuid(),
        code,
        notificationId: `emailVerificationCode.${faker.string.uuid()}`
      };

      await service.send(params);

      expect(loggerService.info).toHaveBeenCalledWith({
        event: "EMAIL_SENT",
        notificationId: params.notificationId,
        userId: params.userId,
        recipientCount: 1,
        messageId
      });
    });

    it("strips disallowed markup from the content", async () => {
      const { service, sendgridMailClient } = await setup();

      await service.send({
        addresses: [faker.internet.email()],
        subject: faker.lorem.sentence(),
        content: '<script>alert(1)</script><p>keep</p><strong>keep</strong><a href="https://akash.network">link</a>',
        userId: faker.string.uuid()
      });

      const sentContent = sendgridMailClient.send.mock.calls[0][0].html;
      expect(sentContent).toContain('<p>keep</p><strong>keep</strong><a href="https://akash.network">link</a>');
      expect(sentContent).not.toContain("<script>");
    });

    it("fails without logging the email as sent when SendGrid does not take it", async () => {
      const { service, sendgridMailClient, loggerService } = await setup();
      const error = new Error("SendGrid answered 400");
      sendgridMailClient.send.mockRejectedValue(error);

      await expect(
        service.send({
          addresses: [faker.internet.email()],
          subject: faker.lorem.sentence(),
          content: faker.lorem.paragraph(),
          userId: faker.string.uuid()
        })
      ).rejects.toBe(error);
      expect(loggerService.info).not.toHaveBeenCalled();
    });

    describe("when the email carries unsubscribe links", () => {
      it("sends one-click unsubscribe headers pointing at the one-click endpoint", async () => {
        const { service, sendgridMailClient } = await setup();
        const addresses = [faker.internet.email()];

        await service.send({
          addresses,
          subject: faker.lorem.sentence(),
          content: faker.lorem.paragraph(),
          userId: faker.string.uuid(),
          unsubscribe: UNSUBSCRIBE
        });

        expect(sendgridMailClient.send).toHaveBeenCalledWith(
          expect.objectContaining({
            to: addresses,
            headers: {
              "List-Unsubscribe": `<${UNSUBSCRIBE.oneClickUrl}>`,
              "List-Unsubscribe-Post": "List-Unsubscribe=One-Click"
            }
          })
        );
      });

      it("links the unsubscribe page and shows the configured postal address in the footer", async () => {
        const { service, sendgridMailClient } = await setup({ postalAddress: "1 Market St, San Francisco, CA 94105" });

        await service.send({
          addresses: [faker.internet.email()],
          subject: faker.lorem.sentence(),
          content: faker.lorem.paragraph(),
          userId: faker.string.uuid(),
          unsubscribe: UNSUBSCRIBE
        });

        const sentContent = sendgridMailClient.send.mock.calls[0][0].html;
        expect(sentContent).toContain(`<a href="${UNSUBSCRIBE.url}" style="color:inherit;text-decoration:underline;">Unsubscribe</a>`);
        expect(sentContent).toContain(">1 Market St, San Francisco, CA 94105</p>");
      });
    });

    it("says in the footer why the address receives an email that names its own reason", async () => {
      const { service, sendgridMailClient } = await setup();

      await service.send({
        addresses: [faker.internet.email()],
        subject: faker.lorem.sentence(),
        content: faker.lorem.paragraph(),
        userId: faker.string.uuid(),
        receivingReason: "this address was added to a notification channel"
      });

      expect(sendgridMailClient.send.mock.calls[0][0].html).toContain("You're receiving this because this address was added to a notification channel.");
    });

    it("sends no unsubscribe headers nor unsubscribe footer for an email without unsubscribe links", async () => {
      const { service, sendgridMailClient } = await setup({ postalAddress: "1 Market St, San Francisco, CA 94105" });
      const addresses = [faker.internet.email()];

      await service.send({
        addresses,
        subject: faker.lorem.sentence(),
        content: faker.lorem.paragraph(),
        userId: faker.string.uuid()
      });

      const [mail] = sendgridMailClient.send.mock.calls[0];
      expect(mail).not.toHaveProperty("headers");
      expect(mail.html).not.toContain(">Unsubscribe</a>");
      expect(mail.html).not.toContain("1 Market St");
    });
  });

  async function setup(input?: { postalAddress?: string }) {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EmailSenderService, MockProvider(SendgridMailClient), MockProvider(ConfigService), MockProvider(LoggerService)]
    }).compile();

    const messageId = faker.string.alphanumeric(22);
    const sendgridMailClient = module.get<MockProxy<SendgridMailClient>>(SendgridMailClient);
    sendgridMailClient.send.mockResolvedValue({ messageId });
    const configService = module.get<MockProxy<ConfigService>>(ConfigService);
    configService.get.mockImplementation((key: string) => {
      if (key === "notifications.PROMOTIONAL_EMAIL_POSTAL_ADDRESS") {
        return input?.postalAddress;
      }
    });

    return {
      service: module.get<EmailSenderService>(EmailSenderService),
      sendgridMailClient,
      loggerService: module.get<MockProxy<LoggerService>>(LoggerService),
      messageId
    };
  }
});
