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
import * as schema from "@src/modules/alert/model-schemas";
import { AlertOutput } from "@src/modules/alert/repositories/alert/alert.repository";

import { generateContactPoint } from "@test/seeders/contact-point.seeder";

type AlertOutputMeta = Pick<AlertOutput, "id" | "userId">;

describe("Alerts CRUD", () => {
  it("should perform all CRUD operations against raw alerts", async () => {
    const { app, userId, contactPointId } = await setup();

    const alert = await shouldCreate(userId, contactPointId, app);
    await shouldUpdate(alert, app);
    await shouldRead(alert, app);
    await shouldDelete(alert, app);

    await app.close();
  });

  async function shouldCreate(userId: string, contactPointId: string, app: INestApplication): Promise<AlertOutputMeta> {
    const input = generateMock(chainMessageCreateInputSchema);
    input.contactPointId = contactPointId;
    input.enabled = true;

    const res = await request(app.getHttpServer()).post("/v1/alerts").set("x-user-id", userId).send({ data: input });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      ...input,
      userId,
      id: expect.any(String),
      status: "NORMAL",
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

  async function setup(): Promise<{
    app: INestApplication;
    contactPointId: string;
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
    const db = module.get<NodePgDatabase<typeof schema>>(DRIZZLE_PROVIDER_TOKEN);
    const [contactPoint] = await db
      .insert(schema.ContactPoint)
      .values([generateContactPoint({ userId })])
      .returning();

    return { app, contactPointId: contactPoint.id, userId };
  }
});
