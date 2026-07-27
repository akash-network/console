import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AuthService } from "@src/auth/services/auth.service";
import type { UserAuthTokenService } from "@src/auth/services/user-auth-token/user-auth-token.service";
import type { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import type { UserOutput } from "@src/user/repositories/user/user.repository";
import type { UserService } from "@src/user/services/user/user.service";
import { UserController } from "./user.controller";

import { createUser } from "@test/seeders/user.seeder";

describe(UserController.name, () => {
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
});
