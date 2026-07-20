import { faker } from "@faker-js/faker";
import type { INestApplication } from "@nestjs/common";
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
import * as alertSchema from "@src/modules/alert/model-schemas";
import { Alert } from "@src/modules/alert/model-schemas";
import { NotificationChannel } from "@src/modules/notifications/model-schemas";

import { generateGeneralAlert } from "@test/seeders/general-alert.seeder";
import { generateNotificationChannel } from "@test/seeders/notification-channel.seeder";

describe("Account Purge (internal)", () => {
  it("removes the user's notification channels and alerts", async () => {
    const { app, userId } = await setup({ withSeed: true });

    const purgeRes = await request(app.getHttpServer()).post(`/internal/v1/users/${userId}/purge`);
    expect(purgeRes.status).toBe(204);

    const channelsRes = await request(app.getHttpServer()).get("/v1/notification-channels").set("x-user-id", userId);
    expect(channelsRes.status).toBe(200);
    expect(channelsRes.body.data).toEqual([]);

    const alertsRes = await request(app.getHttpServer()).get("/v1/alerts").set("x-user-id", userId);
    expect(alertsRes.status).toBe(200);
    expect(alertsRes.body.data).toEqual([]);
  });

  it("is idempotent — second call for the same user is a no-op", async () => {
    const { app, userId } = await setup({ withSeed: false });

    const first = await request(app.getHttpServer()).post(`/internal/v1/users/${userId}/purge`);
    const second = await request(app.getHttpServer()).post(`/internal/v1/users/${userId}/purge`);

    expect(first.status).toBe(204);
    expect(second.status).toBe(204);
  });

  async function setup(input: { withSeed: boolean }): Promise<{ app: INestApplication; userId: string }> {
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

    if (input.withSeed) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const schema = { ...alertSchema, NotificationChannel };
      const db = module.get<NodePgDatabase<typeof schema>>(DRIZZLE_PROVIDER_TOKEN);
      const [channel] = await db
        .insert(NotificationChannel)
        .values([generateNotificationChannel({ userId })])
        .returning();
      await db.insert(Alert).values([generateGeneralAlert({ userId, notificationChannelId: channel.id })]);
    }

    return { app, userId };
  }
});
