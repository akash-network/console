import createError from "http-errors";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AuthService } from "@src/auth/services/auth.service";
import type { UserOutput } from "@src/user/repositories/user/user.repository";
import type { AccountDeletionService } from "@src/user/services/account-deletion/account-deletion.service";
import { AccountDeletionController } from "./account-deletion.controller";

import { createUser } from "@test/seeders/user.seeder";

describe(AccountDeletionController.name, () => {
  describe("initiate", () => {
    it("starts the deletion for the signed-in user with the request's client details", async () => {
      const { controller, accountDeletionService, user } = setup();

      await controller.initiate({ data: { forfeitAcknowledged: true } }, { authMethod: "bearer", ip: "203.0.113.7", userAgent: "Mozilla/5.0" });

      expect(accountDeletionService.initiate).toHaveBeenCalledWith(user, { forfeitAcknowledged: true, ip: "203.0.113.7", userAgent: "Mozilla/5.0" });
    });

    it("answers 404 before anything else when account deletion is not available", async () => {
      const { controller, accountDeletionService } = setup({ isEnabled: false, user: null });

      await expect(controller.initiate({ data: { forfeitAcknowledged: false } }, { authMethod: "api_key" })).rejects.toMatchObject({ status: 404 });

      expect(accountDeletionService.initiate).not.toHaveBeenCalled();
    });

    it("answers 401 to a request nobody signed in for", async () => {
      const { controller, accountDeletionService } = setup({ user: null });

      await expect(controller.initiate({ data: { forfeitAcknowledged: false } }, { authMethod: "none" })).rejects.toMatchObject({ status: 401 });

      expect(accountDeletionService.initiate).not.toHaveBeenCalled();
    });

    it("refuses a request authenticated with an API key", async () => {
      const { controller, accountDeletionService } = setup();

      await expect(controller.initiate({ data: { forfeitAcknowledged: false } }, { authMethod: "api_key" })).rejects.toMatchObject({
        status: 403,
        errorCode: "session_required"
      });

      expect(accountDeletionService.initiate).not.toHaveBeenCalled();
    });
  });

  describe("confirm", () => {
    it("confirms the deletion with the link token and the caller's ip", async () => {
      const { controller, accountDeletionService } = setup({ user: null });

      await controller.confirm({ data: { token: "link-token" } }, { authMethod: "none", ip: "203.0.113.7" });

      expect(accountDeletionService.confirm).toHaveBeenCalledWith({ token: "link-token", ip: "203.0.113.7" });
    });
  });

  function setup(input: { isEnabled?: boolean; user?: UserOutput | null } = {}) {
    const user = input.user === null ? undefined : input.user ?? createUser();
    const authService = mock<AuthService>({ safeCurrentUser: user });

    const accountDeletionService = mock<AccountDeletionService>();
    accountDeletionService.assertEnabledFor.mockImplementation(() => {
      if (input.isEnabled === false) throw createError(404);
    });

    const controller = new AccountDeletionController(authService, accountDeletionService);

    return { controller, accountDeletionService, user };
  }
});
