import { container as rootContainer } from "tsyringe";
import { mock } from "vitest-mock-extended";

import { AuthService } from "@src/auth/services/auth.service";
import type { Auth0Service } from "@src/auth/services/auth0/auth0.service";
import type { EmailVerificationCodeService } from "@src/auth/services/email-verification-code/email-verification-code.service";
import type { UserService } from "@src/user/services/user/user.service";
import { AuthController } from "./auth.controller";

import { UserSeeder } from "@test/seeders/user.seeder";

describe(AuthController.name, () => {
  describe("sendVerificationCode", () => {
    it("delegates to emailVerificationCodeService and wraps result in data", async () => {
      const user = UserSeeder.create();
      const codeSentAt = new Date().toISOString();
      const { controller, emailVerificationCodeService } = setup({ user });

      emailVerificationCodeService.sendCode.mockResolvedValue({ codeSentAt });

      const result = await controller.sendVerificationCode();

      expect(emailVerificationCodeService.sendCode).toHaveBeenCalledWith(user.id);
      expect(result).toEqual({ data: { codeSentAt } });
    });
  });

  describe("verifyEmailCode", () => {
    it("delegates to emailVerificationCodeService with code and wraps result in data", async () => {
      const user = UserSeeder.create();
      const { controller, emailVerificationCodeService } = setup({ user });

      emailVerificationCodeService.verifyCode.mockResolvedValue({ emailVerified: true });

      const result = await controller.verifyEmailCode({ data: { code: "123456" } });

      expect(emailVerificationCodeService.verifyCode).toHaveBeenCalledWith(user.id, "123456");
      expect(result).toEqual({ data: { emailVerified: true } });
    });
  });

  function setup(
    input: {
      user?: ReturnType<typeof UserSeeder.create>;
    } = {}
  ) {
    const user = input.user ?? UserSeeder.create();

    rootContainer.register(AuthService, {
      useValue: mock<AuthService>({
        isAuthenticated: true,
        currentUser: user
      })
    });

    const auth0Service = mock<Auth0Service>();
    const emailVerificationCodeService = mock<EmailVerificationCodeService>();
    const userService = mock<UserService>();

    const controller = new AuthController(rootContainer.resolve(AuthService), auth0Service, userService, emailVerificationCodeService);

    return { controller, auth0Service, emailVerificationCodeService, userService };
  }
});
