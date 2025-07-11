import { faker } from "@faker-js/faker";
import { INestApplication, Module } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { eq } from "drizzle-orm";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import request from "supertest";

import { LoggerService } from "@src/common/services/logger/logger.service";
import { DRIZZLE_PROVIDER_TOKEN } from "@src/infrastructure/db/config/db.config";
import { AlertListQuery } from "@src/interfaces/rest/controllers/alert/alert.controller";
import { HttpExceptionFilter } from "@src/interfaces/rest/filters/http-exception/http-exception.filter";
import { chainMessageCreateInputSchema } from "@src/interfaces/rest/http-schemas/alert.http-schema";
import { HttpResultInterceptor } from "@src/interfaces/rest/interceptors/http-result/http-result.interceptor";
import RestModule from "@src/interfaces/rest/rest.module";
import * as alertSchema from "@src/modules/alert/model-schemas";
import { AlertOutput, AlertRepository, GeneralAlertOutput } from "@src/modules/alert/repositories/alert/alert.repository";
import { GeneralParams } from "@src/modules/alert/repositories/alert/alert-json-fields.schema";
import { NotificationChannel } from "@src/modules/notifications/model-schemas";

import { generateNotificationChannel } from "@test/seeders/notification-channel.seeder";
import { generateSafeMock } from "@test/utils/safe-mock";

type AlertOutputMeta = Pick<GeneralAlertOutput, "id" | "userId" | "params">;

describe("Alerts CRUD", () => {
  it("should perform all CRUD operations against raw alerts", async () => {
    // NOTE: change this when there's a role that can create alerts
    const HAS_ROLE_TO_CREATE_ALERTS = false;
    const { app, userId, notificationChannelId } = await setup();

    const alerts = HAS_ROLE_TO_CREATE_ALERTS
      ? [await shouldCreate(userId, notificationChannelId, app), await shouldCreate(userId, notificationChannelId, app)]
      : [await prepareAlert(userId, notificationChannelId, app), await prepareAlert(userId, notificationChannelId, app)];
    await shouldUpdate(alerts[0], app);
    await shouldRead(alerts[0], app);
    await shouldList(alerts, app);
    await shouldList([alerts[0]], app, { dseq: alerts[0].params?.dseq });
    await shouldList([alerts[1]], app, { type: alerts[1].params?.type });
    await shouldList([alerts[0]], app, { limit: 1 });
    await shouldList([alerts[1]], app, { limit: 1, page: 2 });
    await shouldDelete(alerts[0], app);

    await app.close();
  });

  it("should exclude suppressed alerts from the alerts list", async () => {
    const { app, userId, notificationChannelId } = await setup();

    const regularAlert = await prepareAlert(userId, notificationChannelId, app);
    await prepareAlert(userId, notificationChannelId, app, { suppressedBySystem: true });

    await shouldList([regularAlert], app);

    await app.close();
  });

  async function prepareAlert(
    userId: string,
    notificationChannelId: string,
    app: INestApplication,
    params: Partial<GeneralParams> = {}
  ): Promise<AlertOutputMeta> {
    const repository = app.get(AlertRepository);
    const mockResult = generateSafeMock(chainMessageCreateInputSchema) as any;
    const { params: mockParams, ...input } = mockResult;
    const alert = (await repository.create({
      ...input,
      userId,
      notificationChannelId,
      enabled: true,
      params: {
        type: (mockParams as GeneralParams).type,
        dseq: (mockParams as GeneralParams).dseq,
        ...params
      }
    })) as GeneralAlertOutput;

    return {
      id: alert.id,
      userId,
      params: alert.params
    };
  }

  async function shouldCreate(userId: string, notificationChannelId: string, app: INestApplication): Promise<AlertOutputMeta> {
    const { params, ...input } = generateSafeMock(chainMessageCreateInputSchema);
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

  async function shouldList(alerts: AlertOutputMeta[], app: INestApplication, query: AlertListQuery = {}) {
    const res = await request(app.getHttpServer()).get("/v1/alerts").set("x-user-id", alerts[0].userId).query(query);

    expect(res.status).toBe(200);
    expect(res.body.data.map((alert: AlertOutput) => alert.id)).toEqual(expect.arrayContaining(alerts.map(alert => alert.id)));
  }

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
    await db.delete(schema.Alert).where(eq(schema.Alert.userId, userId));

    return { app, notificationChannelId: notificationChannel.id, userId };
  }
});
