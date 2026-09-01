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
  });

  async function setup() {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EmailSenderService, MockProvider(Novu), MockProvider(ConfigService), MockProvider(LoggerService)]
    }).compile();

    const novuWorkflowId = faker.lorem.word();

    module.get<MockProxy<ConfigService>>(ConfigService).getOrThrow.mockImplementation((key: string) => {
      if (key === "notifications.NOVU_MAILER_WORKFLOW_ID") {
        return novuWorkflowId;
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
