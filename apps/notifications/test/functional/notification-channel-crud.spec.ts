import { generateMock } from "@anatine/zod-mock";
import { faker } from "@faker-js/faker";
import { INestApplication, Module } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { LoggerService } from "@src/common/services/logger/logger.service";
import { notificationChannelCreateInputSchema } from "@src/interfaces/rest/controllers/notification-channel/notification-channel.controller";
import { HttpExceptionFilter } from "@src/interfaces/rest/filters/http-exception/http-exception.filter";
import RestModule from "@src/interfaces/rest/rest.module";
import { NotificationChannelOutput } from "@src/modules/notifications/repositories/notification-channel/notification-channel.repository";

type NotificationChannelMeta = Pick<NotificationChannelOutput, "id" | "userId">;

describe("Contact Points CRUD", () => {
  it("should perform all CRUD operations against contact points", async () => {
    const { app } = await setup();

    const notificationChannel = await shouldCreate(app);
    await shouldUpdate(notificationChannel, app);
    await shouldRead(notificationChannel, app);
    await shouldDelete(notificationChannel, app);

    await app.close();
  });

  async function shouldCreate(app: INestApplication): Promise<NotificationChannelMeta> {
    const input = generateMock(notificationChannelCreateInputSchema);
    const userId = faker.string.uuid();
    input.type = "email";
    input.config = { addresses: [faker.internet.email()] };

    const res = await request(app.getHttpServer()).post("/v1/notification-channels").set("x-user-id", userId).send({ data: input });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      ...input,
      userId,
      id: expect.any(String),
      createdAt: expect.any(String),
      updatedAt: expect.any(String)
    });

    return {
      id: res.body.data.id,
      userId
    };
  }

  async function shouldUpdate(notificationChannel: NotificationChannelMeta, app: INestApplication): Promise<void> {
    const newEmail = faker.internet.email();
    const res = await request(app.getHttpServer())
      .patch(`/v1/notification-channels/${notificationChannel.id}`)
      .set("x-user-id", notificationChannel.userId)
      .send({
        data: {
          config: { addresses: [newEmail] }
        }
      });

    expect(res.status).toBe(200);
    expect(res.body.data.config.addresses).toContain(newEmail);
  }

  async function shouldRead(notificationChannel: NotificationChannelMeta, app: INestApplication): Promise<void> {
    const [singleRes, listRes] = await Promise.all([
      request(app.getHttpServer()).get(`/v1/notification-channels/${notificationChannel.id}`).set("x-user-id", notificationChannel.userId),
      request(app.getHttpServer()).get(`/v1/notification-channels`).set("x-user-id", notificationChannel.userId)
    ]);

    expect(listRes.status).toBe(200);
    expect(listRes.body).toMatchObject({
      data: [expect.objectContaining(notificationChannel)],
      pagination: {
        total: 1,
        page: 1,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false
      }
    });

    expect(singleRes.status).toBe(200);
    expect(singleRes.body.data.id).toBe(notificationChannel.id);
  }

  async function shouldDelete(notificationChannel: NotificationChannelMeta, app: INestApplication): Promise<void> {
    const deleteRes = await request(app.getHttpServer())
      .delete(`/v1/notification-channels/${notificationChannel.id}`)
      .set("x-user-id", notificationChannel.userId);
    const getRes = await request(app.getHttpServer()).get(`/v1/notification-channels/${notificationChannel.id}`).set("x-user-id", notificationChannel.userId);

    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.data.id).toBe(notificationChannel.id);

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
    app.useGlobalFilters(new HttpExceptionFilter(await app.resolve(LoggerService)));

    await app.init();

    return { app };
  }
});
