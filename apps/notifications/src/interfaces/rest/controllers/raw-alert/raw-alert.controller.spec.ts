import { generateMock } from "@anatine/zod-mock";
import { faker } from "@faker-js/faker";
import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import type { MockProxy } from "jest-mock-extended";
import { Ok } from "ts-results";

import { RawAlertRepository } from "@src/modules/alert/repositories/raw-alert/raw-alert.repository";
import { alertCreateInputSchema, alertOutputSchema, alertPatchInputSchema, RawAlertController } from "./raw-alert.controller";

import { MockProvider } from "@test/mocks/provider.mock";

describe(RawAlertController.name, () => {
  describe("createAlert", () => {
    it("should call rawAlertRepository.create() and return the created alert", async () => {
      const { controller, rawAlertRepository } = await setup();

      const input = generateMock(alertCreateInputSchema);
      const output = generateMock(alertOutputSchema);

      rawAlertRepository.create.mockResolvedValue(output);

      const result = await controller.createAlert({ data: input });

      expect(rawAlertRepository.create).toHaveBeenCalledWith(input);
      expect(result).toEqual(Ok({ data: output }));
    });
  });

  describe("patchAlert", () => {
    it("should call rawAlertRepository.updateById() and return the updated alert", async () => {
      const { controller, rawAlertRepository } = await setup();

      const id = faker.string.uuid();
      const input = generateMock(alertPatchInputSchema);
      const output = generateMock(alertOutputSchema);

      rawAlertRepository.updateById.mockResolvedValue(output);

      const result = await controller.patchAlert(id, { data: input });

      expect(rawAlertRepository.updateById).toHaveBeenCalledWith(id, input);
      expect(result).toEqual(Ok({ data: output }));
    });

    it("should throw NotFoundException if alert is not found", async () => {
      const { controller, rawAlertRepository } = await setup();

      const id = faker.string.uuid();
      const input = generateMock(alertPatchInputSchema);

      rawAlertRepository.updateById.mockResolvedValue(undefined);

      await expect(controller.patchAlert(id, { data: input })).resolves.toMatchObject({
        err: true,
        val: expect.objectContaining({ message: "Alert not found" })
      });
      expect(rawAlertRepository.updateById).toHaveBeenCalledWith(id, input);
    });
  });

  describe("getAlert", () => {
    it("should call rawAlertRepository.findOneById() and return the alert", async () => {
      const { controller, rawAlertRepository } = await setup();

      const id = faker.string.uuid();
      const output = generateMock(alertOutputSchema);

      rawAlertRepository.findOneById.mockResolvedValue(output);

      const result = await controller.getAlert(id);

      expect(rawAlertRepository.findOneById).toHaveBeenCalledWith(id);
      expect(result).toEqual(Ok({ data: output }));
    });

    it("should throw NotFoundException if alert is not found", async () => {
      const { controller, rawAlertRepository } = await setup();

      const id = faker.string.uuid();

      rawAlertRepository.findOneById.mockResolvedValue(undefined);

      await expect(controller.getAlert(id)).resolves.toMatchObject({
        err: true,
        val: expect.objectContaining({ message: "Alert not found" })
      });
      expect(rawAlertRepository.findOneById).toHaveBeenCalledWith(id);
    });
  });

  describe("deleteAlert", () => {
    it("should call rawAlertRepository.deleteOneById() and return the deleted alert", async () => {
      const { controller, rawAlertRepository } = await setup();

      const id = faker.string.uuid();
      const output = generateMock(alertOutputSchema);

      rawAlertRepository.deleteOneById.mockResolvedValue(output);

      const result = await controller.deleteAlert(id);

      expect(rawAlertRepository.deleteOneById).toHaveBeenCalledWith(id);
      expect(result).toEqual(Ok({ data: output }));
    });

    it("should throw NotFoundException if alert is not found", async () => {
      const { controller, rawAlertRepository } = await setup();

      const id = faker.string.uuid();

      rawAlertRepository.deleteOneById.mockResolvedValue(undefined);

      await expect(controller.deleteAlert(id)).resolves.toMatchObject({
        err: true,
        val: expect.objectContaining({ message: "Alert not found" })
      });
      expect(rawAlertRepository.deleteOneById).toHaveBeenCalledWith(id);
    });
  });

  async function setup(): Promise<{
    controller: RawAlertController;
    rawAlertRepository: MockProxy<RawAlertRepository>;
  }> {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RawAlertController],
      providers: [MockProvider(RawAlertRepository)]
    }).compile();

    return {
      controller: module.get(RawAlertController),
      rawAlertRepository: module.get(RawAlertRepository)
    };
  }
});
