import { faker } from "@faker-js/faker";
import { ConfigService } from "@nestjs/config";
import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import { Novu } from "@novu/api";
import type { MockProxy } from "jest-mock-extended";

import { AnalyticsService } from "@src/modules/notifications/services/analytics/analytics.service";
import { EmailSenderService } from "./email-sender.service";

import { MockProvider } from "@test/mocks/provider.mock";

describe(EmailSenderService.name, () => {
  it("should be defined", async () => {
    const { service } = await setup();
    expect(service).toBeDefined();
  });

  describe("send", () => {
    it("should send an email and track analytics", async () => {
      const { service, novu, analyticsService, novuWorkflowId } = await setup();
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
          content: params.content
        },
        overrides: {
          email: {
            to: [email]
          }
        }
      });

      expect(analyticsService.track).toHaveBeenCalledWith(params.userId, "email_sent", {
        recipient_count: 1,
        subject: params.subject,
        workflow_id: novuWorkflowId
      });
    });

    it("should track analytics on email failure", async () => {
      const { service, novu, analyticsService, novuWorkflowId } = await setup();
      const email = faker.internet.email();
      const params = {
        addresses: [email],
        subject: faker.lorem.sentence(),
        content: faker.lorem.paragraph(),
        userId: faker.string.uuid()
      };

      const error = new Error("Novu API error");
      novu.trigger.mockRejectedValue(error);

      await expect(service.send(params)).rejects.toThrow("Novu API error");

      expect(analyticsService.track).toHaveBeenCalledWith(params.userId, "email_failed", {
        recipient_count: 1,
        subject: params.subject,
        error: "Novu API error",
        workflow_id: novuWorkflowId
      });
    });
  });

  async function setup() {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EmailSenderService, MockProvider(Novu), MockProvider(ConfigService), MockProvider(AnalyticsService)]
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
      analyticsService: module.get<MockProxy<AnalyticsService>>(AnalyticsService),
      novuWorkflowId
    };
  }
});
