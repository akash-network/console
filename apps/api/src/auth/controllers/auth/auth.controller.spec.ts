import { ManagementApiError, ResponseError } from "auth0";
import { container as rootContainer } from "tsyringe";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import { AuthService } from "@src/auth/services/auth.service";
import type { Auth0Service } from "@src/auth/services/auth0/auth0.service";
import { AUTH0_DB_CONNECTION } from "@src/auth/services/auth0/auth0.service";
import type { EmailVerificationCodeService } from "@src/auth/services/email-verification-code/email-verification-code.service";
import type { UserService } from "@src/user/services/user/user.service";
import { AuthController } from "./auth.controller";

import { createUser } from "@test/seeders/user.seeder";

/**
 * Mirrors what the management client's own `parseError` builds for a JSON error body. Production throws
 * this class, not `ResponseError`, so the mapping has to be exercised against it.
 */
function createManagementApiError(statusCode: number, message: string, error = "Bad Request") {
  const body = JSON.stringify({ statusCode, error, message, errorCode: "auth0_idp_error" });
  return new ManagementApiError("auth0_idp_error", error, statusCode, body, new Headers(), message);
}

describe(AuthController.name, () => {
  describe("signup", () => {
    it("creates user via auth0 service", async () => {
      const { controller, auth0Service } = setup();

      auth0Service.createUser.mockResolvedValue(undefined);

      await controller.signup({ email: "user@example.com", password: "StrongPassword123!" });

      expect(auth0Service.createUser).toHaveBeenCalledWith({
        email: "user@example.com",
        password: "StrongPassword123!",
        connection: AUTH0_DB_CONNECTION
      });
    });

    it("converts 409 (user exists) to a 422 that does not confirm the email is registered", async () => {
      const { controller, auth0Service } = setup();

      auth0Service.createUser.mockRejectedValue(createManagementApiError(409, "The user already exists.", "Conflict"));

      await expect(controller.signup({ email: "user@example.com", password: "StrongPassword123!" })).rejects.toMatchObject({
        status: 422,
        message: "Unable to create account. Please try again or use a different email."
      });
    });

    it("passes a rejected password through with auth0's own message", async () => {
      const { controller, auth0Service } = setup();

      auth0Service.createUser.mockRejectedValue(createManagementApiError(400, "PasswordStrengthError: Password is too weak"));

      await expect(controller.signup({ email: "user@example.com", password: "weak" })).rejects.toMatchObject({
        status: 400,
        message: "PasswordStrengthError: Password is too weak"
      });
    });

    it("passes a rate limit through as 429", async () => {
      const { controller, auth0Service } = setup();

      auth0Service.createUser.mockRejectedValue(createManagementApiError(429, "Too many requests", "Too Many Requests"));

      await expect(controller.signup({ email: "user@example.com", password: "StrongPassword123!" })).rejects.toMatchObject({
        status: 429,
        message: "Too many requests"
      });
    });

    it("converts an auth0 outage to a 502 without echoing its message", async () => {
      const { controller, auth0Service } = setup();

      auth0Service.createUser.mockRejectedValue(createManagementApiError(503, "Service temporarily unavailable", "Service Unavailable"));

      await expect(controller.signup({ email: "user@example.com", password: "StrongPassword123!" })).rejects.toMatchObject({
        status: 502,
        message: "Unable to create the account right now. Please try again."
      });
    });

    it("converts 409 to 422 when auth0 returns an unparseable body", async () => {
      const { controller, auth0Service } = setup();

      auth0Service.createUser.mockRejectedValue(new ResponseError(409, "<html>Conflict</html>", new Headers(), "Response returned an error code"));

      await expect(controller.signup({ email: "user@example.com", password: "StrongPassword123!" })).rejects.toMatchObject({
        status: 422,
        message: "Unable to create account. Please try again or use a different email."
      });
    });

    it("re-throws errors that did not come from the auth0 api", async () => {
      const { controller, auth0Service } = setup();

      auth0Service.createUser.mockRejectedValue(new Error("Network failure"));

      await expect(controller.signup({ email: "user@example.com", password: "StrongPassword123!" })).rejects.toThrow("Network failure");
    });
  });

  describe("sendVerificationCode", () => {
    it("delegates to emailVerificationCodeService and wraps result in data", async () => {
      const user = createUser();
      const codeSentAt = new Date().toISOString();
      const { controller, emailVerificationCodeService } = setup({ user });

      emailVerificationCodeService.sendCode.mockResolvedValue({ codeSentAt });

      const result = await controller.sendVerificationCode();

      expect(emailVerificationCodeService.sendCode).toHaveBeenCalledWith(user.id);
      expect(result).toEqual({ data: { codeSentAt } });
    });
  });

  describe("verifyEmailCode", () => {
    it("delegates to emailVerificationCodeService with code", async () => {
      const user = createUser();
      const { controller, emailVerificationCodeService } = setup({ user });

      emailVerificationCodeService.verifyCode.mockResolvedValue(undefined);

      await controller.verifyEmailCode({ data: { code: "123456" } });

      expect(emailVerificationCodeService.verifyCode).toHaveBeenCalledWith(user.id, "123456");
    });
  });

  function setup(
    input: {
      user?: ReturnType<typeof createUser>;
    } = {}
  ) {
    const user = input.user ?? createUser();

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
