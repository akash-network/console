import nock from "nock";
import { container } from "tsyringe";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import { AuthConfigService } from "@src/auth/services/auth-config/auth-config.service";
import { app } from "@src/rest-app";

const { TURNSTILE_SECRET_KEY } = vi.hoisted(() => {
  const TURNSTILE_SECRET_KEY = "functional-test-turnstile-secret";
  vi.stubEnv("TURNSTILE_REQUIRED", "true");
  vi.stubEnv("TURNSTILE_SECRET_KEY", TURNSTILE_SECRET_KEY);
  return { TURNSTILE_SECRET_KEY };
});

describe("Signup", () => {
  const auth0Domain = container.resolve(AuthConfigService).get("AUTH0_M2M_DOMAIN");

  afterEach(() => {
    nock.cleanAll();
  });

  afterAll(() => {
    vi.unstubAllEnvs();
  });

  describe("POST /v1/auth/signup", () => {
    it("returns 204 when the captcha passes and auth0 creates the user", async () => {
      const { email, password, captchaToken, turnstileRequestBodies, auth0CreateUserScope } = setup({
        auth0CreateUserResponse: { status: 201, body: { user_id: "auth0|created" } }
      });

      const response = await signup({ email, password, captchaToken });

      expect(response.status).toBe(204);
      expect(turnstileRequestBodies).toEqual([expect.objectContaining({ secret: TURNSTILE_SECRET_KEY, response: captchaToken })]);
      expect(auth0CreateUserScope.isDone()).toBe(true);
    });

    it("returns 400 with the captcha error code without creating the user when turnstile refuses the token", async () => {
      const { email, password, captchaToken, auth0CreateUserScope } = setup({
        turnstileResponse: { success: false, "error-codes": ["invalid-input-response"] },
        auth0CreateUserResponse: { status: 201, body: { user_id: "auth0|created" } }
      });

      const response = await signup({ email, password, captchaToken });

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({
        message: "Captcha verification failed. Please try again.",
        code: "captcha_verification_failed"
      });
      expect(auth0CreateUserScope.isDone()).toBe(false);
    });

    it("returns 400 with the captcha error code without creating the user when the captcha token is missing", async () => {
      const { email, password, auth0CreateUserScope } = setup({
        auth0CreateUserResponse: { status: 201, body: { user_id: "auth0|created" } }
      });

      const response = await signup({ email, password });

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({ code: "captcha_verification_failed" });
      expect(auth0CreateUserScope.isDone()).toBe(false);
    });

    it("returns 422 without confirming the email when auth0 reports the user already exists", async () => {
      const { email, password, captchaToken } = setup({
        auth0CreateUserResponse: {
          status: 409,
          body: { statusCode: 409, error: "Conflict", message: "The user already exists.", errorCode: "auth0_idp_error" }
        }
      });

      const response = await signup({ email, password, captchaToken });

      expect(response.status).toBe(422);
      await expect(response.json()).resolves.toMatchObject({
        message: "Unable to create account. Please try again or use a different email."
      });
    });

    it("returns 400 with auth0's message when auth0 rejects the password", async () => {
      const { email, password, captchaToken } = setup({
        auth0CreateUserResponse: {
          status: 400,
          body: { statusCode: 400, error: "Bad Request", message: "PasswordStrengthError: Password is too weak", errorCode: "invalid_body" }
        }
      });

      const response = await signup({ email, password, captchaToken });

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({ message: "PasswordStrengthError: Password is too weak" });
    });

    it("returns 502 without echoing auth0's message when auth0 is unavailable", async () => {
      const { email, password, captchaToken } = setup({
        auth0CreateUserResponse: {
          status: 503,
          body: { statusCode: 503, error: "Service Unavailable", message: "Service temporarily unavailable" }
        }
      });

      const response = await signup({ email, password, captchaToken });

      expect(response.status).toBe(502);
      await expect(response.json()).resolves.toMatchObject({ message: "Unable to create the account right now. Please try again." });
    });
  });

  function signup(body: { email: string; password: string; captchaToken?: string }) {
    return app.request("/v1/auth/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });
  }

  function setup(input: {
    auth0CreateUserResponse: { status: number; body: Record<string, unknown> };
    turnstileResponse?: { success: boolean; "error-codes"?: string[] };
  }) {
    const captchaToken = "functional-test-captcha-token";

    const turnstileRequestBodies: Record<string, unknown>[] = [];

    nock("https://challenges.cloudflare.com")
      .post("/turnstile/v0/siteverify", body => turnstileRequestBodies.push(body) > 0)
      .reply(200, input.turnstileResponse ?? { success: true });

    nock(`https://${auth0Domain}`)
      .persist()
      .post("/oauth/token")
      .reply(200, { access_token: "test-management-token", expires_in: 86400, token_type: "Bearer" });

    const auth0CreateUserScope = nock(`https://${auth0Domain}`)
      .post("/api/v2/users")
      .reply(input.auth0CreateUserResponse.status, input.auth0CreateUserResponse.body);

    return { email: "signup-test@example.com", password: "StrongPassword123!", captchaToken, turnstileRequestBodies, auth0CreateUserScope };
  }
});
