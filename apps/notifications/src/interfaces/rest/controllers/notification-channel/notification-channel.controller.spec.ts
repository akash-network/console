import { generateMock } from "@anatine/zod-mock";
import { faker } from "@faker-js/faker";
import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import request from "supertest";
import { Err, Ok } from "ts-results";
import { describe, expect, it, onTestFinished } from "vitest";
import { mock, type MockProxy } from "vitest-mock-extended";

import { LoggerService } from "@src/common/services/logger/logger.service";
import { HttpExceptionFilter } from "@src/interfaces/rest/filters/http-exception/http-exception.filter";
import { HttpResultInterceptor } from "@src/interfaces/rest/interceptors/http-result/http-result.interceptor";
import { AuthService } from "@src/interfaces/rest/services/auth/auth.service";
import { AlertRepository } from "@src/modules/alert/repositories/alert/alert.repository";
import type * as schema from "@src/modules/notifications/model-schemas";
import {
  type DefaultChannelOwner,
  NotificationChannelRepository
} from "@src/modules/notifications/repositories/notification-channel/notification-channel.repository";
import { type AccountEmail, AddressConfirmationService } from "@src/modules/notifications/services/address-confirmation/address-confirmation.service";
import { MAX_NOTIFICATION_CHANNEL_ADDRESSES, NotificationChannelController, notificationChannelOutputSchema } from "./notification-channel.controller";

import { MockProvider } from "@test/mocks/provider.mock";

describe(NotificationChannelController.name, () => {
  describe("createNotificationChannel", () => {
    it("creates the channel with the requester's verified email confirmed and every other address waiting for confirmation", async () => {
      const { controller, notificationChannelRepository, addressConfirmationService, userId, organizationId } = await setup({
        accountEmail: { address: "Owner@Example.com", isVerified: true }
      });
      const output = channelWith(faker.string.uuid(), ["owner@example.com"]);
      notificationChannelRepository.create.mockResolvedValue(output);

      const result = await controller.createNotificationChannel({
        data: { name: "Ops", type: "email", config: { addresses: ["owner@example.com", "Teammate@Example.com"] } }
      });

      expect(notificationChannelRepository.create).toHaveBeenCalledWith({
        name: "Ops",
        type: "email",
        config: { addresses: ["owner@example.com"] },
        isDefault: false,
        userId,
        organizationId
      });
      expect(addressConfirmationService.requestConfirmations).toHaveBeenCalledWith(output, ["teammate@example.com"], {
        userId,
        accountEmail: { address: "Owner@Example.com", isVerified: true }
      });
      expect(result).toEqual(Ok({ data: { ...output, pendingAddresses: ["teammate@example.com"] } }));
    });

    it("keeps the default flag it is given", async () => {
      const { controller, notificationChannelRepository } = await setup();
      notificationChannelRepository.create.mockResolvedValue(channelWith(faker.string.uuid(), []));

      await controller.createNotificationChannel({ data: { name: "Ops", type: "email", config: { addresses: [] }, isDefault: true } });

      expect(notificationChannelRepository.create).toHaveBeenCalledWith(expect.objectContaining({ isDefault: true }));
    });

    it("creates a channel with as many addresses as the limit", async () => {
      const { app, notificationChannelRepository } = await setup();
      notificationChannelRepository.create.mockResolvedValue(channelWith(faker.string.uuid(), []));

      const res = await request(app.getHttpServer())
        .post("/v1/notification-channels")
        .send({ data: { name: "Ops", type: "email", config: { addresses: emails(MAX_NOTIFICATION_CHANNEL_ADDRESSES) } } });

      expect(res.status).toBe(201);
      expect(notificationChannelRepository.create).toHaveBeenCalled();
    });

    it("answers 400 without creating a channel with more addresses than the limit", async () => {
      const { app, notificationChannelRepository } = await setup();

      const res = await request(app.getHttpServer())
        .post("/v1/notification-channels")
        .send({ data: { name: "Ops", type: "email", config: { addresses: emails(MAX_NOTIFICATION_CHANNEL_ADDRESSES + 1) } } });

      expect(res.status).toBe(400);
      expect(res.body.errors.issues).toContainEqual(
        expect.objectContaining({ path: ["data", "config", "addresses"], message: "A notification channel can have at most 10 email addresses" })
      );
      expect(notificationChannelRepository.create).not.toHaveBeenCalled();
    });
  });

  describe("updateNotificationChannel", () => {
    it("renames a channel without reading or touching its addresses", async () => {
      const { controller, notificationChannelRepository, addressConfirmationService } = await setup();
      const id = faker.string.uuid();
      const output = channelWith(id, ["ops@example.com"]);
      notificationChannelRepository.updateById.mockResolvedValue(output);

      const result = await controller.updateNotificationChannel(id, { data: { name: "Renamed" } });

      expect(notificationChannelRepository.findById).not.toHaveBeenCalled();
      expect(notificationChannelRepository.updateById).toHaveBeenCalledWith(id, { name: "Renamed" });
      expect(addressConfirmationService.holdForConfirmation).not.toHaveBeenCalled();
      expect(result).toEqual(Ok({ data: { ...output, pendingAddresses: [] } }));
    });

    it("keeps confirmed addresses, holds new ones for confirmation, and forgets pending ones it drops, all under the channel's lock", async () => {
      const { controller, notificationChannelRepository, addressConfirmationService, userId, tx } = await setup({
        pendingAddresses: ["dropped@example.com", "waiting@example.com"]
      });
      const id = faker.string.uuid();
      const updated = channelWith(id, ["kept@example.com"]);
      notificationChannelRepository.findById.mockResolvedValue(channelWith(id, ["kept@example.com", "removed@example.com"]));
      notificationChannelRepository.updateById.mockResolvedValue(updated);

      const result = await controller.updateNotificationChannel(id, {
        data: { config: { addresses: ["Kept@Example.com", "waiting@example.com", "new@example.com"] } }
      });

      expect(notificationChannelRepository.updateLocked).toHaveBeenCalledWith(id, expect.any(Function));
      expect(addressConfirmationService.pendingAddressesOf).toHaveBeenCalledWith([id], tx);
      expect(notificationChannelRepository.updateById).toHaveBeenCalledWith(id, { config: { addresses: ["Kept@Example.com"] } }, tx);
      expect(addressConfirmationService.forget).toHaveBeenCalledWith(id, ["dropped@example.com"], tx);
      expect(addressConfirmationService.holdForConfirmation).toHaveBeenCalledWith(id, ["new@example.com"], tx);
      expect(addressConfirmationService.emailConfirmations).toHaveBeenCalledWith(updated, [{ address: "new@example.com", token: "token-new@example.com" }], {
        userId,
        accountEmail: null
      });
      expect(result).toEqual(Ok({ data: { ...updated, pendingAddresses: ["waiting@example.com", "new@example.com"] } }));
    });

    it("answers 404 without updating a channel whose addresses it cannot find", async () => {
      const { controller, notificationChannelRepository, addressConfirmationService } = await setup();
      notificationChannelRepository.findById.mockResolvedValue(undefined);

      const result = await controller.updateNotificationChannel(faker.string.uuid(), { data: { config: { addresses: ["ops@example.com"] } } });

      expect(result).toMatchObject({ err: true, val: expect.objectContaining({ message: "Notification channel not found" }) });
      expect(notificationChannelRepository.updateById).not.toHaveBeenCalled();
      expect(addressConfirmationService.emailConfirmations).not.toHaveBeenCalled();
    });

    it("answers 404 without asking for confirmations when the channel is gone by the time it updates", async () => {
      const { controller, notificationChannelRepository, addressConfirmationService } = await setup();
      const id = faker.string.uuid();
      notificationChannelRepository.findById.mockResolvedValue(channelWith(id, []));
      notificationChannelRepository.updateById.mockResolvedValue(undefined);

      const result = await controller.updateNotificationChannel(id, { data: { config: { addresses: ["ops@example.com"] } } });

      expect(result).toMatchObject({ err: true, val: expect.objectContaining({ message: "Notification channel not found" }) });
      expect(addressConfirmationService.forget).not.toHaveBeenCalled();
      expect(addressConfirmationService.holdForConfirmation).not.toHaveBeenCalled();
      expect(addressConfirmationService.emailConfirmations).not.toHaveBeenCalled();
    });

    it("answers 400 without updating the notification channel when the id is not a uuid", async () => {
      const { app, notificationChannelRepository } = await setup();

      const res = await request(app.getHttpServer())
        .patch("/v1/notification-channels/..%2fhealth")
        .send({ data: { name: "renamed channel" } });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Validation failed (uuid is expected)");
      expect(notificationChannelRepository.updateById).not.toHaveBeenCalled();
    });

    it("updates the notification channel by a uuid id and answers 404 when none matches", async () => {
      const { app, notificationChannelRepository } = await setup();
      const id = faker.string.uuid();

      const res = await request(app.getHttpServer())
        .patch(`/v1/notification-channels/${id}`)
        .send({ data: { name: "renamed channel" } });

      expect(res.status).toBe(404);
      expect(notificationChannelRepository.updateById).toHaveBeenCalledWith(id, { name: "renamed channel" });
    });

    it.each([{ data: {} }, { data: { unknownField: "value" } }])(
      "answers 400 without updating the notification channel when %j changes no field",
      async body => {
        const { app, notificationChannelRepository } = await setup();

        const res = await request(app.getHttpServer()).patch(`/v1/notification-channels/${faker.string.uuid()}`).send(body);

        expect(res.status).toBe(400);
        expect(res.body).toMatchObject({
          message: "Validation failed",
          errors: { issues: [expect.objectContaining({ path: ["data"], message: "Provide at least one field to update" })] }
        });
        expect(notificationChannelRepository.updateById).not.toHaveBeenCalled();
      }
    );

    it("updates a channel to as many addresses as the limit", async () => {
      const { controller, notificationChannelRepository } = await setup();
      const id = faker.string.uuid();
      const addresses = emails(MAX_NOTIFICATION_CHANNEL_ADDRESSES);
      notificationChannelRepository.findById.mockResolvedValue(channelWith(id, addresses.slice(1)));
      notificationChannelRepository.updateById.mockResolvedValue(channelWith(id, addresses.slice(1)));

      const result = await controller.updateNotificationChannel(id, { data: { config: { addresses } } });

      expect(result.ok).toBe(true);
    });

    it("answers 400 without updating a channel when the update adds an address past the limit, counting the pending ones", async () => {
      const { app, notificationChannelRepository } = await setup({ pendingAddresses: ["member9@example.com"] });
      const id = faker.string.uuid();
      const addresses = emails(MAX_NOTIFICATION_CHANNEL_ADDRESSES);
      notificationChannelRepository.findById.mockResolvedValue(channelWith(id, addresses.slice(0, 9)));

      const res = await request(app.getHttpServer())
        .patch(`/v1/notification-channels/${id}`)
        .send({ data: { config: { addresses: [...addresses, "new@example.com"] } } });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("A notification channel can have at most 10 email addresses");
      expect(notificationChannelRepository.updateById).not.toHaveBeenCalled();
    });

    it("lets a channel already over the limit keep or drop its addresses, whatever their case", async () => {
      const { controller, notificationChannelRepository, tx } = await setup();
      const id = faker.string.uuid();
      const addresses = emails(MAX_NOTIFICATION_CHANNEL_ADDRESSES + 2);
      const data = { name: "Renamed", config: { addresses: addresses.slice(1).map(address => address.toUpperCase()) } };
      notificationChannelRepository.findById.mockResolvedValue(channelWith(id, addresses));
      notificationChannelRepository.updateById.mockResolvedValue(channelWith(id, data.config.addresses));

      const result = await controller.updateNotificationChannel(id, { data });

      expect(result.ok).toBe(true);
      expect(notificationChannelRepository.updateById).toHaveBeenCalledWith(id, data, tx);
    });

    it("counts an address listed in two spellings once against the limit and stores it once", async () => {
      const { controller, notificationChannelRepository, addressConfirmationService, tx } = await setup();
      const id = faker.string.uuid();
      const addresses = emails(MAX_NOTIFICATION_CHANNEL_ADDRESSES - 1);
      notificationChannelRepository.findById.mockResolvedValue(channelWith(id, addresses));
      notificationChannelRepository.updateById.mockResolvedValue(channelWith(id, addresses));

      const result = await controller.updateNotificationChannel(id, {
        data: { config: { addresses: [...addresses, addresses[0].toUpperCase(), "new@example.com", "NEW@example.com"] } }
      });

      expect(result.ok).toBe(true);
      expect(notificationChannelRepository.updateById).toHaveBeenCalledWith(id, { config: { addresses } }, tx);
      expect(addressConfirmationService.holdForConfirmation).toHaveBeenCalledWith(id, ["new@example.com"], tx);
    });
  });

  describe("createNotificationChannelConfirmationEmail", () => {
    it("emails a new confirmation link to an address waiting on the channel", async () => {
      const { app, notificationChannelRepository, addressConfirmationService, userId } = await setup();
      const channel = channelWith(faker.string.uuid(), []);
      notificationChannelRepository.findById.mockResolvedValue(channel);
      addressConfirmationService.resend.mockResolvedValue(Ok(undefined));

      const res = await request(app.getHttpServer())
        .post(`/v1/notification-channels/${channel.id}/confirmation-emails`)
        .send({ data: { address: "teammate@example.com" } });

      expect(res.status).toBe(204);
      expect(notificationChannelRepository.accessibleBy).toHaveBeenCalledWith(undefined, "update");
      expect(addressConfirmationService.resend).toHaveBeenCalledWith(channel, "teammate@example.com", { userId, accountEmail: null });
    });

    it.each([
      { error: "RATE_LIMITED" as const, status: 429, message: "Too many confirmation emails were sent. Try again tomorrow." },
      { error: "NOT_PENDING" as const, status: 404, message: "The address doesn't wait for confirmation on this channel" }
    ])("answers $status when the resend is refused as $error", async ({ error, status, message }) => {
      const { app, notificationChannelRepository, addressConfirmationService } = await setup();
      const channel = channelWith(faker.string.uuid(), []);
      notificationChannelRepository.findById.mockResolvedValue(channel);
      addressConfirmationService.resend.mockResolvedValue(Err(error));

      const res = await request(app.getHttpServer())
        .post(`/v1/notification-channels/${channel.id}/confirmation-emails`)
        .send({ data: { address: "teammate@example.com" } });

      expect(res.status).toBe(status);
      expect(res.body.message).toBe(message);
    });

    it("answers 404 without emailing for a channel the caller cannot update", async () => {
      const { app, notificationChannelRepository, addressConfirmationService } = await setup();
      notificationChannelRepository.findById.mockResolvedValue(undefined);

      const res = await request(app.getHttpServer())
        .post(`/v1/notification-channels/${faker.string.uuid()}/confirmation-emails`)
        .send({ data: { address: "teammate@example.com" } });

      expect(res.status).toBe(404);
      expect(res.body.message).toBe("Notification channel not found");
      expect(addressConfirmationService.resend).not.toHaveBeenCalled();
    });
  });

  describe("getNotificationChannel", () => {
    it("should call notificationChannelRepository.findById() and return the notification channel", async () => {
      const { controller, notificationChannelRepository } = await setup();
      const id = faker.string.uuid();
      const output = { ...generateMock(notificationChannelOutputSchema), organizationId: null };

      notificationChannelRepository.findById.mockResolvedValue(output);

      const result = await controller.getNotificationChannel(id);

      expect(notificationChannelRepository.findById).toHaveBeenCalledWith(id);
      expect(result).toEqual(Ok({ data: { ...output, pendingAddresses: [] } }));
    });

    it("should return an error if notification channel is not found", async () => {
      const { controller, notificationChannelRepository } = await setup();
      const id = faker.string.uuid();

      notificationChannelRepository.findById.mockResolvedValue(undefined);

      await expect(controller.getNotificationChannel(id)).resolves.toMatchObject({
        err: true,
        val: expect.objectContaining({
          message: "Notification channel not found"
        })
      });
      expect(notificationChannelRepository.findById).toHaveBeenCalledWith(id);
    });

    it("answers 400 without reading the notification channel when the id is not a uuid", async () => {
      const { app, notificationChannelRepository } = await setup();

      const res = await request(app.getHttpServer()).get("/v1/notification-channels/..%2fhealth");

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Validation failed (uuid is expected)");
      expect(notificationChannelRepository.findById).not.toHaveBeenCalled();
    });

    it("reads the notification channel by a uuid id and answers 404 when none matches", async () => {
      const { app, notificationChannelRepository } = await setup();
      const id = faker.string.uuid();

      const res = await request(app.getHttpServer()).get(`/v1/notification-channels/${id}`);

      expect(res.status).toBe(404);
      expect(notificationChannelRepository.findById).toHaveBeenCalledWith(id);
    });
  });

  describe("deleteNotificationChannel", () => {
    it("should call notificationChannelRepository.deleteSafelyById() and return the deleted notification channel", async () => {
      const { controller, notificationChannelRepository, alertRepository } = await setup();
      const id = faker.string.uuid();
      const output = { ...generateMock(notificationChannelOutputSchema), organizationId: null };

      notificationChannelRepository.findById.mockResolvedValue(output);
      alertRepository.countActiveByNotificationChannelId.mockResolvedValue(0);
      notificationChannelRepository.deleteSafelyById.mockResolvedValue(output);

      const result = await controller.deleteNotificationChannel(id);

      expect(notificationChannelRepository.accessibleBy).toHaveBeenCalledWith(undefined, "delete");
      expect(notificationChannelRepository.deleteSafelyById).toHaveBeenCalledWith(id);
      expect(result).toEqual(Ok({ data: { ...output, pendingAddresses: [] } }));
    });

    it("answers not found without counting its alerts or deleting it when the caller cannot delete the notification channel", async () => {
      const { controller, notificationChannelRepository, alertRepository } = await setup();
      const id = faker.string.uuid();

      notificationChannelRepository.findById.mockResolvedValue(undefined);
      alertRepository.countActiveByNotificationChannelId.mockResolvedValue(1);

      await expect(controller.deleteNotificationChannel(id)).resolves.toMatchObject({
        err: true,
        val: expect.objectContaining({
          message: "Notification channel not found"
        })
      });
      expect(notificationChannelRepository.findById).toHaveBeenCalledWith(id);
      expect(alertRepository.countActiveByNotificationChannelId).not.toHaveBeenCalled();
      expect(notificationChannelRepository.deleteSafelyById).not.toHaveBeenCalled();
    });

    it("should return an error if notification channel is not found", async () => {
      const { controller, notificationChannelRepository, alertRepository } = await setup();
      const id = faker.string.uuid();

      notificationChannelRepository.findById.mockResolvedValue({ ...generateMock(notificationChannelOutputSchema), organizationId: null });
      alertRepository.countActiveByNotificationChannelId.mockResolvedValue(0);
      notificationChannelRepository.deleteSafelyById.mockResolvedValue(undefined);

      await expect(controller.deleteNotificationChannel(id)).resolves.toMatchObject({
        err: true,
        val: expect.objectContaining({
          message: "Notification channel not found"
        })
      });
      expect(notificationChannelRepository.deleteSafelyById).toHaveBeenCalledWith(id);
    });

    it("should return an error if the notification channel is in use", async () => {
      const { controller, notificationChannelRepository, alertRepository } = await setup();
      const id = faker.string.uuid();

      notificationChannelRepository.findById.mockResolvedValue({ ...generateMock(notificationChannelOutputSchema), organizationId: null });
      alertRepository.countActiveByNotificationChannelId.mockResolvedValue(1);

      await expect(controller.deleteNotificationChannel(id)).resolves.toMatchObject({
        err: true,
        val: expect.objectContaining({
          message: "Cannot delete notification channel with alerts"
        })
      });
      expect(notificationChannelRepository.deleteSafelyById).not.toHaveBeenCalled();
    });

    it("answers 400 without counting its alerts or deleting the notification channel when the id is not a uuid", async () => {
      const { app, notificationChannelRepository, alertRepository } = await setup();

      const res = await request(app.getHttpServer()).delete("/v1/notification-channels/..%2fhealth");

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Validation failed (uuid is expected)");
      expect(alertRepository.countActiveByNotificationChannelId).not.toHaveBeenCalled();
      expect(notificationChannelRepository.deleteSafelyById).not.toHaveBeenCalled();
    });

    it("looks the notification channel up by a uuid id and answers 404 when none matches", async () => {
      const { app, notificationChannelRepository, alertRepository } = await setup();
      const id = faker.string.uuid();
      notificationChannelRepository.findById.mockResolvedValue(undefined);

      const res = await request(app.getHttpServer()).delete(`/v1/notification-channels/${id}`);

      expect(res.status).toBe(404);
      expect(notificationChannelRepository.findById).toHaveBeenCalledWith(id);
      expect(alertRepository.countActiveByNotificationChannelId).not.toHaveBeenCalled();
    });
  });

  describe("createDefaultNotificationChannel", () => {
    it("creates the default channel of the request's owner, stamped with its organization, with its addresses waiting for confirmation", async () => {
      const { controller, notificationChannelRepository, addressConfirmationService, userId, organizationId, defaultChannelOwner } = await setup();
      const created = channelWith(faker.string.uuid(), []);
      notificationChannelRepository.createDefaultChannel.mockResolvedValue(created);

      await controller.createDefaultNotificationChannel({ data: { name: "Default", type: "email", config: { addresses: ["Owner@Example.com"] } } });

      expect(notificationChannelRepository.createDefaultChannel).toHaveBeenCalledWith(
        { name: "Default", type: "email", config: { addresses: [] }, userId, organizationId },
        defaultChannelOwner
      );
      expect(addressConfirmationService.requestConfirmations).toHaveBeenCalledWith(created, ["owner@example.com"], { userId, accountEmail: null });
    });

    it("confirms the requester's verified email on their channels, whether or not it creates the default one", async () => {
      const accountEmail = { address: "owner@example.com", isVerified: true };
      const { controller, notificationChannelRepository, addressConfirmationService, userId } = await setup({ accountEmail });
      notificationChannelRepository.createDefaultChannel.mockResolvedValue(undefined);

      await controller.createDefaultNotificationChannel({ data: { name: "Default", type: "email", config: { addresses: ["owner@example.com"] } } });

      expect(notificationChannelRepository.createDefaultChannel).toHaveBeenCalledWith(
        expect.objectContaining({ config: { addresses: ["owner@example.com"] } }),
        expect.anything()
      );
      expect(addressConfirmationService.requestConfirmations).not.toHaveBeenCalled();
      expect(addressConfirmationService.confirmVerifiedEmail).toHaveBeenCalledWith(userId, accountEmail);
    });

    it("answers 400 without creating a default channel with more addresses than the limit", async () => {
      const { app, notificationChannelRepository } = await setup();

      const res = await request(app.getHttpServer())
        .post("/v1/notification-channels/default")
        .send({ data: { name: "Default", type: "email", config: { addresses: emails(MAX_NOTIFICATION_CHANNEL_ADDRESSES + 1) } } });

      expect(res.status).toBe(400);
      expect(notificationChannelRepository.createDefaultChannel).not.toHaveBeenCalled();
    });
  });

  describe("listNotificationChannels", () => {
    it.each(["page=-1", "limit=1001"])("answers 400 without listing channels when given %s", async paging => {
      const { app, notificationChannelRepository } = await setup();

      const res = await request(app.getHttpServer()).get(`/v1/notification-channels?${paging}`);

      expect(res.status).toBe(400);
      expect(notificationChannelRepository.paginate).not.toHaveBeenCalled();
    });

    it("lists channels with the page and limit it is given, each with the addresses waiting for confirmation on it", async () => {
      const { app, notificationChannelRepository } = await setup({ pendingAddresses: ["teammate@example.com"] });
      const channel = channelWith(faker.string.uuid(), ["owner@example.com"]);
      notificationChannelRepository.paginate.mockResolvedValue({
        data: [channel],
        pagination: { page: 2, limit: 10, total: 11, totalPages: 2, hasNextPage: false, hasPreviousPage: true }
      });

      const res = await request(app.getHttpServer()).get("/v1/notification-channels?page=2&limit=10");

      expect(res.status).toBe(200);
      expect(notificationChannelRepository.paginate).toHaveBeenCalledWith({ page: 2, limit: 10 });
      expect(res.body.data).toEqual([
        expect.objectContaining({ id: channel.id, config: { addresses: ["owner@example.com"] }, pendingAddresses: ["teammate@example.com"] })
      ]);
    });
  });

  async function setup(input: { accountEmail?: AccountEmail; pendingAddresses?: string[] } = {}) {
    const userId = faker.string.uuid();
    const organizationId = faker.string.uuid();
    const defaultChannelOwner: DefaultChannelOwner = { kind: "user", userId, organizationId };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationChannelController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            userId,
            organizationId,
            defaultChannelOwner,
            accountEmail: input.accountEmail ?? null
          }
        },
        MockProvider(NotificationChannelRepository),
        MockProvider(AlertRepository),
        MockProvider(AddressConfirmationService),
        MockProvider(LoggerService)
      ]
    }).compile();

    const notificationChannelRepository = module.get<MockProxy<NotificationChannelRepository>>(NotificationChannelRepository);
    notificationChannelRepository.accessibleBy.mockReturnValue(notificationChannelRepository);
    const addressConfirmationService = module.get<MockProxy<AddressConfirmationService>>(AddressConfirmationService);
    addressConfirmationService.pendingAddressesOf.mockImplementation(async ids => new Map(ids.map(id => [id, input.pendingAddresses ?? []])));
    addressConfirmationService.holdForConfirmation.mockImplementation(async (_, addresses) =>
      addresses.map(address => ({ address, token: `token-${address}` }))
    );
    const tx = mock<NodePgDatabase<typeof schema>>();
    notificationChannelRepository.updateLocked.mockImplementation(async (id, change) => {
      const channel = await notificationChannelRepository.findById(id);

      return channel && (await change(channel, tx));
    });

    const app = module.createNestApplication();
    app.enableVersioning();
    app.useGlobalInterceptors(new HttpResultInterceptor());
    app.useGlobalFilters(new HttpExceptionFilter(module.get(LoggerService)));
    await app.init();
    onTestFinished(() => app.close());

    return {
      controller: module.get(NotificationChannelController),
      app,
      notificationChannelRepository,
      alertRepository: module.get<MockProxy<AlertRepository>>(AlertRepository),
      addressConfirmationService,
      userId,
      organizationId,
      defaultChannelOwner,
      tx
    };
  }
});

function emails(count: number): string[] {
  return Array.from({ length: count }, (_, index) => `member${index}@example.com`);
}

function channelWith(id: string, addresses: string[]) {
  const { pendingAddresses, ...channel } = generateMock(notificationChannelOutputSchema);

  return { ...channel, id, organizationId: null, config: { addresses } };
}
