import { faker } from "@faker-js/faker";
import { ConfigService } from "@nestjs/config";
import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import { Novu } from "@novu/api";
import type { MockProxy } from "jest-mock-extended";

import { EmailSenderService } from "./email-sender.service";

import { MockProvider } from "@test/mocks/provider.mock";

describe(EmailSenderService.name, () => {
  it("should be defined", async () => {
    const { service } = await setup();
    expect(service).toBeDefined();
  });

  describe("send", () => {
    it("should send an email", async () => {
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
          content: params.content
        },
        overrides: {
          email: {
            to: [email]
          }
        }
      });
    });
  });

  async function setup(): Promise<{
    service: EmailSenderService;
    novu: MockProxy<Novu>;
    novuWorkflowId: string;
  }> {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EmailSenderService, MockProvider(Novu), MockProvider(ConfigService)]
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
      novuWorkflowId
    };
  }
});
