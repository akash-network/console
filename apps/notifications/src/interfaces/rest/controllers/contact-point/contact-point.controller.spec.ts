import { generateMock } from "@anatine/zod-mock";
import { faker } from "@faker-js/faker";
import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import type { MockProxy } from "jest-mock-extended";
import { Ok } from "ts-results";

import { LoggerService } from "@src/common/services/logger/logger.service";
import { AuthService } from "@src/interfaces/rest/services/auth/auth.service";
import { ContactPointRepository } from "@src/modules/notifications/repositories/contact-point/contact-point.repository";
import { ContactPointController, contactPointCreateInputSchema, contactPointOutputSchema, contactPointPatchInputSchema } from "./contact-point.controller";

import { MockProvider } from "@test/mocks/provider.mock";

describe(ContactPointController.name, () => {
  describe("createContactPoint", () => {
    it("should call contactPointRepository.create() and return the created contact point", async () => {
      const { controller, contactPointRepository, userId } = await setup();
      const input = generateMock(contactPointCreateInputSchema);
      const output = generateMock(contactPointOutputSchema);

      contactPointRepository.create.mockResolvedValue(output);

      const result = await controller.createContactPoint({ data: input });

      expect(contactPointRepository.create).toHaveBeenCalledWith({
        ...input,
        userId
      });
      expect(result).toEqual(Ok({ data: output }));
    });
  });

  describe("patchContactPoint", () => {
    it("should call contactPointRepository.updateById() and return the updated contact point", async () => {
      const { controller, contactPointRepository } = await setup();
      const id = faker.string.uuid();
      const input = generateMock(contactPointPatchInputSchema);
      const output = generateMock(contactPointOutputSchema);

      contactPointRepository.updateById.mockResolvedValue(output);

      const result = await controller.patchContactPoint(id, { data: input });

      expect(contactPointRepository.updateById).toHaveBeenCalledWith(id, input);
      expect(result).toEqual(Ok({ data: output }));
    });

    it("should return an error if contact point is not found", async () => {
      const { controller, contactPointRepository } = await setup();
      const id = faker.string.uuid();
      const input = generateMock(contactPointPatchInputSchema);

      contactPointRepository.updateById.mockResolvedValue(undefined);

      await expect(controller.patchContactPoint(id, { data: input })).resolves.toMatchObject({
        err: true,
        val: expect.objectContaining({
          message: "Contact point not found"
        })
      });
      expect(contactPointRepository.updateById).toHaveBeenCalledWith(id, input);
    });
  });

  describe("getContactPoint", () => {
    it("should call contactPointRepository.findById() and return the contact point", async () => {
      const { controller, contactPointRepository } = await setup();
      const id = faker.string.uuid();
      const output = generateMock(contactPointOutputSchema);

      contactPointRepository.findById.mockResolvedValue(output);

      const result = await controller.getContactPoint(id);

      expect(contactPointRepository.findById).toHaveBeenCalledWith(id);
      expect(result).toEqual(Ok({ data: output }));
    });

    it("should return an error if contact point is not found", async () => {
      const { controller, contactPointRepository } = await setup();
      const id = faker.string.uuid();

      contactPointRepository.findById.mockResolvedValue(undefined);

      await expect(controller.getContactPoint(id)).resolves.toMatchObject({
        err: true,
        val: expect.objectContaining({
          message: "Contact point not found"
        })
      });
      expect(contactPointRepository.findById).toHaveBeenCalledWith(id);
    });
  });

  describe("deleteContactPoint", () => {
    it("should call contactPointRepository.deleteById() and return the deleted contact point", async () => {
      const { controller, contactPointRepository } = await setup();
      const id = faker.string.uuid();
      const output = generateMock(contactPointOutputSchema);

      contactPointRepository.deleteById.mockResolvedValue(output);

      const result = await controller.deleteContactPoint(id);

      expect(contactPointRepository.deleteById).toHaveBeenCalledWith(id);
      expect(result).toEqual(Ok({ data: output }));
    });

    it("should return an error if contact point is not found", async () => {
      const { controller, contactPointRepository } = await setup();
      const id = faker.string.uuid();

      contactPointRepository.deleteById.mockResolvedValue(undefined);

      await expect(controller.deleteContactPoint(id)).resolves.toMatchObject({
        err: true,
        val: expect.objectContaining({
          message: "Contact point not found"
        })
      });
      expect(contactPointRepository.deleteById).toHaveBeenCalledWith(id);
    });
  });

  async function setup(): Promise<{
    controller: ContactPointController;
    contactPointRepository: MockProxy<ContactPointRepository>;
    userId: string;
  }> {
    const userId = faker.string.uuid();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ContactPointController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            userId
          }
        },
        MockProvider(ContactPointRepository),
        MockProvider(LoggerService)
      ]
    }).compile();

    const contactPointRepository = module.get<MockProxy<ContactPointRepository>>(ContactPointRepository);
    contactPointRepository.accessibleBy.mockReturnValue(contactPointRepository);

    return {
      controller: module.get(ContactPointController),
      contactPointRepository,
      userId
    };
  }
});
