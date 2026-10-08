import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AuthService } from "@src/auth/services/auth.service";
import type { UserAuthTokenService } from "@src/auth/services/user-auth-token/user-auth-token.service";
import type { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import type { AppContext } from "@src/core/types/app-context";
import type { UserOutput } from "@src/user/repositories/user/user.repository";
import type { UserService } from "@src/user/services/user/user.service";
import { UserController } from "./user.controller";

import { createUser } from "@test/seeders/user.seeder";

describe(UserController.name, () => {
  describe("registerUser", () => {
    it("rejects with 401 when the token is invalid or expired", async () => {
      const { controller, executionContextService, userAuthTokenService } = setup();
      executionContextService.get.mockReturnValue(createHttpContext());
      userAuthTokenService.getValidUserId.mockResolvedValue(null);

      await expect(controller.registerUser(createRegisterUserInput())).rejects.toMatchObject({ status: 401 });
    });

    it("passes the referral code from the request through to the user service", async () => {
      const { controller, executionContextService, userAuthTokenService, userService } = setup();
      executionContextService.get.mockReturnValue(createHttpContext());
      userAuthTokenService.getValidUserId.mockResolvedValue("external-user-id");
      userService.registerUser.mockResolvedValue(createRegisteredUser());

      await controller.registerUser(createRegisterUserInput({ referralCode: "friendcode" }));

      expect(userService.registerUser).toHaveBeenCalledWith(expect.objectContaining({ userId: "external-user-id", referralCode: "friendcode" }));
    });

    it("passes no referral code through when the request has none", async () => {
      const { controller, executionContextService, userAuthTokenService, userService } = setup();
      executionContextService.get.mockReturnValue(createHttpContext());
      userAuthTokenService.getValidUserId.mockResolvedValue("external-user-id");
      userService.registerUser.mockResolvedValue(createRegisteredUser());

      await controller.registerUser(createRegisterUserInput());

      expect(userService.registerUser).toHaveBeenCalledWith(expect.objectContaining({ referralCode: undefined }));
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

  function setup() {
    const authService = mock<AuthService>();
    const executionContextService = mock<ExecutionContextService>();
    const userService = mock<UserService>();
    const userAuthTokenService = mock<UserAuthTokenService>();

    const controller = new UserController(authService, executionContextService, userService, userAuthTokenService);

    return { controller, authService, executionContextService, userService, userAuthTokenService };
  }

  function createHttpContext(): AppContext {
    return {
      req: { header: () => undefined },
      env: {},
      var: { clientInfo: { ip: "127.0.0.1", userAgent: "test-agent", fingerprint: "test-fingerprint" } }
    } as unknown as AppContext;
  }

  function createRegisterUserInput(overrides: { referralCode?: string } = {}) {
    return { wantedUsername: "wanted-username", email: "test@example.com", emailVerified: true, ...overrides };
  }

  function createRegisteredUser() {
    return mock<Awaited<ReturnType<UserService["registerUser"]>>>({ isNewUser: true });
  }
});
