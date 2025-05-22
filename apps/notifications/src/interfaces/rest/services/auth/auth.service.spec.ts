import type { MongoAbility } from "@casl/ability";
import { faker } from "@faker-js/faker";
import { UnauthorizedException } from "@nestjs/common";
import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import type { Request } from "express";

import { LoggerService } from "@src/common/services/logger/logger.service";
import { AuthService } from "./auth.service";

import { MockProvider } from "@test/mocks/provider.mock";

describe(AuthService.name, () => {
  describe("userId", () => {
    it("returns userId from header", async () => {
      const userId = faker.string.uuid();
      const { service } = await setup({ headers: { "x-user-id": userId } });

      expect(service.userId).toBe(userId);
    });

    it("throws if x-user-id header missing", async () => {
      const { service } = await setup({ headers: {} });

      expect(() => service.userId).toThrow(UnauthorizedException);
    });
  });

  describe("ability", () => {
    it("returns ability from request", async () => {
      const ability = {} as MongoAbility;
      const { service } = await setup({
        headers: { "x-user-id": faker.string.uuid() },
        ability
      });

      expect(service.ability).toBe(ability);
    });

    it("throws if ability not set", async () => {
      const { service } = await setup({ headers: { "x-user-id": faker.string.uuid() } });

      expect(() => service.ability).toThrow(UnauthorizedException);
    });
  });

  async function setup(request: Partial<Request> = {}): Promise<{
    service: AuthService;
  }> {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MockProvider(LoggerService),
        {
          provide: "REQUEST",
          useValue: {
            headers: {},
            ...request
          }
        },
        AuthService
      ]
    }).compile();

    return {
      service: await module.resolve(AuthService)
    };
  }
});
