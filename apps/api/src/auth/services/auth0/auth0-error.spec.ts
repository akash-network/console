import { ManagementApiError, ManagementClient, ResponseError } from "auth0";
import nock from "nock";
import { afterEach, describe, expect, it } from "vitest";

import type { Auth0ApiError } from "./auth0-error";
import { extractAuth0ErrorMessage, isAuth0ApiError } from "./auth0-error";

describe("isAuth0ApiError", () => {
  it("accepts the ManagementApiError the management client throws for a JSON error body", () => {
    const { managementApiError } = setup();

    expect(isAuth0ApiError(managementApiError)).toBe(true);
  });

  it("accepts the ResponseError the management client falls back to for a non-JSON error body", () => {
    const { responseError } = setup();

    expect(isAuth0ApiError(responseError)).toBe(true);
  });

  it("rejects an error without a status code", () => {
    expect(isAuth0ApiError(new Error("Network failure"))).toBe(false);
  });

  it("rejects a non-error object carrying a status code", () => {
    expect(isAuth0ApiError({ statusCode: 409, body: "{}" })).toBe(false);
  });

  it("rejects nullish values", () => {
    expect(isAuth0ApiError(null)).toBe(false);
    expect(isAuth0ApiError(undefined)).toBe(false);
  });

  function setup() {
    const body = JSON.stringify({ statusCode: 409, error: "Conflict", message: "The user already exists.", errorCode: "auth0_idp_error" });

    return {
      managementApiError: new ManagementApiError("auth0_idp_error", "Conflict", 409, body, new Headers(), "The user already exists."),
      responseError: new ResponseError(409, body, new Headers(), "Response returned an error code")
    };
  }
});

describe("extractAuth0ErrorMessage", () => {
  it("returns the message from a JSON body", () => {
    const error = new ResponseError(400, JSON.stringify({ message: "PasswordStrengthError: Password is too weak" }), new Headers(), "Generic");

    expect(extractAuth0ErrorMessage(error)).toBe("PasswordStrengthError: Password is too weak");
  });

  it("falls back to the error message when the body is not JSON", () => {
    const error = new ResponseError(502, "<html>Bad Gateway</html>", new Headers(), "Response returned an error code");

    expect(extractAuth0ErrorMessage(error)).toBe("Response returned an error code");
  });

  it("falls back to the error message when the JSON body carries no message", () => {
    const error = new ResponseError(400, JSON.stringify({ errorCode: "invalid_body" }), new Headers(), "Response returned an error code");

    expect(extractAuth0ErrorMessage(error)).toBe("Response returned an error code");
  });
});

describe("management client error contract", () => {
  afterEach(() => {
    nock.cleanAll();
  });

  it("recognises the error the management client actually throws for a conflict", async () => {
    const { client } = setup({
      status: 409,
      body: { statusCode: 409, error: "Conflict", message: "The user already exists.", errorCode: "auth0_idp_error" }
    });

    const error = await client.users
      .create({ email: "user@example.com", password: "StrongPassword123!", connection: "Username-Password-Authentication" })
      .catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(ManagementApiError);
    expect(error).not.toBeInstanceOf(ResponseError);
    expect(isAuth0ApiError(error)).toBe(true);
    expect((error as Auth0ApiError).statusCode).toBe(409);
  });

  it("recognises the error the management client falls back to for an unparseable body", async () => {
    const { client } = setup({ status: 409, body: "<html>Conflict</html>" });

    const error = await client.users
      .create({ email: "user@example.com", password: "StrongPassword123!", connection: "Username-Password-Authentication" })
      .catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(ResponseError);
    expect(isAuth0ApiError(error)).toBe(true);
    expect((error as Auth0ApiError).statusCode).toBe(409);
  });

  function setup(createUserResponse: { status: number; body: Record<string, unknown> | string }) {
    const domain = "unit-test.auth0.local";

    nock(`https://${domain}`).post("/oauth/token").reply(200, { access_token: "test-token", expires_in: 86400, token_type: "Bearer" });
    nock(`https://${domain}`).post("/api/v2/users").reply(createUserResponse.status, createUserResponse.body);

    return { client: new ManagementClient({ domain, clientId: "test-client-id", clientSecret: "test-client-secret" }) };
  }
});
