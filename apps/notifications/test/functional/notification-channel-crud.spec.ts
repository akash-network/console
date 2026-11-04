import { generateMock } from "@anatine/zod-mock";
import { faker } from "@faker-js/faker";
import { INestApplication, Module } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { Novu } from "@novu/api";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { mock, type MockProxy } from "vitest-mock-extended";

import { LoggerService } from "@src/common/services/logger/logger.service";
import { DRIZZLE_PROVIDER_TOKEN } from "@src/infrastructure/db/config/db.config";
import { notificationChannelCreateInputSchema } from "@src/interfaces/rest/controllers/notification-channel/notification-channel.controller";
import { HttpExceptionFilter } from "@src/interfaces/rest/filters/http-exception/http-exception.filter";
import RestModule from "@src/interfaces/rest/rest.module";
import { NotificationChannelOutput } from "@src/modules/notifications/repositories/notification-channel/notification-channel.repository";
import { AddressConfirmationService } from "@src/modules/notifications/services/address-confirmation/address-confirmation.service";

import { untilAQueryWaitsOnALock } from "@test/services/lock-waits";

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

  it("answers 400 to notification channel ids that are not uuids", async () => {
    const { app } = await setup();
    const server = app.getHttpServer();
    const userId = faker.string.uuid();

    const responses = [
      await request(server).get("/v1/notification-channels/..%2fhealth").set("x-user-id", userId),
      await request(server)
        .patch("/v1/notification-channels/..%2fhealth")
        .set("x-user-id", userId)
        .send({ data: { name: "renamed channel" } }),
      await request(server).delete("/v1/notification-channels/..%2fhealth").set("x-user-id", userId)
    ];

    expect(responses.map(res => res.status)).toEqual([400, 400, 400]);

    await app.close();
  });

  it("answers 400 to an update that changes no field", async () => {
    const { app } = await setup();

    const res = await request(app.getHttpServer())
      .patch(`/v1/notification-channels/${faker.string.uuid()}`)
      .set("x-user-id", faker.string.uuid())
      .send({ data: {} });

    expect(res.status).toBe(400);

    await app.close();
  });

  it("answers 400 to a default channel request without the channel details", async () => {
    const { app } = await setup();

    const res = await request(app.getHttpServer()).post("/v1/notification-channels/default").set("x-user-id", faker.string.uuid()).send({});

    expect(res.status).toBe(400);

    await app.close();
  });

  it("creates the default notification channel only once", async () => {
    const { app } = await setup();
    const server = app.getHttpServer();
    const userId = faker.string.uuid();
    const email = faker.internet.email();
    const input = { name: "Default", type: "email", config: { addresses: [email] } };

    const responses = [
      await request(server).post("/v1/notification-channels/default").set(accountHeaders(userId, email)).send({ data: input }),
      await request(server).post("/v1/notification-channels/default").set(accountHeaders(userId, email)).send({ data: input })
    ];
    const listRes = await request(server).get("/v1/notification-channels").set("x-user-id", userId);

    expect(responses.map(res => res.status)).toEqual([204, 204]);
    expect(listRes.body).toMatchObject({
      data: [expect.objectContaining({ ...input, pendingAddresses: [], userId, isDefault: true })],
      pagination: { total: 1 }
    });

    await app.close();
  });

  it("holds an address other than the account's verified email until the link emailed to it confirms it, once", async () => {
    const { app, novu } = await setup();
    const server = app.getHttpServer();
    const userId = faker.string.uuid();
    const accountEmail = faker.internet.email().toLowerCase();
    const teammate = faker.internet.email().toLowerCase();

    const createRes = await request(server)
      .post("/v1/notification-channels")
      .set(accountHeaders(userId, accountEmail))
      .send({ data: { name: "Ops", type: "email", config: { addresses: [accountEmail, teammate] } } });
    const token = confirmationTokenEmailedTo(novu, teammate);
    const confirmRes = await request(server).post("/internal/v1/address-confirmations").send({ token });
    const reuseRes = await request(server).post("/internal/v1/address-confirmations").send({ token });
    const getRes = await request(server).get(`/v1/notification-channels/${createRes.body.data.id}`).set("x-user-id", userId);

    expect(createRes.body.data).toMatchObject({ config: { addresses: [accountEmail] }, pendingAddresses: [teammate] });
    expect(novu.trigger).toHaveBeenCalledTimes(1);
    expect([confirmRes.status, reuseRes.status]).toEqual([204, 400]);
    expect(getRes.body.data).toMatchObject({ config: { addresses: [accountEmail, teammate] }, pendingAddresses: [] });

    await app.close();
  });

  it("confirms the account's email on the user's channels once they verify it", async () => {
    const { app, novu } = await setup();
    const server = app.getHttpServer();
    const userId = faker.string.uuid();
    const accountEmail = faker.internet.email().toLowerCase();
    const input = { name: "Default", type: "email", config: { addresses: [accountEmail] } };

    await request(server)
      .post("/v1/notification-channels/default")
      .set(accountHeaders(userId, accountEmail, false))
      .send({ data: input });
    const beforeRes = await request(server).get("/v1/notification-channels").set("x-user-id", userId);
    await request(server).post("/v1/notification-channels/default").set(accountHeaders(userId, accountEmail)).send({ data: input });
    const afterRes = await request(server).get("/v1/notification-channels").set("x-user-id", userId);

    expect(novu.trigger).not.toHaveBeenCalled();
    expect(beforeRes.body.data).toEqual([expect.objectContaining({ config: { addresses: [] }, pendingAddresses: [accountEmail] })]);
    expect(afterRes.body.data).toEqual([expect.objectContaining({ config: { addresses: [accountEmail] }, pendingAddresses: [] })]);

    await app.close();
  });

  it("keeps an address confirmed while an update of the channel's addresses was in flight", async () => {
    const { app, novu } = await setup();
    const server = app.getHttpServer();
    const userId = faker.string.uuid();
    const accountEmail = faker.internet.email().toLowerCase();
    const teammate = faker.internet.email().toLowerCase();
    const createRes = await request(server)
      .post("/v1/notification-channels")
      .set(accountHeaders(userId, accountEmail))
      .send({ data: { name: "Ops", type: "email", config: { addresses: [accountEmail, teammate] } } });
    const token = confirmationTokenEmailedTo(novu, teammate);
    const addressConfirmationService = app.get(AddressConfirmationService);
    const readPendingAddresses = addressConfirmationService.pendingAddressesOf.bind(addressConfirmationService);
    let confirmation: Promise<request.Response> | undefined;
    vi.spyOn(addressConfirmationService, "pendingAddressesOf").mockImplementationOnce(async (channelIds, tx) => {
      confirmation = request(server)
        .post("/internal/v1/address-confirmations")
        .send({ token })
        .then(response => response);
      await untilAQueryWaitsOnALock(app.get(DRIZZLE_PROVIDER_TOKEN));
      return readPendingAddresses(channelIds, tx);
    });

    const updateRes = await request(server)
      .patch(`/v1/notification-channels/${createRes.body.data.id}`)
      .set(accountHeaders(userId, accountEmail))
      .send({ data: { name: "Renamed", config: { addresses: [accountEmail, teammate] } } });
    const confirmRes = await confirmation;
    const getRes = await request(server).get(`/v1/notification-channels/${createRes.body.data.id}`).set("x-user-id", userId);

    expect(updateRes.status).toBe(200);
    expect(confirmRes?.status).toBe(204);
    expect(getRes.body.data).toMatchObject({ name: "Renamed", config: { addresses: [accountEmail, teammate] }, pendingAddresses: [] });

    await app.close();
  });

  it("emails a new confirmation link on request, which replaces the previous one", async () => {
    const { app, novu } = await setup();
    const server = app.getHttpServer();
    const userId = faker.string.uuid();
    const teammate = faker.internet.email().toLowerCase();

    const createRes = await request(server)
      .post("/v1/notification-channels")
      .set("x-user-id", userId)
      .send({ data: { name: "Ops", type: "email", config: { addresses: [teammate] } } });
    const firstToken = confirmationTokenEmailedTo(novu, teammate);
    const resendRes = await request(server)
      .post(`/v1/notification-channels/${createRes.body.data.id}/confirmation-emails`)
      .set("x-user-id", userId)
      .send({ data: { address: teammate } });
    const secondToken = confirmationTokenEmailedTo(novu, teammate);
    const staleRes = await request(server).post("/internal/v1/address-confirmations").send({ token: firstToken });
    const confirmRes = await request(server).post("/internal/v1/address-confirmations").send({ token: secondToken });

    expect(resendRes.status).toBe(204);
    expect(secondToken).not.toBe(firstToken);
    expect([staleRes.status, confirmRes.status]).toEqual([400, 204]);

    await app.close();
  });

  it("moves the default notification channel to the timezone it is given", async () => {
    const { app } = await setup();
    const server = app.getHttpServer();
    const userId = faker.string.uuid();
    const input = { name: "Default", type: "email", config: { addresses: [faker.internet.email()] } };

    await request(server).post("/v1/notification-channels/default").set("x-user-id", userId).send({ data: input });
    const res = await request(server)
      .post("/v1/notification-channels/default")
      .set("x-user-id", userId)
      .send({ data: { ...input, timezone: "Europe/Paris" } });
    const listRes = await request(server).get("/v1/notification-channels").set("x-user-id", userId);

    expect(res.status).toBe(204);
    expect(listRes.body).toMatchObject({
      data: [expect.objectContaining({ isDefault: true, timezone: "Europe/Paris" })],
      pagination: { total: 1 }
    });

    await app.close();
  });

  it.each(["Mars/Olympus", "+05:00"])("creates the default notification channel without a timezone when given %j, which names no zone", async timezone => {
    const { app } = await setup();
    const server = app.getHttpServer();
    const userId = faker.string.uuid();
    const input = { name: "Default", type: "email", config: { addresses: [faker.internet.email()] } };

    const res = await request(server)
      .post("/v1/notification-channels/default")
      .set("x-user-id", userId)
      .send({ data: { ...input, timezone } });
    const listRes = await request(server).get("/v1/notification-channels").set("x-user-id", userId);

    expect(res.status).toBe(204);
    expect(listRes.body.data).toEqual([expect.objectContaining({ isDefault: true, timezone: null })]);

    await app.close();
  });

  async function shouldCreate(app: INestApplication): Promise<NotificationChannelMeta> {
    const input = generateMock(notificationChannelCreateInputSchema);
    const userId = faker.string.uuid();
    const email = faker.internet.email();
    input.type = "email";
    input.config = { addresses: [email] };

    const res = await request(app.getHttpServer()).post("/v1/notification-channels").set(accountHeaders(userId, email)).send({ data: input });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      ...input,
      pendingAddresses: [],
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
    expect(res.body.data).toMatchObject({ config: { addresses: [] }, pendingAddresses: [newEmail.toLowerCase()] });
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
    novu: MockProxy<Novu>;
  }> {
    @Module({
      imports: [RestModule]
    })
    class TestModule {}

    vi.stubEnv("CONSOLE_WEB_URL", "https://console.example.com");
    const novu = mock<Novu>();
    const module: TestingModule = await Test.createTestingModule({
      imports: [TestModule]
    })
      .overrideProvider(Novu)
      .useValue(novu)
      .compile();

    const app = module.createNestApplication();
    app.enableVersioning();
    app.useGlobalFilters(new HttpExceptionFilter(await app.resolve(LoggerService)));

    await app.init();

    return { app, novu };
  }
});

function accountHeaders(userId: string, email: string, isVerified = true): Record<string, string> {
  return { "x-user-id": userId, "x-user-email": email, "x-user-email-verified": String(isVerified) };
}

function confirmationTokenEmailedTo(novu: MockProxy<Novu>, address: string): string {
  const [{ payload }] = novu.trigger.mock.calls.filter(([request]) => isEmailedTo(request.to, address)).at(-1)!;
  const content = String(payload?.content);

  return content.match(/confirm-address\?token=([A-Za-z0-9_-]+)/)![1];
}

function isEmailedTo(to: unknown, address: string): boolean {
  return typeof to === "object" && to !== null && "email" in to && to.email === address;
}
