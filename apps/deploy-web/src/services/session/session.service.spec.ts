import type { HttpClient } from "@akashnetwork/http-sdk";
import type { Result } from "ts-results";
import { describe, expect, it, vi } from "vitest";
import { mock, type MockProxy } from "vitest-mock-extended";

import { Session } from "@src/lib/auth0";
import type { UserSettings } from "@src/types/user";
import { type OauthConfig, SessionService } from "./session.service";

const USER_METADATA_KEY = "https://console.akash.network/user_metadata" as const;

describe(SessionService.name, () => {
  describe("signIn", () => {
    it("authenticates user and returns session", async () => {
      const tokenPayload = {
        sub: "auth0|user-123",
        nickname: "TokenUser",
        email: "user@example.com",
        email_verified: true,
        [USER_METADATA_KEY]: {
          subscribedToNewsletter: "true"
        }
      };
      const idToken = createIdToken(tokenPayload);
      const tokenResponse = {
        status: 200,
        data: {
          access_token: "access-token",
          refresh_token: "refresh-token",
          id_token: idToken,
          scope: "openid profile email offline_access",
          expires_in: 3_600,
          token_type: "Bearer"
        }
      };
      const userInfoResponse = {
        status: 200,
        data: {}
      };
      const { service, externalHttpClient, config } = setup();

      externalHttpClient.post.mockResolvedValueOnce(tokenResponse);
      externalHttpClient.get.mockResolvedValueOnce(userInfoResponse);

      const result = await service.signIn({ email: "user@example.com", password: "password123" });

      expect(result.ok).toBe(true);
      const session = expectOk(result);

      expect(externalHttpClient.post).toHaveBeenCalledWith(
        `${new URL(config.ISSUER_BASE_URL).origin}/oauth/token`,
        {
          grant_type: "http://auth0.com/oauth/grant-type/password-realm",
          username: "user@example.com",
          password: "password123",
          client_id: config.CLIENT_ID,
          client_secret: config.CLIENT_SECRET,
          realm: "Username-Password-Authentication",
          scope: "openid profile email offline_access",
          audience: config.AUDIENCE
        },
        expect.objectContaining({ validateStatus: expect.any(Function) })
      );

      expect(session.accessToken).toBe(tokenResponse.data.access_token);
      expect(session.refreshToken).toBe(tokenResponse.data.refresh_token);
      expect(session.user.nickname).toBe(tokenPayload.nickname);
      expect(session.user.email).toBe(tokenPayload.email);
      expect(session.user[USER_METADATA_KEY]).toEqual(tokenPayload[USER_METADATA_KEY]);
    });

    it("returns error when authentication fails", async () => {
      const { service, externalHttpClient, consoleApiHttpClient, config } = setup();

      externalHttpClient.post.mockResolvedValueOnce({
        status: 401,
        data: { error_description: "Invalid credentials" },
        headers: {}
      });

      const result = await service.signIn({ email: "user@example.com", password: "wrong-password" });

      expect(result.ok).toBe(false);
      const error = expectErr(result);
      expect(error).toEqual(
        expect.objectContaining({
          message: "Invalid credentials",
          code: "invalid_credentials"
        })
      );
      expect(externalHttpClient.get).not.toHaveBeenCalled();
      expect(consoleApiHttpClient.get).not.toHaveBeenCalled();

      const tokenRequestUrl = `${new URL(config.ISSUER_BASE_URL).origin}/oauth/token`;
      expect(externalHttpClient.post).toHaveBeenCalledWith(
        tokenRequestUrl,
        expect.objectContaining({
          username: "user@example.com",
          password: "wrong-password"
        }),
        expect.objectContaining({ validateStatus: expect.any(Function) })
      );
    });
  });

  describe("signUp", () => {
    it("returns error when password violates policy", async () => {
      const { service, externalHttpClient, consoleApiHttpClient, config } = setup();

      externalHttpClient.post.mockResolvedValueOnce({
        status: 400,
        data: {
          code: "invalid_password",
          policy: "Password must contain at least 8 characters",
          message: "Password is too weak"
        },
        headers: {}
      });

      const result = await service.signUp({ email: "user@example.com", password: "weak" });

      expect(result.ok).toBe(false);
      const error = expectErr(result);
      expect(error).toEqual(
        expect.objectContaining({
          message: "Password is too weak",
          code: "invalid_password",
          policy: "Password must contain at least 8 characters"
        })
      );
      expect(externalHttpClient.post).toHaveBeenCalledTimes(1);
      expect(externalHttpClient.post).toHaveBeenCalledWith(
        `${new URL(config.ISSUER_BASE_URL).origin}/dbconnections/signup`,
        {
          client_id: config.CLIENT_ID,
          email: "user@example.com",
          password: "weak",
          connection: "Username-Password-Authentication"
        },
        expect.objectContaining({ validateStatus: expect.any(Function) })
      );
      expect(consoleApiHttpClient.post).not.toHaveBeenCalled();
      expect(externalHttpClient.get).not.toHaveBeenCalled();
    });

    it("returns friendly_message as error message when present", async () => {
      const { service, externalHttpClient, consoleApiHttpClient, config } = setup();

      externalHttpClient.post.mockResolvedValueOnce({
        status: 400,
        data: {
          friendly_message: "This is a user-friendly error message",
          message: "Technical error message",
          description: "Error description"
        },
        headers: {}
      });

      const result = await service.signUp({ email: "user@example.com", password: "Password123!" });

      expect(result.ok).toBe(false);
      const error = expectErr(result);
      expect(error).toEqual(
        expect.objectContaining({
          message: "This is a user-friendly error message",
          code: "signup_failed"
        })
      );
      expect(externalHttpClient.post).toHaveBeenCalledTimes(1);
      expect(externalHttpClient.post).toHaveBeenCalledWith(
        `${new URL(config.ISSUER_BASE_URL).origin}/dbconnections/signup`,
        {
          client_id: config.CLIENT_ID,
          email: "user@example.com",
          password: "Password123!",
          connection: "Username-Password-Authentication"
        },
        expect.objectContaining({ validateStatus: expect.any(Function) })
      );
      expect(consoleApiHttpClient.post).not.toHaveBeenCalled();
      expect(externalHttpClient.get).not.toHaveBeenCalled();
    });

    it("returns error when signup fails for other reasons", async () => {
      const { service, externalHttpClient, consoleApiHttpClient, config } = setup();

      externalHttpClient.post.mockResolvedValue({
        status: 409,
        data: {
          description: "User already exists"
        },
        headers: {}
      });

      const result = await service.signUp({ email: "user@example.com", password: "Password123!" });

      expect(result.ok).toBe(false);
      const error = expectErr(result);
      expect(error).toEqual(
        expect.objectContaining({
          message: "Such user already exists but credentials are invalid",
          code: "user_exists"
        })
      );
      expect(externalHttpClient.post).toHaveBeenCalledTimes(2);
      expect(externalHttpClient.post).toHaveBeenCalledWith(
        `${new URL(config.ISSUER_BASE_URL).origin}/dbconnections/signup`,
        {
          client_id: config.CLIENT_ID,
          email: "user@example.com",
          password: "Password123!",
          connection: "Username-Password-Authentication"
        },
        expect.objectContaining({ validateStatus: expect.any(Function) })
      );
      expect(consoleApiHttpClient.post).not.toHaveBeenCalled();
      expect(externalHttpClient.get).not.toHaveBeenCalled();
    });

    it("creates local user after successful signup", async () => {
      const email = "user@example.com";
      const password = "StrongPassword123!";
      const tokenPayload = {
        sub: "auth0|user-456",
        nickname: "TokenUser",
        email,
        email_verified: true,
        [USER_METADATA_KEY]: {
          subscribedToNewsletter: "true"
        }
      };
      const idToken = createIdToken(tokenPayload);
      const signupResponse = {
        status: 200,
        data: {},
        headers: {}
      };
      const tokenResponse = {
        status: 200,
        data: {
          access_token: "access-token",
          refresh_token: "refresh-token",
          id_token: idToken,
          scope: "openid profile email offline_access",
          expires_in: 3_600,
          token_type: "Bearer"
        },
        headers: {}
      };
      const userInfoResponse = {
        status: 200,
        data: {},
        headers: {}
      };
      const createdUser: UserSettings = {
        username: "registered-user",
        subscribedToNewsletter: true
      };

      const { service, externalHttpClient, consoleApiHttpClient, config } = setup();

      externalHttpClient.post.mockResolvedValueOnce(signupResponse);
      externalHttpClient.post.mockResolvedValueOnce(tokenResponse);
      externalHttpClient.get.mockResolvedValueOnce(userInfoResponse);
      consoleApiHttpClient.post.mockResolvedValueOnce({ data: { data: createdUser } });

      const result = await service.signUp({ email, password });

      expect(result.ok).toBe(true);
      const session = expectOk(result);

      expect(externalHttpClient.post).toHaveBeenNthCalledWith(
        1,
        `${new URL(config.ISSUER_BASE_URL).origin}/dbconnections/signup`,
        {
          client_id: config.CLIENT_ID,
          email,
          password,
          connection: "Username-Password-Authentication"
        },
        expect.objectContaining({ validateStatus: expect.any(Function) })
      );

      expect(externalHttpClient.post).toHaveBeenNthCalledWith(
        2,
        `${new URL(config.ISSUER_BASE_URL).origin}/oauth/token`,
        expect.objectContaining({
          username: email,
          password,
          audience: config.AUDIENCE
        }),
        expect.objectContaining({ validateStatus: expect.any(Function) })
      );

      expect(consoleApiHttpClient.post).toHaveBeenCalledWith(
        "/v1/register-user",
        {
          wantedUsername: tokenPayload.nickname,
          email,
          emailVerified: true,
          subscribedToNewsletter: true
        },
        {
          headers: { Authorization: `Bearer ${tokenResponse.data.access_token}` }
        }
      );
      expect(consoleApiHttpClient.get).not.toHaveBeenCalled();

      expect(session.accessToken).toBe(tokenResponse.data.access_token);
      expect(session.user.email).toBe(email);
      expect(session.user.nickname).toBe(createdUser.username);
      expect(session.user[USER_METADATA_KEY]).toEqual(tokenPayload[USER_METADATA_KEY]);
    });
  });

  describe("createLocalUser", () => {
    it("sends registration request with expected payload", async () => {
      const claims = {
        sub: "auth0|user-789",
        nickname: "PreferredName",
        email: "local@example.com",
        email_verified: true,
        [USER_METADATA_KEY]: {
          subscribedToNewsletter: "true"
        }
      };
      const session = new Session(claims);
      Object.assign(session, {
        accessToken: "local-access-token",
        user: { ...claims }
      });

      const expectedSettings: UserSettings = {
        username: "PreferredName",
        subscribedToNewsletter: true
      };

      const { service, consoleApiHttpClient } = setup();
      consoleApiHttpClient.post.mockResolvedValueOnce({ data: { data: expectedSettings } });

      const result = await service.createLocalUser(session);

      expect(consoleApiHttpClient.post).toHaveBeenCalledWith(
        "/v1/register-user",
        {
          wantedUsername: "PreferredName",
          email: "local@example.com",
          emailVerified: true,
          subscribedToNewsletter: true
        },
        {
          headers: { Authorization: "Bearer local-access-token" }
        }
      );
      expect(result).toEqual(expectedSettings);
    });
  });

  describe("getLocalUserDetails", () => {
    it("returns user settings from console api", async () => {
      const claims = {
        sub: "auth0|user-101",
        nickname: "ExistingUser",
        email: "existing@example.com",
        email_verified: true,
        [USER_METADATA_KEY]: {}
      };
      const session = new Session(claims);
      Object.assign(session, {
        accessToken: "details-access-token",
        user: { ...claims }
      });

      const userSettings: UserSettings = {
        username: "ExistingUser",
        subscribedToNewsletter: false
      };

      const { service, consoleApiHttpClient } = setup();
      consoleApiHttpClient.get.mockResolvedValueOnce({ data: { data: userSettings } });

      const result = await service.getLocalUserDetails(session);

      expect(consoleApiHttpClient.get).toHaveBeenCalledWith("/v1/user/me", {
        headers: { Authorization: "Bearer details-access-token" }
      });
      expect(result).toEqual(userSettings);
    });
  });

  function setup(input?: { externalHttpClient?: MockProxy<HttpClient>; consoleApiHttpClient?: MockProxy<HttpClient>; config?: OauthConfig }) {
    const externalHttpClient = input?.externalHttpClient ?? createHttpClientMock();
    const consoleApiHttpClient = input?.consoleApiHttpClient ?? createHttpClientMock();
    const config =
      input?.config ??
      ({
        ISSUER_BASE_URL: "https://auth.example.com",
        CLIENT_ID: "client-id",
        CLIENT_SECRET: "client-secret",
        AUDIENCE: "https://api.example.com"
      } satisfies OauthConfig);

    const service = new SessionService(externalHttpClient, consoleApiHttpClient, config);

    return { service, externalHttpClient, consoleApiHttpClient, config };
  }
});

function createHttpClientMock(): MockProxy<HttpClient> {
  return mock<HttpClient>({
    post: vi.fn(),
    get: vi.fn()
  } as unknown as HttpClient);
}

function createIdToken(payload: Record<string, unknown>) {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.signature`;
}

function expectOk<T, E>(result: Result<T, E>): T {
  if (!result.ok) {
    throw new Error("Expected Ok result but received Err");
  }
  return result.val;
}

function expectErr<T, E>(result: Result<T, E>): E {
  if (result.ok) {
    throw new Error("Expected Err result but received Ok");
  }
  return result.val;
}
