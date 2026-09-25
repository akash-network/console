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
import { NotificationChannelRepository } from "@src/modules/notifications/repositories/notification-channel/notification-channel.repository";
import {
  NotificationChannelController,
  notificationChannelCreateInputSchema,
  notificationChannelOutputSchema,
  notificationChannelPatchInputSchema
} from "./notification-channel.controller";

import { MockProvider } from "@test/mocks/provider.mock";

describe(NotificationChannelController.name, () => {
  describe("createNotificationChannel", () => {
    it("should call notificationChannelRepository.create() and return the created notification channel", async () => {
      const { controller, notificationChannelRepository, userId } = await setup();
      const input = generateMock(notificationChannelCreateInputSchema);
      const output = generateMock(notificationChannelOutputSchema);

      notificationChannelRepository.create.mockResolvedValue(output);

      const result = await controller.createNotificationChannel({ data: input });

      expect(notificationChannelRepository.create).toHaveBeenCalledWith({
        ...input,
        userId
      });
      expect(result).toEqual(Ok({ data: output }));
    });
  });

  describe("updateNotificationChannel", () => {
    it("should call notificationChannelRepository.updateById() and return the updated notification channel", async () => {
      const { controller, notificationChannelRepository } = await setup();
      const id = faker.string.uuid();
      const input = generateMock(notificationChannelPatchInputSchema);
      const output = generateMock(notificationChannelOutputSchema);

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
  });

  describe("getNotificationChannel", () => {
    it("should call notificationChannelRepository.findById() and return the notification channel", async () => {
      const { controller, notificationChannelRepository } = await setup();
      const id = faker.string.uuid();
      const output = generateMock(notificationChannelOutputSchema);

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
      const output = generateMock(notificationChannelOutputSchema);

      alertRepository.countActiveByNotificationChannelId.mockResolvedValue(0);
      notificationChannelRepository.deleteSafelyById.mockResolvedValue(output);

      const result = await controller.deleteNotificationChannel(id);

      expect(notificationChannelRepository.deleteSafelyById).toHaveBeenCalledWith(id);
      expect(result).toEqual(Ok({ data: output }));
    });

    it("should return an error if notification channel is not found", async () => {
      const { controller, notificationChannelRepository } = await setup();
      const id = faker.string.uuid();

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

    it("deletes the notification channel by a uuid id and answers 404 when none matches", async () => {
      const { app, notificationChannelRepository, alertRepository } = await setup();
      const id = faker.string.uuid();
      alertRepository.countActiveByNotificationChannelId.mockResolvedValue(0);

      const res = await request(app.getHttpServer()).delete(`/v1/notification-channels/${id}`);

      expect(res.status).toBe(404);
      expect(alertRepository.countActiveByNotificationChannelId).toHaveBeenCalledWith(id);
      expect(notificationChannelRepository.deleteSafelyById).toHaveBeenCalledWith(id);
    });
  });

  describe("createDefaultNotificationChannel", () => {
    it("should call notificationChannelRepository.createDefaultChannel()", async () => {
      const { controller, notificationChannelRepository, userId } = await setup();
      const input = generateMock(notificationChannelCreateInputSchema);

      await controller.createDefaultNotificationChannel({ data: input });

      expect(notificationChannelRepository.createDefaultChannel).toHaveBeenCalledWith({
        ...input,
        userId
      });
    });
  });

  async function setup(): Promise<{
    controller: NotificationChannelController;
    app: INestApplication;
    notificationChannelRepository: MockProxy<NotificationChannelRepository>;
    alertRepository: MockProxy<AlertRepository>;
    userId: string;
  }> {
    const userId = faker.string.uuid();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationChannelController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            userId
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
      userId
    };
  }
});
