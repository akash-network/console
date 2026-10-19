import { faker } from "@faker-js/faker";
import { ConfigService } from "@nestjs/config";
import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import { Novu } from "@novu/api";
import { describe, expect, it } from "vitest";
import type { MockProxy } from "vitest-mock-extended";

import { LoggerService } from "@src/common/services/logger/logger.service";
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
    it("sends the email through the configured Novu workflow", async () => {
      const { service, novu, novuWorkflowId } = await setup();
      const email = faker.internet.email();
      const params = {
        addresses: [email],
        subject: faker.lorem.sentence(),
        content: faker.lorem.paragraph(),
        userId: faker.string.uuid()
      };

      await service.send(params);

      expect(novu.trigger).toHaveBeenCalledWith({
        workflowId: novuWorkflowId,
        to: {
          subscriberId: params.userId,
          email
        },
        payload: {
          subject: params.subject,
          content: expect.stringContaining(params.content)
        },
        overrides: {
          email: {
            to: [email]
          }
        }
      });
    });

    it("wraps the content in the branded layout document", async () => {
      const { service, novu } = await setup();
      const content = faker.lorem.paragraph();

      await service.send({
        addresses: [faker.internet.email()],
        subject: faker.lorem.sentence(),
        content,
        userId: faker.string.uuid()
      });

      const sentContent = novu.trigger.mock.calls[0][0].payload?.content as string;
      expect(sentContent).toContain("<!DOCTYPE html>");
      expect(sentContent).toContain(content);
    });

    it("renders the actions as buttons in the sent document", async () => {
      const { service, novu } = await setup();

      await service.send({
        addresses: [faker.internet.email()],
        subject: faker.lorem.sentence(),
        content: faker.lorem.paragraph(),
        userId: faker.string.uuid(),
        actions: [{ label: "Add credits", url: "https://console.akash.network/billing" }]
      });

      const sentContent = novu.trigger.mock.calls[0][0].payload?.content as string;
      expect(sentContent).toContain('href="https://console.akash.network/billing"');
      expect(sentContent).toContain(">Add credits</a>");
      expect(sentContent).toContain('class="btn-primary"');
    });

    it("sends to every address while addressing the first one as the subscriber", async () => {
      const { service, novu } = await setup();
      const addresses = [faker.internet.email(), faker.internet.email(), faker.internet.email()];
      const userId = faker.string.uuid();

      await service.send({
        addresses,
        subject: faker.lorem.sentence(),
        content: faker.lorem.paragraph(),
        userId
      });

      expect(novu.trigger).toHaveBeenCalledWith(
        expect.objectContaining({
          to: { subscriberId: userId, email: addresses[0] },
          overrides: { email: { to: addresses } }
        })
      );
    });

    it("logs which notification was emailed and how many recipients it reached", async () => {
      const { service, loggerService } = await setup();
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
        recipientCount: 2
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

    it("strips disallowed markup from the content", async () => {
      const { service, novu } = await setup();

      await service.send({
        addresses: [faker.internet.email()],
        subject: faker.lorem.sentence(),
        content: '<script>alert(1)</script><p>keep</p><strong>keep</strong><a href="https://akash.network">link</a>',
        userId: faker.string.uuid()
      });

      const sentContent = novu.trigger.mock.calls[0][0].payload?.content as string;
      expect(sentContent).toContain('<p>keep</p><strong>keep</strong><a href="https://akash.network">link</a>');
      expect(sentContent).not.toContain("<script>");
    });

    describe("when the email carries unsubscribe links", () => {
      it("asks the mailer for one-click unsubscribe headers pointing at the one-click endpoint", async () => {
        const { service, novu } = await setup();
        const addresses = [faker.internet.email()];

        await service.send({
          addresses,
          subject: faker.lorem.sentence(),
          content: faker.lorem.paragraph(),
          userId: faker.string.uuid(),
          unsubscribe: UNSUBSCRIBE
        });

        expect(novu.trigger).toHaveBeenCalledWith(
          expect.objectContaining({
            overrides: {
              email: {
                to: addresses,
                headers: {
                  "List-Unsubscribe": `<${UNSUBSCRIBE.oneClickUrl}>`,
                  "List-Unsubscribe-Post": "List-Unsubscribe=One-Click"
                }
              }
            }
          })
        );
      });

      it("links the unsubscribe page and shows the configured postal address in the footer", async () => {
        const { service, novu } = await setup({ postalAddress: "1 Market St, San Francisco, CA 94105" });

        await service.send({
          addresses: [faker.internet.email()],
          subject: faker.lorem.sentence(),
          content: faker.lorem.paragraph(),
          userId: faker.string.uuid(),
          unsubscribe: UNSUBSCRIBE
        });

        const sentContent = novu.trigger.mock.calls[0][0].payload?.content as string;
        expect(sentContent).toContain(`<a href="${UNSUBSCRIBE.url}" style="color:inherit;text-decoration:underline;">Unsubscribe</a>`);
        expect(sentContent).toContain(">1 Market St, San Francisco, CA 94105</p>");
      });
    });

    it("sends no unsubscribe headers nor unsubscribe footer for an email without unsubscribe links", async () => {
      const { service, novu } = await setup({ postalAddress: "1 Market St, San Francisco, CA 94105" });
      const addresses = [faker.internet.email()];

      await service.send({
        addresses,
        subject: faker.lorem.sentence(),
        content: faker.lorem.paragraph(),
        userId: faker.string.uuid()
      });

      const trigger = novu.trigger.mock.calls[0][0];
      expect(trigger.overrides).toEqual({ email: { to: addresses } });
      expect(trigger.payload?.content).not.toContain(">Unsubscribe</a>");
      expect(trigger.payload?.content).not.toContain("1 Market St");
    });
  });

  async function setup(input?: { postalAddress?: string }) {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EmailSenderService, MockProvider(Novu), MockProvider(ConfigService), MockProvider(LoggerService)]
    }).compile();

    const novuWorkflowId = faker.lorem.word();
    const configService = module.get<MockProxy<ConfigService>>(ConfigService);

    configService.getOrThrow.mockImplementation((key: string) => {
      if (key === "notifications.NOVU_MAILER_WORKFLOW_ID") {
        return novuWorkflowId;
      }
    });
    configService.get.mockImplementation((key: string) => {
      if (key === "notifications.PROMOTIONAL_EMAIL_POSTAL_ADDRESS") {
        return input?.postalAddress;
      }
    });

    return {
      service: module.get<EmailSenderService>(EmailSenderService),
      novu: module.get<MockProxy<Novu>>(Novu),
      loggerService: module.get<MockProxy<LoggerService>>(LoggerService),
      novuWorkflowId
    };
  }
});
