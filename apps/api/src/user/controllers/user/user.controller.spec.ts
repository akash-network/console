import { faker } from "@faker-js/faker";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import { AuthService } from "@src/auth/services/auth.service";
import type { UserAuthTokenService } from "@src/auth/services/user-auth-token/user-auth-token.service";
import type { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import type { UserOutput } from "@src/user/repositories/user/user.repository";
import type { AccountStatusService } from "@src/user/services/account-status/account-status.service";
import type { UserService } from "@src/user/services/user/user.service";
import { UserController } from "./user.controller";

import { createUser } from "@test/seeders/user.seeder";

describe(UserController.name, () => {
  describe("getCurrentUser", () => {
    it("returns the current user without the organization they last used", async () => {
      const user = createUser({ lastUsedOrganizationId: faker.string.uuid() });
      const { controller, authService } = setup();
      authService.currentUser = user;

      const result = await controller.getCurrentUser();

      expect(result.data).not.toHaveProperty("lastUsedOrganizationId");
      expect(result.data).toEqual({ ...user, lastUsedOrganizationId: undefined, accountStatusReason: null });
    });

    it("returns the account status with the reason written for the user", async () => {
      const user = createUser({ accountStatus: "suspended" });
      const { controller, authService, accountStatusService } = setup();
      authService.currentUser = user;
      accountStatusService.findUserReasonOf.mockResolvedValue("Unpaid invoices");

      const result = await controller.getCurrentUser();

      expect(accountStatusService.findUserReasonOf).toHaveBeenCalledWith(expect.objectContaining({ id: user.id, accountStatus: "suspended" }));
      expect(result.data).toMatchObject({ accountStatus: "suspended", accountStatusReason: "Unpaid invoices" });
    });
  });

  describe("registerUser", () => {
    it("registers the account the request's access token belongs to", async () => {
      const authorization = `Bearer ${faker.string.alphanumeric(40)}`;
      const userId = faker.string.uuid();
      const { controller, userAuthTokenService, userService } = setup({ authorization });
      userAuthTokenService.getValidUserId.mockResolvedValue(userId);
      const email = faker.internet.email();
      userService.registerUser.mockResolvedValue({ ...createUser({ userId, email }), userId, username: faker.internet.userName(), email, isNewUser: true });

      await controller.registerUser({ wantedUsername: faker.internet.userName() });

      expect(userAuthTokenService.getValidUserId).toHaveBeenCalledWith(authorization);
      expect(userService.registerUser).toHaveBeenCalledWith(expect.objectContaining({ userId }));
    });

    it("verifies an empty token when the request carries no authorization header", async () => {
      const { controller, userAuthTokenService } = setup({});
      userAuthTokenService.getValidUserId.mockResolvedValue(null);

      await expect(controller.registerUser({ wantedUsername: faker.internet.userName() })).rejects.toMatchObject({
        status: 401
      });

      expect(userAuthTokenService.getValidUserId).toHaveBeenCalledWith("");
    });

    it("rejects with 401 without registering anyone when the access token is not valid", async () => {
      const { controller, userAuthTokenService, userService } = setup({ authorization: `Bearer ${faker.string.alphanumeric(40)}` });
      userAuthTokenService.getValidUserId.mockResolvedValue(null);

      await expect(controller.registerUser({ wantedUsername: faker.internet.userName() })).rejects.toMatchObject({
        status: 401
      });

      expect(userService.registerUser).not.toHaveBeenCalled();
    });
  });

  describe("skipOnboarding", () => {
    it("delegates to the user service with the current user id", async () => {
      const user = createUser();
      const { controller, authService, userService } = setup();
      authService.currentUser = user;

      await controller.skipOnboarding();

      expect(userService.skipOnboarding).toHaveBeenCalledWith(user.id);
    });

    it("throws 401 when there is no current user", async () => {
      const { controller, authService, userService } = setup();
      authService.currentUser = undefined as unknown as UserOutput;

      await expect(controller.skipOnboarding()).rejects.toMatchObject({ status: 401 });
      expect(userService.skipOnboarding).not.toHaveBeenCalled();
    });
  });

  describe("markGetStartedDismissed", () => {
    it("delegates to the user service with the current user id", async () => {
      const user = createUser();
      const { controller, authService, userService } = setup();
      authService.currentUser = user;

      await controller.markGetStartedDismissed();

      expect(userService.markGetStartedDismissed).toHaveBeenCalledWith(user.id);
    });

    it("throws 401 when there is no current user", async () => {
      const { controller, authService, userService } = setup();
      authService.currentUser = undefined as unknown as UserOutput;

      await expect(controller.markGetStartedDismissed()).rejects.toMatchObject({ status: 401 });
      expect(userService.markGetStartedDismissed).not.toHaveBeenCalled();
    });
  });

  describe("markAgentSetupCopied", () => {
    it("delegates to the user service with the current user id", async () => {
      const user = createUser();
      const { controller, authService, userService } = setup();
      authService.currentUser = user;

      await controller.markAgentSetupCopied();

      expect(userService.markAgentSetupCopied).toHaveBeenCalledWith(user.id);
    });

    it("throws 401 when there is no current user", async () => {
      const { controller, authService, userService } = setup();
      authService.currentUser = undefined as unknown as UserOutput;

      await expect(controller.markAgentSetupCopied()).rejects.toMatchObject({ status: 401 });
      expect(userService.markAgentSetupCopied).not.toHaveBeenCalled();
    });
  });

  describe("markGithubStarPrompted", () => {
    it("delegates to the user service with the current user id", async () => {
      const user = createUser();
      const { controller, authService, userService } = setup();
      authService.currentUser = user;

      await controller.markGithubStarPrompted();

      expect(userService.markGithubStarPrompted).toHaveBeenCalledWith(user.id);
    });

    it("throws 401 when there is no current user", async () => {
      const { controller, authService, userService } = setup();
      authService.currentUser = undefined as unknown as UserOutput;

      await expect(controller.markGithubStarPrompted()).rejects.toMatchObject({ status: 401 });
      expect(userService.markGithubStarPrompted).not.toHaveBeenCalled();
    });
  });

  function setup(input: { authorization?: string } = {}) {
    const authService = mock<AuthService>({ isAuthenticated: true });
    const httpContext = {
      req: { header: (name: string) => (name.toLowerCase() === "authorization" ? input.authorization : undefined) },
      var: {}
    };
    const executionContextService = mock<ExecutionContextService>({
      get: ((key: string) => (key === "HTTP_CONTEXT" ? httpContext : undefined)) as ExecutionContextService["get"]
    });
    const userService = mock<UserService>();
    const userAuthTokenService = mock<UserAuthTokenService>();
    const accountStatusService = mock<AccountStatusService>();
    accountStatusService.findUserReasonOf.mockResolvedValue(null);
    container.register(AuthService, { useValue: authService });

    const controller = new UserController(authService, executionContextService, userService, userAuthTokenService, accountStatusService);

    return { controller, authService, executionContextService, userService, userAuthTokenService, accountStatusService };
  }
});
