import { generateMock } from "@anatine/zod-mock";
import { faker } from "@faker-js/faker";
import type { INestApplication } from "@nestjs/common";
import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { Ok } from "ts-results";
import { describe, expect, it, onTestFinished } from "vitest";
import type { MockProxy } from "vitest-mock-extended";

import { LoggerService } from "@src/common/services/logger/logger.service";
import { HttpExceptionFilter } from "@src/interfaces/rest/filters/http-exception/http-exception.filter";
import { HttpResultInterceptor } from "@src/interfaces/rest/interceptors/http-result/http-result.interceptor";
import { AuthService } from "@src/interfaces/rest/services/auth/auth.service";
import { AlertRepository } from "@src/modules/alert/repositories/alert/alert.repository";
import {
  type DefaultChannelOwner,
  NotificationChannelRepository
} from "@src/modules/notifications/repositories/notification-channel/notification-channel.repository";
import {
  MAX_NOTIFICATION_CHANNEL_ADDRESSES,
  NotificationChannelController,
  notificationChannelCreateInputSchema,
  notificationChannelOutputSchema,
  notificationChannelPatchInputSchema
} from "./notification-channel.controller";

import { MockProvider } from "@test/mocks/provider.mock";

describe(NotificationChannelController.name, () => {
  describe("createNotificationChannel", () => {
    it("should call notificationChannelRepository.create() and return the created notification channel", async () => {
      const { controller, notificationChannelRepository, userId, organizationId } = await setup();
      const input = generateMock(notificationChannelCreateInputSchema);
      const output = { ...generateMock(notificationChannelOutputSchema), organizationId: null };

      notificationChannelRepository.create.mockResolvedValue(output);

      const result = await controller.createNotificationChannel({ data: input });

      expect(notificationChannelRepository.create).toHaveBeenCalledWith({
        ...input,
        userId,
        organizationId
      });
      expect(result).toEqual(Ok({ data: output }));
    });

    it("creates a channel with as many addresses as the limit", async () => {
      const { app, notificationChannelRepository } = await setup();
      notificationChannelRepository.create.mockResolvedValue({ ...generateMock(notificationChannelOutputSchema), organizationId: null });

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
    it("should call notificationChannelRepository.updateById() and return the updated notification channel", async () => {
      const { controller, notificationChannelRepository } = await setup();
      const id = faker.string.uuid();
      const input = generateMock(notificationChannelPatchInputSchema);
      const output = { ...generateMock(notificationChannelOutputSchema), organizationId: null };

      notificationChannelRepository.updateById.mockResolvedValue(output);

      const result = await controller.updateNotificationChannel(id, { data: input });

      expect(notificationChannelRepository.updateById).toHaveBeenCalledWith(id, input);
      expect(result).toEqual(Ok({ data: output }));
    });

    it("should return an error if notification channel is not found", async () => {
      const { controller, notificationChannelRepository } = await setup();
      const id = faker.string.uuid();
      const input = generateMock(notificationChannelPatchInputSchema);

      notificationChannelRepository.updateById.mockResolvedValue(undefined);

      await expect(controller.updateNotificationChannel(id, { data: input })).resolves.toMatchObject({
        err: true,
        val: expect.objectContaining({
          message: "Notification channel not found"
        })
      });
      expect(notificationChannelRepository.updateById).toHaveBeenCalledWith(id, input);
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

    it("updates a channel to as many addresses as the limit without reading it first", async () => {
      const { controller, notificationChannelRepository } = await setup();
      const id = faker.string.uuid();
      const data = { config: { addresses: emails(MAX_NOTIFICATION_CHANNEL_ADDRESSES) } };
      notificationChannelRepository.updateById.mockResolvedValue({ ...generateMock(notificationChannelOutputSchema), organizationId: null });

      await controller.updateNotificationChannel(id, { data });

      expect(notificationChannelRepository.findById).not.toHaveBeenCalled();
      expect(notificationChannelRepository.updateById).toHaveBeenCalledWith(id, data);
    });

    it("answers 400 without updating a channel when the update adds an address past the limit", async () => {
      const { app, notificationChannelRepository } = await setup();
      const id = faker.string.uuid();
      const addresses = emails(MAX_NOTIFICATION_CHANNEL_ADDRESSES);
      notificationChannelRepository.findById.mockResolvedValue(channelWith(id, addresses));

      const res = await request(app.getHttpServer())
        .patch(`/v1/notification-channels/${id}`)
        .send({ data: { config: { addresses: [...addresses, "new@example.com"] } } });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("A notification channel can have at most 10 email addresses");
      expect(notificationChannelRepository.updateById).not.toHaveBeenCalled();
    });

    it("lets a channel already over the limit keep or drop its addresses, whatever their case", async () => {
      const { controller, notificationChannelRepository } = await setup();
      const id = faker.string.uuid();
      const addresses = emails(MAX_NOTIFICATION_CHANNEL_ADDRESSES + 2);
      const data = { name: "Renamed", config: { addresses: addresses.slice(1).map(address => address.toUpperCase()) } };
      notificationChannelRepository.findById.mockResolvedValue(channelWith(id, addresses));
      notificationChannelRepository.updateById.mockResolvedValue(channelWith(id, data.config.addresses));

      const result = await controller.updateNotificationChannel(id, { data });

      expect(result.ok).toBe(true);
      expect(notificationChannelRepository.updateById).toHaveBeenCalledWith(id, data);
    });

    it("answers 404 without updating when a channel to update past the limit does not exist", async () => {
      const { app, notificationChannelRepository } = await setup();
      notificationChannelRepository.findById.mockResolvedValue(undefined);

      const res = await request(app.getHttpServer())
        .patch(`/v1/notification-channels/${faker.string.uuid()}`)
        .send({ data: { config: { addresses: emails(MAX_NOTIFICATION_CHANNEL_ADDRESSES + 1) } } });

      expect(res.status).toBe(404);
      expect(notificationChannelRepository.updateById).not.toHaveBeenCalled();
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
      expect(result).toEqual(Ok({ data: output }));
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
      expect(result).toEqual(Ok({ data: output }));
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
    it("creates the default channel of the request's owner, stamped with its organization", async () => {
      const { controller, notificationChannelRepository, userId, organizationId, defaultChannelOwner } = await setup();
      const { isDefault, ...input } = generateMock(notificationChannelCreateInputSchema);

      await controller.createDefaultNotificationChannel({ data: input });

      expect(notificationChannelRepository.createDefaultChannel).toHaveBeenCalledWith({ ...input, userId, organizationId }, defaultChannelOwner);
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

    it("lists channels with the page and limit it is given", async () => {
      const { app, notificationChannelRepository } = await setup();
      notificationChannelRepository.paginate.mockResolvedValue({
        data: [],
        pagination: { page: 2, limit: 10, total: 0, totalPages: 0, hasNextPage: false, hasPreviousPage: true }
      });

      const res = await request(app.getHttpServer()).get("/v1/notification-channels?page=2&limit=10");

      expect(res.status).toBe(200);
      expect(notificationChannelRepository.paginate).toHaveBeenCalledWith({ page: 2, limit: 10 });
    });
  });

  async function setup(): Promise<{
    controller: NotificationChannelController;
    app: INestApplication;
    notificationChannelRepository: MockProxy<NotificationChannelRepository>;
    alertRepository: MockProxy<AlertRepository>;
    userId: string;
    organizationId: string;
    defaultChannelOwner: DefaultChannelOwner;
  }> {
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
            defaultChannelOwner
          }
        },
        MockProvider(NotificationChannelRepository),
        MockProvider(AlertRepository),
        MockProvider(LoggerService)
      ]
    }).compile();

    const notificationChannelRepository = module.get<MockProxy<NotificationChannelRepository>>(NotificationChannelRepository);
    notificationChannelRepository.accessibleBy.mockReturnValue(notificationChannelRepository);

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
      userId,
      organizationId,
      defaultChannelOwner
    };
  }
});

function emails(count: number): string[] {
  return Array.from({ length: count }, (_, index) => `member${index}@example.com`);
}

function channelWith(id: string, addresses: string[]) {
  return { ...generateMock(notificationChannelOutputSchema), id, organizationId: null, config: { addresses } };
}
