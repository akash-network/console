import type { MongoAbility } from "@casl/ability";
import { faker } from "@faker-js/faker";
import { UnauthorizedException } from "@nestjs/common";
import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import type { Request } from "express";
import { describe, expect, it } from "vitest";

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

  describe("organizationId and projectId", () => {
    it("returns the organization and project minted for the request", async () => {
      const organizationId = faker.string.uuid();
      const projectId = faker.string.uuid();
      const { service } = await setup({ headers: { "x-user-id": faker.string.uuid(), "x-organization-id": organizationId, "x-project-id": projectId } });

      expect(service.organizationId).toBe(organizationId);
      expect(service.projectId).toBe(projectId);
    });

    it("returns null when none is minted", async () => {
      const { service } = await setup({ headers: { "x-user-id": faker.string.uuid() } });

      expect(service.organizationId).toBeNull();
      expect(service.projectId).toBeNull();
    });

    it("throws if the identity headers are malformed", async () => {
      const { service } = await setup({ headers: { "x-user-id": faker.string.uuid(), "x-organization-id": "acme" } });

      expect(() => service.organizationId).toThrow(UnauthorizedException);
    });
  });

  describe("defaultChannelOwner", () => {
    it("names the organization when its rules apply", async () => {
      const organizationId = faker.string.uuid();
      const { service } = await setup({
        headers: {
          "x-user-id": faker.string.uuid(),
          "x-organization-id": organizationId,
          "x-organization-role": "admin",
          "x-project-scope": JSON.stringify({ kind: "all" })
        }
      });

      expect(service.defaultChannelOwner).toEqual({ kind: "organization", organizationId });
    });

    it("names the user within their personal organization", async () => {
      const userId = faker.string.uuid();
      const organizationId = faker.string.uuid();
      const { service } = await setup({ headers: { "x-user-id": userId, "x-organization-id": organizationId, "x-organization-type": "personal" } });

      expect(service.defaultChannelOwner).toEqual({ kind: "user", userId, organizationId });
      expect(service.reachesUnattributedRows).toBe(true);
    });

    it("names the user alone when no organization is minted", async () => {
      const userId = faker.string.uuid();
      const { service } = await setup({ headers: { "x-user-id": userId } });

      expect(service.defaultChannelOwner).toEqual({ kind: "user", userId, organizationId: null });
    });

    it.each(["team", undefined])("names the organization of type %s even without organization rules", async organizationType => {
      const organizationId = faker.string.uuid();
      const { service } = await setup({
        headers: { "x-user-id": faker.string.uuid(), "x-organization-id": organizationId, ...(organizationType && { "x-organization-type": organizationType }) }
      });

      expect(service.defaultChannelOwner).toEqual({ kind: "organization", organizationId });
      expect(service.reachesUnattributedRows).toBe(false);
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
