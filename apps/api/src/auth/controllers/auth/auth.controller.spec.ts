import { ResponseError } from "auth0";
import { container as rootContainer } from "tsyringe";
import { mock } from "vitest-mock-extended";

import { AuthService } from "@src/auth/services/auth.service";
import type { Auth0Service } from "@src/auth/services/auth0/auth0.service";
import type { EmailVerificationCodeService } from "@src/auth/services/email-verification-code/email-verification-code.service";
import type { UserService } from "@src/user/services/user/user.service";
import { AuthController } from "./auth.controller";

import { UserSeeder } from "@test/seeders/user.seeder";

describe(AuthController.name, () => {
  describe("signup", () => {
    it("creates user via auth0 service", async () => {
      const { controller, auth0Service } = setup();

      auth0Service.createUser.mockResolvedValue(undefined);

      await controller.signup({ email: "user@example.com", password: "StrongPassword123!" });

      expect(auth0Service.createUser).toHaveBeenCalledWith({
        email: "user@example.com",
        password: "StrongPassword123!",
        connection: "Username-Password-Authentication"
      });
    });

    it("throws http error when auth0 returns a non-409 error", async () => {
      const { controller, auth0Service } = setup();

      auth0Service.createUser.mockRejectedValue(
        new ResponseError(400, JSON.stringify({ message: "PasswordStrengthError: Password is too weak" }), new Headers())
      );

      await expect(controller.signup({ email: "user@example.com", password: "weak" })).rejects.toThrow("PasswordStrengthError: Password is too weak");
    });

    it("converts 409 (user exists) to http error", async () => {
      const { controller, auth0Service } = setup();

      auth0Service.createUser.mockRejectedValue(new ResponseError(409, JSON.stringify({ message: "The user already exists." }), new Headers()));

      await expect(controller.signup({ email: "user@example.com", password: "StrongPassword123!" })).rejects.toThrow("The user already exists.");
    });

    it("re-throws non-ResponseError errors", async () => {
      const { controller, auth0Service } = setup();

      auth0Service.createUser.mockRejectedValue(new Error("Network failure"));

      await expect(controller.signup({ email: "user@example.com", password: "StrongPassword123!" })).rejects.toThrow("Network failure");
    });
  });

  describe("sendVerificationCode", () => {
    it("delegates to emailVerificationCodeService and wraps result in data", async () => {
      const user = UserSeeder.create();
      const codeSentAt = new Date().toISOString();
      const { controller, emailVerificationCodeService } = setup({ user });

      emailVerificationCodeService.sendCode.mockResolvedValue({ codeSentAt });

      const result = await controller.sendVerificationCode();

      expect(emailVerificationCodeService.sendCode).toHaveBeenCalledWith(user.id, { resend: undefined });
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

    it("throws 400 when emailVerified is false", async () => {
      const user = UserSeeder.create();
      const { controller, emailVerificationCodeService } = setup({ user });

      emailVerificationCodeService.verifyCode.mockResolvedValue({ emailVerified: false });

      await expect(controller.verifyEmailCode({ data: { code: "000000" } })).rejects.toThrow("Invalid verification code");
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
