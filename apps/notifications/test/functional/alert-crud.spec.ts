import { generateMock } from "@anatine/zod-mock";
import { faker } from "@faker-js/faker";
import { INestApplication, Module } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import request from "supertest";

import { DRIZZLE_PROVIDER_TOKEN } from "@src/infrastructure/db/config/db.config";
import { HttpExceptionFilter } from "@src/interfaces/rest/filters/http-exception/http-exception.filter";
import { chainMessageCreateInputSchema } from "@src/interfaces/rest/http-schemas/alert.http-schema";
import { HttpResultInterceptor } from "@src/interfaces/rest/interceptors/http-result/http-result.interceptor";
import RestModule from "@src/interfaces/rest/rest.module";
import * as schema from "@src/modules/alert/model-schemas";

import { generateContactPoint } from "@test/seeders/contact-point.seeder";

describe("Alerts CRUD", () => {
  it("should perform all CRUD operations against raw alerts", async () => {
    const { app, userId, contactPointId } = await setup();

    const alertId = await shouldCreate(userId, contactPointId, app);
    await shouldUpdate(alertId, app);
    await shouldRead(alertId, app);
    await shouldDelete(alertId, app);

    await app.close();
  });

  async function shouldCreate(userId: string, contactPointId: string, app: INestApplication): Promise<string> {
    const input = generateMock(chainMessageCreateInputSchema);
    input.userId = userId;
    input.contactPointId = contactPointId;
    input.enabled = true;

    const res = await request(app.getHttpServer()).post("/v1/alerts").send({ data: input });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      ...input,
      id: expect.any(String),
      status: "NORMAL",
      createdAt: expect.any(String),
      updatedAt: expect.any(String)
    });

    return res.body.data.id;
  }

  async function shouldUpdate(alertId: string, app: INestApplication) {
    const res = await request(app.getHttpServer())
      .patch(`/v1/alerts/${alertId}`)
      .send({ data: { enabled: false } });

    expect(res.status).toBe(200);
    expect(res.body.data.enabled).toBe(false);
  }

  async function shouldRead(alertId: string, app: INestApplication) {
    const res = await request(app.getHttpServer()).get(`/v1/alerts/${alertId}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(alertId);
  }

  async function shouldDelete(alertId: string, app: INestApplication) {
    const deleteRes = await request(app.getHttpServer()).delete(`/v1/alerts/${alertId}`);
    const getRes = await request(app.getHttpServer()).get(`/v1/alerts/${alertId}`);

    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.data.id).toBe(alertId);

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
    app.useGlobalFilters(new HttpExceptionFilter());

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
