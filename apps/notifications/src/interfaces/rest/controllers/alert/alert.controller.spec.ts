import { generateMock } from "@anatine/zod-mock";
import { faker } from "@faker-js/faker";
import type { INestApplication } from "@nestjs/common";
import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { Ok } from "ts-results";
import { describe, expect, it, onTestFinished } from "vitest";
import type { MockProxy } from "vitest-mock-extended";
import { mock } from "vitest-mock-extended";

import { LoggerService } from "@src/common/services/logger/logger.service";
import { HttpExceptionFilter } from "@src/interfaces/rest/filters/http-exception/http-exception.filter";
import { HttpResultInterceptor } from "@src/interfaces/rest/interceptors/http-result/http-result.interceptor";
import { AuthService } from "@src/interfaces/rest/services/auth/auth.service";
import { AlertRepository } from "@src/modules/alert/repositories/alert/alert.repository";
import type { NotificationChannelOutput } from "@src/modules/notifications/repositories/notification-channel/notification-channel.repository";
import { NotificationChannelRepository } from "@src/modules/notifications/repositories/notification-channel/notification-channel.repository";
import { chainMessageCreateInputSchema } from "../../http-schemas/alert.http-schema";
import { AlertController } from "./alert.controller";

import { MockProvider } from "@test/mocks/provider.mock";
import { generateGeneralAlert } from "@test/seeders/general-alert.seeder";
import { generateWalletBalanceAlert } from "@test/seeders/wallet-balance-alert.seeder";

describe(AlertController.name, () => {
  describe("createAlert", () => {
    it("should call alertRepository.create() and return the created alert", async () => {
      const { controller, alertRepository, userId } = await setup();

      const input = generateMock(chainMessageCreateInputSchema);
      const output = generateGeneralAlert({});

      alertRepository.create.mockResolvedValue(output);

      const result = await controller.createAlert({ data: input });

      expect(alertRepository.create).toHaveBeenCalledWith({
        ...input,
        userId
      });
      expect(result).toEqual(Ok({ data: output }));
    });

    it("throws NotFoundException and does not create when the notification channel is not owned by the user", async () => {
      const { controller, alertRepository, notificationChannelRepository } = await setup();

      const input = generateMock(chainMessageCreateInputSchema);
      notificationChannelRepository.findById.mockResolvedValue(undefined);

      await expect(controller.createAlert({ data: input })).rejects.toThrow("Notification channel not found");
      expect(notificationChannelRepository.findById).toHaveBeenCalledWith(input.notificationChannelId);
      expect(alertRepository.create).not.toHaveBeenCalled();
    });
  });

  describe("updateAlert", () => {
    it("should call alertRepository.updateById() and return the updated alert", async () => {
      const { controller, alertRepository } = await setup();

      const id = faker.string.uuid();
      const input = generateMock(chainMessageCreateInputSchema);
      const output = generateGeneralAlert({});

      alertRepository.updateById.mockResolvedValue(output);

      const result = await controller.updateAlert(id, { data: input });

      expect(alertRepository.updateById).toHaveBeenCalledWith(id, input);
      expect(result).toEqual(Ok({ data: output }));
    });

    it("should throw NotFoundException if alert is not found", async () => {
      const { controller, alertRepository } = await setup();

      const id = faker.string.uuid();
      const input = generateMock(chainMessageCreateInputSchema);

      alertRepository.updateById.mockResolvedValue(undefined);

      await expect(controller.updateAlert(id, { data: input })).resolves.toMatchObject({
        err: true,
        val: expect.objectContaining({ message: "Alert not found" })
      });
      expect(alertRepository.updateById).toHaveBeenCalledWith(id, input);
    });

    it("throws NotFoundException and does not update when the notification channel is not owned by the user", async () => {
      const { controller, alertRepository, notificationChannelRepository } = await setup();

      const id = faker.string.uuid();
      const input = generateMock(chainMessageCreateInputSchema);
      notificationChannelRepository.findById.mockResolvedValue(undefined);

      await expect(controller.updateAlert(id, { data: input })).rejects.toThrow("Notification channel not found");
      expect(notificationChannelRepository.findById).toHaveBeenCalledWith(input.notificationChannelId);
      expect(alertRepository.updateById).not.toHaveBeenCalled();
    });

    it("throws BadRequestException and does not update a balance alert with non-balance conditions", async () => {
      const { controller, alertRepository } = await setup();

      const id = faker.string.uuid();
      alertRepository.findOneById.mockResolvedValue(generateWalletBalanceAlert({ id }));

      await expect(controller.updateAlert(id, { data: { conditions: { operator: "eq", field: "foo", value: "bar" } } })).rejects.toThrow(
        "Conditions must match the balance alert shape"
      );
      expect(alertRepository.updateById).not.toHaveBeenCalled();
    });

    it("updates a balance alert when the conditions match the balance shape", async () => {
      const { controller, alertRepository } = await setup();

      const id = faker.string.uuid();
      const output = generateWalletBalanceAlert({ id });
      alertRepository.findOneById.mockResolvedValue(output);
      alertRepository.updateById.mockResolvedValue(output);

      const conditions = { operator: "lt" as const, field: "balance" as const, value: 100 };
      const result = await controller.updateAlert(id, { data: { conditions } });

      expect(alertRepository.updateById).toHaveBeenCalledWith(id, { conditions });
      expect(result).toEqual(Ok({ data: output }));
    });

    it("answers 400 without updating the alert when the id is not a uuid", async () => {
      const { app, alertRepository } = await setup();

      const res = await request(app.getHttpServer())
        .patch("/v1/alerts/..%2fhealth")
        .send({ data: { enabled: false } });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Validation failed (uuid is expected)");
      expect(alertRepository.updateById).not.toHaveBeenCalled();
    });

    it("updates the alert by a uuid id and answers 404 when none matches", async () => {
      const { app, alertRepository } = await setup();
      const id = faker.string.uuid();

      const res = await request(app.getHttpServer())
        .patch(`/v1/alerts/${id}`)
        .send({ data: { enabled: false } });

      expect(res.status).toBe(404);
      expect(alertRepository.updateById).toHaveBeenCalledWith(id, { enabled: false });
    });
  });

  describe("getAlert", () => {
    it("should call alertRepository.findOneById() and return the alert", async () => {
      const { controller, alertRepository } = await setup();

      const id = faker.string.uuid();
      const output = generateGeneralAlert({});

      alertRepository.findOneById.mockResolvedValue(output);

      const result = await controller.getAlert(id);

      expect(alertRepository.findOneById).toHaveBeenCalledWith(id);
      expect(result).toEqual(Ok({ data: output }));
    });

    it("should throw NotFoundException if alert is not found", async () => {
      const { controller, alertRepository } = await setup();

      const id = faker.string.uuid();

      alertRepository.findOneById.mockResolvedValue(undefined);

      await expect(controller.getAlert(id)).resolves.toMatchObject({
        err: true,
        val: expect.objectContaining({ message: "Alert not found" })
      });
      expect(alertRepository.findOneById).toHaveBeenCalledWith(id);
    });

    it("answers 400 without reading the alert when the id is not a uuid", async () => {
      const { app, alertRepository } = await setup();

      const res = await request(app.getHttpServer()).get("/v1/alerts/..%2fhealth");

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Validation failed (uuid is expected)");
      expect(alertRepository.findOneById).not.toHaveBeenCalled();
    });

    it("reads the alert by a uuid id and answers 404 when none matches", async () => {
      const { app, alertRepository } = await setup();
      const id = faker.string.uuid();

      const res = await request(app.getHttpServer()).get(`/v1/alerts/${id}`);

      expect(res.status).toBe(404);
      expect(alertRepository.findOneById).toHaveBeenCalledWith(id);
    });
  });

  describe("deleteAlert", () => {
    it("should call alertRepository.deleteOneById() and return the deleted alert", async () => {
      const { controller, alertRepository } = await setup();

      const id = faker.string.uuid();
      const output = generateGeneralAlert({});

      alertRepository.deleteOneById.mockResolvedValue(output);

      const result = await controller.deleteAlert(id);

      expect(alertRepository.deleteOneById).toHaveBeenCalledWith(id);
      expect(result).toEqual(Ok({ data: output }));
    });

    it("should throw NotFoundException if alert is not found", async () => {
      const { controller, alertRepository } = await setup();

      const id = faker.string.uuid();

      alertRepository.deleteOneById.mockResolvedValue(undefined);

      await expect(controller.deleteAlert(id)).resolves.toMatchObject({
        err: true,
        val: expect.objectContaining({ message: "Alert not found" })
      });
      expect(alertRepository.deleteOneById).toHaveBeenCalledWith(id);
    });

    it("answers 400 without deleting the alert when the id is not a uuid", async () => {
      const { app, alertRepository } = await setup();

      const res = await request(app.getHttpServer()).delete("/v1/alerts/..%2fhealth");

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Validation failed (uuid is expected)");
      expect(alertRepository.deleteOneById).not.toHaveBeenCalled();
    });

    it("deletes the alert by a uuid id and answers 404 when none matches", async () => {
      const { app, alertRepository } = await setup();
      const id = faker.string.uuid();

      const res = await request(app.getHttpServer()).delete(`/v1/alerts/${id}`);

      expect(res.status).toBe(404);
      expect(alertRepository.deleteOneById).toHaveBeenCalledWith(id);
    });
  });

  async function setup(): Promise<{
    controller: AlertController;
    app: INestApplication;
    alertRepository: MockProxy<AlertRepository>;
    notificationChannelRepository: MockProxy<NotificationChannelRepository>;
    userId: string;
  }> {
    const userId = faker.string.uuid();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AlertController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            userId
          }
        },
        MockProvider(AlertRepository),
        MockProvider(NotificationChannelRepository),
        MockProvider(LoggerService)
      ]
    }).compile();

    const alertRepository = module.get<MockProxy<AlertRepository>>(AlertRepository);
    alertRepository.accessibleBy.mockReturnValue(alertRepository);

    const notificationChannelRepository = module.get<MockProxy<NotificationChannelRepository>>(NotificationChannelRepository);
    notificationChannelRepository.accessibleBy.mockReturnValue(notificationChannelRepository);
    notificationChannelRepository.findById.mockResolvedValue(mock<NotificationChannelOutput>());

    const app = module.createNestApplication();
    app.enableVersioning();
    app.useGlobalInterceptors(new HttpResultInterceptor());
    app.useGlobalFilters(new HttpExceptionFilter(module.get(LoggerService)));
    await app.init();
    onTestFinished(() => app.close());

    return {
      controller: module.get(AlertController),
      app,
      userId,
      alertRepository,
      notificationChannelRepository
    };
  }
});
