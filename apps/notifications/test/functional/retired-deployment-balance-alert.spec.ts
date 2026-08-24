import { faker } from "@faker-js/faker";
import { Module } from "@nestjs/common";
import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { LoggerService } from "@src/common/services/logger/logger.service";
import { DRIZZLE_PROVIDER_TOKEN } from "@src/infrastructure/db/config/db.config";
import { HttpExceptionFilter } from "@src/interfaces/rest/filters/http-exception/http-exception.filter";
import { HttpResultInterceptor } from "@src/interfaces/rest/interceptors/http-result/http-result.interceptor";
import RestModule from "@src/interfaces/rest/rest.module";
import * as alertSchema from "@src/modules/alert/model-schemas";
import { NotificationChannel } from "@src/modules/notifications/model-schemas";

import { generateDeploymentBalanceAlert } from "@test/seeders/deployment-balance-alert.seeder";
import { generateGeneralAlert } from "@test/seeders/general-alert.seeder";
import { generateNotificationChannel } from "@test/seeders/notification-channel.seeder";

const generateDeploymentClosedAlert = (overrides: { userId: string; notificationChannelId: string }) =>
  generateGeneralAlert({
    ...overrides,
    type: "CHAIN_EVENT",
    params: { dseq: faker.string.numeric(6), type: "DEPLOYMENT_CLOSED" }
  });

describe("retired deployment-balance alerts", () => {
  it("excludes them from the alerts list and its total", async () => {
    const { app, userId, notificationChannelId, seedAlerts } = await setup();
    const visibleAlert = generateDeploymentClosedAlert({ userId, notificationChannelId });
    await seedAlerts([generateDeploymentBalanceAlert({ userId, notificationChannelId }), visibleAlert]);

    const res = await request(app.getHttpServer()).get("/v1/alerts").set("x-user-id", userId);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([expect.objectContaining({ id: visibleAlert.id })]);
    expect(res.body.pagination).toMatchObject({ total: 1, totalPages: 1 });

    await app.close();
  });

  it("does not block deleting their notification channel", async () => {
    const { app, userId, notificationChannelId, seedAlerts } = await setup();
    await seedAlerts([generateDeploymentBalanceAlert({ userId, notificationChannelId })]);

    const res = await request(app.getHttpServer()).delete(`/v1/notification-channels/${notificationChannelId}`).set("x-user-id", userId);

    expect(res.status).toBe(200);

    await app.close();
  });

  it("still blocks deleting a notification channel with a live alert", async () => {
    const { app, userId, notificationChannelId, seedAlerts } = await setup();
    await seedAlerts([generateDeploymentClosedAlert({ userId, notificationChannelId })]);

    const res = await request(app.getHttpServer()).delete(`/v1/notification-channels/${notificationChannelId}`).set("x-user-id", userId);

    expect(res.status).toBe(400);

    await app.close();
  });

  async function setup() {
    @Module({
      imports: [RestModule]
    })
    class TestModule {}

    const module: TestingModule = await Test.createTestingModule({
      imports: [TestModule]
    }).compile();

    const app = module.createNestApplication();
    app.enableVersioning();
    app.useGlobalInterceptors(new HttpResultInterceptor());
    app.useGlobalFilters(new HttpExceptionFilter(await app.resolve(LoggerService)));

    await app.init();

    const db = module.get<NodePgDatabase<typeof alertSchema & { NotificationChannel: typeof NotificationChannel }>>(DRIZZLE_PROVIDER_TOKEN);
    const userId = faker.string.uuid();
    const [notificationChannel] = await db
      .insert(NotificationChannel)
      .values([generateNotificationChannel({ userId, isDefault: false })])
      .returning();

    return {
      app,
      userId,
      notificationChannelId: notificationChannel.id,
      seedAlerts: (alerts: (typeof alertSchema.Alert.$inferInsert)[]) => db.insert(alertSchema.Alert).values(alerts)
    };
  }
});
