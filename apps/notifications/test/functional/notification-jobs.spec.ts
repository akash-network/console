import { faker } from "@faker-js/faker";
import { Module } from "@nestjs/common";
import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import request from "supertest";
import { describe, expect, it, onTestFinished } from "vitest";

import { LoggerService } from "@src/common/services/logger/logger.service";
import { DRIZZLE_PROVIDER_TOKEN } from "@src/infrastructure/db/config/db.config";
import { HttpExceptionFilter } from "@src/interfaces/rest/filters/http-exception/http-exception.filter";
import RestModule from "@src/interfaces/rest/rest.module";
import { NotificationChannel } from "@src/modules/notifications/model-schemas";

import { generateNotificationChannel } from "@test/seeders/notification-channel.seeder";

const UNSUBSCRIBE = {
  url: "https://console.akash.network/unsubscribe?token=abc",
  oneClickUrl: "https://console-api.akash.network/v1/product-update-unsubscriptions?token=abc"
};

describe("Notification jobs (internal)", () => {
  it("queues a promotional notification for the user's default channel", async () => {
    const { app, userId } = await setup();

    const response = await request(app.getHttpServer())
      .post("/internal/v1/jobs/notification")
      .set("x-user-id", userId)
      .send({ ...notificationJob(), unsubscribe: UNSUBSCRIBE });

    expect(response.status).toBe(204);
  });

  it.each([
    { case: "an unsubscribe page that is not https", unsubscribe: { ...UNSUBSCRIBE, url: "http://console.akash.network/unsubscribe?token=abc" } },
    {
      case: "a one-click unsubscribe endpoint with a line break",
      unsubscribe: { ...UNSUBSCRIBE, oneClickUrl: `${UNSUBSCRIBE.oneClickUrl}\r\nBcc: someone@example.com` }
    }
  ])("rejects a notification with $case before queueing it", async ({ unsubscribe }) => {
    const { app, userId } = await setup();

    const response = await request(app.getHttpServer())
      .post("/internal/v1/jobs/notification")
      .set("x-user-id", userId)
      .send({ ...notificationJob(), unsubscribe });

    expect(response.status).toBe(400);
  });

  function notificationJob() {
    return {
      notificationId: `firstPurchaseBonusWindowOpened.${faker.string.uuid()}`,
      payload: { summary: "Your first-purchase bonus is still available", description: "Buy $100 or more to get 10% in bonus credits." }
    };
  }

  async function setup() {
    @Module({ imports: [RestModule] })
    class TestModule {}

    const module: TestingModule = await Test.createTestingModule({
      imports: [TestModule]
    }).compile();

    const app = module.createNestApplication();
    app.enableVersioning();
    app.useGlobalFilters(new HttpExceptionFilter(await app.resolve(LoggerService)));
    await app.init();
    onTestFinished(() => app.close());

    const userId = faker.string.uuid();
    const db = module.get<NodePgDatabase<{ NotificationChannel: typeof NotificationChannel }>>(DRIZZLE_PROVIDER_TOKEN);
    await db.insert(NotificationChannel).values([generateNotificationChannel({ userId, isDefault: true })]);

    return { app, userId };
  }
});
