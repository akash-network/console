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

import { generateContactPoint } from "@test/seeders/contact-point.seeder";

describe("Deployment Alerts CRUD", () => {
  it("should perform all CRUD operations against raw alerts", async () => {
    const { app, userId, contactPointId } = await setup();

    const input = generateMock(chainMessageCreateInputSchema);
    const input2 = generateMock(chainMessageCreateInputSchema);
    input.contactPointId = contactPointId;
    input.enabled = true;
    input2.contactPointId = contactPointId;
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
