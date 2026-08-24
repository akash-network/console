import nock from "nock";
import { container } from "tsyringe";
import { afterEach, describe, expect, it } from "vitest";

import { AuthConfigService } from "@src/auth/services/auth-config/auth-config.service";
import { app } from "@src/rest-app";

describe("Signup", () => {
  const auth0Domain = container.resolve(AuthConfigService).get("AUTH0_M2M_DOMAIN");

  afterEach(() => {
    nock.cleanAll();
  });

  describe("POST /v1/auth/signup", () => {
    it("returns 204 when auth0 creates the user", async () => {
      const { email, password } = setup({ status: 201, body: { user_id: "auth0|created" } });

      const response = await signup({ email, password });

      expect(response.status).toBe(204);
    });

    it("returns 422 without confirming the email when auth0 reports the user already exists", async () => {
      const { email, password } = setup({
        status: 409,
        body: { statusCode: 409, error: "Conflict", message: "The user already exists.", errorCode: "auth0_idp_error" }
      });

      const response = await signup({ email, password });

      expect(response.status).toBe(422);
      await expect(response.json()).resolves.toMatchObject({
        message: "Unable to create account. Please try again or use a different email."
      });
    });

    it("returns 400 with auth0's message when auth0 rejects the password", async () => {
      const { email, password } = setup({
        status: 400,
        body: { statusCode: 400, error: "Bad Request", message: "PasswordStrengthError: Password is too weak", errorCode: "invalid_body" }
      });

      const response = await signup({ email, password });

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({ message: "PasswordStrengthError: Password is too weak" });
    });

    it("returns 502 without echoing auth0's message when auth0 is unavailable", async () => {
      const { email, password } = setup({
        status: 503,
        body: { statusCode: 503, error: "Service Unavailable", message: "Service temporarily unavailable" }
      });

      const response = await signup({ email, password });

      expect(response.status).toBe(502);
      await expect(response.json()).resolves.toMatchObject({ message: "Unable to create the account right now. Please try again." });
    });
  });

  function signup(body: { email: string; password: string }) {
    return app.request("/v1/auth/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });
  }

  function setup(auth0CreateUserResponse: { status: number; body: Record<string, unknown> }) {
    nock(`https://${auth0Domain}`)
      .persist()
      .post("/oauth/token")
      .reply(200, { access_token: "test-management-token", expires_in: 86400, token_type: "Bearer" });

    nock(`https://${auth0Domain}`).post("/api/v2/users").reply(auth0CreateUserResponse.status, auth0CreateUserResponse.body);

    return { email: "signup-test@example.com", password: "StrongPassword123!" };
  }
});
