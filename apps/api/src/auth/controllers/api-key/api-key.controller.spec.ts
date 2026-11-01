import { container } from "tsyringe";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ApiKeyService } from "@src/auth/services/api-key/api-key.service";
import { AuthService } from "@src/auth/services/auth.service";
import { ApiKeyController } from "./api-key.controller";

import { createApiKey } from "@test/seeders/api-key.seeder";

describe(ApiKeyController.name, () => {
  describe("create", () => {
    it("creates the key for a signed-in session and returns it with its secret", async () => {
      const { controller, apiKeyService } = setup();
      const created = { ...createApiKey(), apiKey: "ac.sk.test.secret" };
      apiKeyService.create.mockResolvedValue(created);

      const result = await controller.create({ name: "ci" }, { authMethod: "bearer" });

      expect(result).toEqual({ data: created });
      expect(apiKeyService.create).toHaveBeenCalledWith({ name: "ci" });
    });

    it.each(["api_key", "none", undefined] as const)("refuses a request authenticated with %s and creates nothing", async authMethod => {
      const { controller, apiKeyService } = setup();

      await expect(controller.create({ name: "ci" }, { authMethod })).rejects.toMatchObject({
        status: 403,
        message: "An API key can only be created from a signed-in Console session.",
        errorCode: "session_required"
      });

      expect(apiKeyService.create).not.toHaveBeenCalled();
    });
  });

  function setup() {
    const apiKeyService = mock<ApiKeyService>();
    container.register(AuthService, { useValue: mock<AuthService>({ isAuthenticated: true }) });
    const controller = new ApiKeyController(apiKeyService);

    return { controller, apiKeyService };
  }
});
