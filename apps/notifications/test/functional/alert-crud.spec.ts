import { generateMock } from "@anatine/zod-mock";
import { faker } from "@faker-js/faker";
import { INestApplication, Module } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import request from "supertest";

import { LoggerService } from "@src/common/services/logger/logger.service";
import { DRIZZLE_PROVIDER_TOKEN } from "@src/infrastructure/db/config/db.config";
import { HttpExceptionFilter } from "@src/interfaces/rest/filters/http-exception/http-exception.filter";
import { chainMessageCreateInputSchema } from "@src/interfaces/rest/http-schemas/alert.http-schema";
import { HttpResultInterceptor } from "@src/interfaces/rest/interceptors/http-result/http-result.interceptor";
import RestModule from "@src/interfaces/rest/rest.module";
import * as alertSchema from "@src/modules/alert/model-schemas";
import { AlertOutput } from "@src/modules/alert/repositories/alert/alert.repository";
import { NotificationChannel } from "@src/modules/notifications/model-schemas";

import { generateNotificationChannel } from "@test/seeders/notification-channel.seeder";

type AlertOutputMeta = Pick<AlertOutput, "id" | "userId">;

describe("Alerts CRUD", () => {
  it("should perform all CRUD operations against raw alerts", async () => {
    const { app, userId, notificationChannelId } = await setup();

    const alert = await shouldCreate(userId, notificationChannelId, app);
    await shouldUpdate(alert, app);
    await shouldRead(alert, app);
    await shouldDelete(alert, app);

    await app.close();
  });

  async function shouldCreate(userId: string, notificationChannelId: string, app: INestApplication): Promise<AlertOutputMeta> {
    const { params, ...input } = generateMock(chainMessageCreateInputSchema);
    input.notificationChannelId = notificationChannelId;
    input.enabled = true;

    const res = await request(app.getHttpServer()).post("/v1/alerts").set("x-user-id", userId).send({ data: input });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      ...input,
      userId,
      id: expect.any(String),
      status: "OK",
      createdAt: expect.any(String),
      updatedAt: expect.any(String)
    });

    return {
      id: res.body.data.id,
      userId
    };
  }

  async function shouldUpdate(alert: AlertOutputMeta, app: INestApplication) {
    const res = await request(app.getHttpServer())
      .patch(`/v1/alerts/${alert.id}`)
      .set("x-user-id", alert.userId)
      .send({ data: { enabled: false } });

    expect(res.status).toBe(200);
    expect(res.body.data.enabled).toBe(false);
  }

  async function shouldRead(alert: AlertOutputMeta, app: INestApplication) {
    const res = await request(app.getHttpServer()).get(`/v1/alerts/${alert.id}`).set("x-user-id", alert.userId);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(alert.id);
  }

  async function shouldDelete(alert: AlertOutputMeta, app: INestApplication) {
    const deleteRes = await request(app.getHttpServer()).delete(`/v1/alerts/${alert.id}`).set("x-user-id", alert.userId);
    const getRes = await request(app.getHttpServer()).get(`/v1/alerts/${alert.id}`).set("x-user-id", alert.userId);

    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.data.id).toBe(alert.id);

    expect(getRes.status).toBe(404);
  }

  describe("Deployment Alerts CRUD", () => {
    it("should perform all CRUD operations against raw alerts", async () => {
      const { app, userId, notificationChannelId } = await setup();

      const input = generateMock(chainMessageCreateInputSchema);
      const input2 = generateMock(chainMessageCreateInputSchema);
      input.notificationChannelId = notificationChannelId;
      input.enabled = true;
      input2.notificationChannelId = notificationChannelId;
      input2.enabled = true;

      if (!input.params) {
        throw new Error("Missing params on generated mock data");
      }

      await Promise.all([input, input2].map(alertInput => request(app.getHttpServer()).post("/v1/alerts").set("x-user-id", userId).send({ data: alertInput })));
      const res = await request(app.getHttpServer()).get(`/v1/alerts?dseq=${input.params.dseq}`).set("x-user-id", userId);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].params).toEqual(input.params);

      await app.close();
    });
  });

  async function setup(): Promise<{
    app: INestApplication;
    notificationChannelId: string;
    userId: string;
  }> {
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

    const userId = faker.string.uuid();
    const schema = {
      ...alertSchema,
      NotificationChannel
    };
    const db = module.get<NodePgDatabase<typeof schema>>(DRIZZLE_PROVIDER_TOKEN);
    const [notificationChannel] = await db
      .insert(NotificationChannel)
      .values([generateNotificationChannel({ userId })])
      .returning();

    return { app, notificationChannelId: notificationChannel.id, userId };
  }
});
