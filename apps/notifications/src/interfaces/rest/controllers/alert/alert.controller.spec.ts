import { generateMock } from "@anatine/zod-mock";
import { faker } from "@faker-js/faker";
import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import type { MockProxy } from "jest-mock-extended";
import { Ok } from "ts-results";

import { AlertRepository } from "@src/modules/alert/repositories/alert/alert.repository";
import { chainMessageCreateInputSchema } from "../../http-schemas/alert.http-schema";
import { AlertController } from "./alert.controller";

import { MockProvider } from "@test/mocks/provider.mock";
import { generateChainMessageAlert } from "@test/seeders/chain-message-alert.seeder";

describe(AlertController.name, () => {
  describe("createAlert", () => {
    it("should call rawAlertRepository.create() and return the created alert", async () => {
      const { controller, alertRepository } = await setup();

      const input = generateMock(chainMessageCreateInputSchema);
      const output = generateChainMessageAlert({});

      alertRepository.create.mockResolvedValue(output);

      const result = await controller.createAlert({ data: input });

      expect(alertRepository.create).toHaveBeenCalledWith(input);
      expect(result).toEqual(Ok({ data: output }));
    });
  });

  describe("patchAlert", () => {
    it("should call rawAlertRepository.updateById() and return the updated alert", async () => {
      const { controller, alertRepository } = await setup();

      const id = faker.string.uuid();
      const input = generateMock(chainMessageCreateInputSchema);
      const output = generateChainMessageAlert({});

      alertRepository.updateById.mockResolvedValue(output);

      const result = await controller.patchAlert(id, { data: input });

      expect(alertRepository.updateById).toHaveBeenCalledWith(id, input);
      expect(result).toEqual(Ok({ data: output }));
    });

    it("should throw NotFoundException if alert is not found", async () => {
      const { controller, alertRepository } = await setup();

      const id = faker.string.uuid();
      const input = generateMock(chainMessageCreateInputSchema);

      alertRepository.updateById.mockResolvedValue(undefined);

      await expect(controller.patchAlert(id, { data: input })).resolves.toMatchObject({
        err: true,
        val: expect.objectContaining({ message: "Alert not found" })
      });
      expect(alertRepository.updateById).toHaveBeenCalledWith(id, input);
    });
  });

  describe("getAlert", () => {
    it("should call rawAlertRepository.findOneById() and return the alert", async () => {
      const { controller, alertRepository } = await setup();

      const id = faker.string.uuid();
      const output = generateChainMessageAlert({});

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
  });

  describe("deleteAlert", () => {
    it("should call rawAlertRepository.deleteOneById() and return the deleted alert", async () => {
      const { controller, alertRepository } = await setup();

      const id = faker.string.uuid();
      const output = generateChainMessageAlert({});

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
  });

  async function setup(): Promise<{
    controller: AlertController;
    alertRepository: MockProxy<AlertRepository>;
  }> {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AlertController],
      providers: [MockProvider(AlertRepository)]
    }).compile();

    return {
      controller: module.get(AlertController),
      alertRepository: module.get(AlertRepository)
    };
  }
});
