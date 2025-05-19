import { generateMock } from "@anatine/zod-mock";
import { faker } from "@faker-js/faker";
import { INestApplication, Module } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";

import { LoggerService } from "@src/common/services/logger/logger.service";
import { contactPointCreateInputSchema } from "@src/interfaces/rest/controllers/contact-point/contact-point.controller";
import { HttpExceptionFilter } from "@src/interfaces/rest/filters/http-exception/http-exception.filter";
import { HttpResultInterceptor } from "@src/interfaces/rest/interceptors/http-result/http-result.interceptor";
import RestModule from "@src/interfaces/rest/rest.module";

describe("Contact Points CRUD", () => {
  it("should perform all CRUD operations against contact points", async () => {
    const { app } = await setup();

    const contactPointId = await shouldCreate(app);
    await shouldUpdate(contactPointId, app);
    await shouldRead(contactPointId, app);
    await shouldDelete(contactPointId, app);

    await app.close();
  });

  async function shouldCreate(app: INestApplication): Promise<string> {
    const input = generateMock(contactPointCreateInputSchema);
    input.userId = faker.string.uuid();
    input.type = "email";
    input.config = { addresses: [faker.internet.email()] };

    const res = await request(app.getHttpServer()).post("/v1/contact-points").send({ data: input });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      ...input,
      id: expect.any(String),
      createdAt: expect.any(String),
      updatedAt: expect.any(String)
    });

    return res.body.data.id;
  }

  async function shouldUpdate(contactPointId: string, app: INestApplication): Promise<void> {
    const newEmail = faker.internet.email();
    const res = await request(app.getHttpServer())
      .patch(`/v1/contact-points/${contactPointId}`)
      .send({
        data: {
          config: { addresses: [newEmail] }
        }
      });

    expect(res.status).toBe(200);
    expect(res.body.data.config.addresses).toContain(newEmail);
  }

  async function shouldRead(contactPointId: string, app: INestApplication): Promise<void> {
    const res = await request(app.getHttpServer()).get(`/v1/contact-points/${contactPointId}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(contactPointId);
  }

  async function shouldDelete(contactPointId: string, app: INestApplication): Promise<void> {
    const deleteRes = await request(app.getHttpServer()).delete(`/v1/contact-points/${contactPointId}`);
    const getRes = await request(app.getHttpServer()).get(`/v1/contact-points/${contactPointId}`);

    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.data.id).toBe(contactPointId);

    expect(getRes.status).toBe(404);
  }

  async function setup(): Promise<{
    app: INestApplication;
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

    return { app };
  }
});
