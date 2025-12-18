import type { HttpClient } from "@akashnetwork/http-sdk";
import { Session } from "@auth0/nextjs-auth0";
import type { AxiosResponse } from "axios";
import type { Result } from "ts-results";
import { Err, Ok } from "ts-results";

import type { UserSettings } from "@src/types/user";
import { fromBase64Url } from "../../utils/encoding";

export class SessionService {
  readonly #externalHttpClient: HttpClient;
  readonly #consoleApiHttpClient: HttpClient;
  readonly #config: OauthConfig;

  constructor(externalHttpClient: HttpClient, consoleApiHttpClient: HttpClient, config: OauthConfig) {
    this.#externalHttpClient = externalHttpClient;
    this.#consoleApiHttpClient = consoleApiHttpClient;
    this.#config = config;
  }

  async signIn(input: { email: string; password: string }): Promise<Result<Session, { message: string; code: string; cause: unknown }>> {
    const result = await this.#signInOnProvider(input);
    if (result.ok) {
      const session = result.val;
      const userSettings = await this.getLocalUserDetails(session);

      session.user = { ...session.user, ...userSettings };
      return Ok(session);
    }

    return result;
  }

  async #signInOnProvider(input: {
    email: string;
    password: string;
  }): Promise<Result<Session, { code: "invalid_credentials"; message: string; cause: unknown }>> {
    const oauthIssuerUrl = new URL(this.#config.ISSUER_BASE_URL);

    const tokenResponse = await this.#externalHttpClient.post(
      `${oauthIssuerUrl.origin}/oauth/token`,
      {
        grant_type: "http://auth0.com/oauth/grant-type/password-realm",
        username: input.email,
        password: input.password,
        client_id: this.#config.CLIENT_ID,
        client_secret: this.#config.CLIENT_SECRET,
        realm: "Username-Password-Authentication",
        scope: "openid profile email offline_access",
        audience: this.#config.AUDIENCE || undefined
      },
      {
        validateStatus: notServerError
      }
    );

    if (tokenResponse.status >= 400) {
      return Err({
        message: tokenResponse.data.error_description || "Authentication failed",
        code: "invalid_credentials",
        cause: extractResponseDetails(tokenResponse)
      });
    }

    const userInfoResponse = await this.#externalHttpClient.get(`${oauthIssuerUrl.origin}/userinfo`, {
      headers: {
        Authorization: `Bearer ${tokenResponse.data.access_token}`
      },
      validateStatus: notServerError
    });

    if (userInfoResponse.status >= 400) {
      return Err({
        message: userInfoResponse.data.error_description || "Authentication failed",
        code: "invalid_credentials",
        cause: extractResponseDetails(userInfoResponse)
      });
    }

    const { id_token, access_token, scope, expires_in, expires_at, refresh_token, ...remainder } = tokenResponse.data;
    const claims = getClaimsFromToken(id_token);
    const session = Object.assign(
      new Session(claims),
      {
        accessToken: tokenResponse.data.access_token,
        accessTokenScope: scope,
        accessTokenExpiresAt: Math.floor(Date.now() / 1000) + Number(expires_in),
        refreshToken: refresh_token,
        idToken: id_token
      },
      remainder
    );

    return Ok(session);
  }

  async signUp(input: {
    email: string;
    password: string;
  }): Promise<
    Result<
      Session,
      | { code: "invalid_password"; message: string; policy: string; cause: unknown }
      | { code: "user_exists"; message: string; cause: unknown }
      | { code: "signup_failed"; message: string; cause: unknown }
    >
  > {
    const oauthIssuerUrl = new URL(this.#config.ISSUER_BASE_URL);

    // https://auth0.com/docs/api/authentication/signup/create-a-new-user
    const signupResponse = await this.#externalHttpClient.post(
      `${oauthIssuerUrl.origin}/dbconnections/signup`,
      {
        client_id: this.#config.CLIENT_ID,
        email: input.email,
        password: input.password,
        connection: "Username-Password-Authentication"
      },
      {
        validateStatus: notServerError
      }
    );

    if (signupResponse.status >= 400) {
      if (signupResponse.data.code === "invalid_password" && signupResponse.data.policy) {
        return Err({
          message: signupResponse.data.message || signupResponse.data.description || "Password violates policy",
          code: "invalid_password",
          policy: signupResponse.data.policy,
          cause: extractResponseDetails(signupResponse)
        });
      }

      if (signupResponse.status === 409 || (signupResponse.status === 400 && signupResponse.data.code === "invalid_signup")) {
        return Err({
          message: signupResponse.data.message || signupResponse.data.description || "Such user already exists",
          code: "user_exists",
          cause: extractResponseDetails(signupResponse)
        });
      }

      return Err({
        message: signupResponse.data.message || signupResponse.data.description || "Signup failed",
        code: "signup_failed",
        cause: extractResponseDetails(signupResponse)
      });
    }

    const result = await this.#signInOnProvider({
      email: input.email,
      password: input.password
    });

    if (result.ok) {
      const session = result.val;
      const userSettings = await this.createLocalUser(result.val);
      session.user = { ...session.user, ...userSettings };
      return Ok(session);
    }

    return Err({
      code: "signup_failed",
      message: result.val.message,
      cause: result.val
    });
  }

  /**
   * This method calls idempotent API call to create a local user in the database.
   */
  async createLocalUser(session: Session): Promise<UserSettings> {
    const user_metadata = session.user["https://console.akash.network/user_metadata"];
    const headers: Record<string, string> = {
      Authorization: `Bearer ${session.accessToken}`
    };

    const userSettings = await this.#consoleApiHttpClient.post<{ data: UserSettings }>(
      "/v1/register-user",
      {
        wantedUsername: session.user.nickname,
        email: session.user.email,
        emailVerified: session.user.email_verified,
        subscribedToNewsletter: user_metadata?.subscribedToNewsletter === "true"
      },
      {
        headers
      }
    );

    return userSettings.data.data;
  }

  async getLocalUserDetails(session: Session): Promise<UserSettings> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${session.accessToken}`
    };
    const response = await this.#consoleApiHttpClient.get<{ data: UserSettings }>("/v1/user/me", { headers });
    return response.data.data;
  }

  async sendPasswordResetEmail(input: {
    email: string;
  }): Promise<Result<void, { code: "too_many_requests"; message: string; retryAfter: number } | { code: "unknown"; message: string; cause: unknown }>> {
    const oauthIssuerUrl = new URL(this.#config.ISSUER_BASE_URL);

    const auth0Response = await this.#externalHttpClient.post(
      `${oauthIssuerUrl.origin}/dbconnections/change_password`,
      {
        client_id: this.#config.CLIENT_ID,
        email: input.email.trim(),
        connection: "Username-Password-Authentication"
      },
      {
        validateStatus: notServerError
      }
    );

    if (auth0Response.status === 429) {
      return Err({
        message: "Too many requests. Please try again later.",
        code: "too_many_requests",
        retryAfter: parseInt(auth0Response.headers["x-ratelimit-reset"] || "0", 10)
      });
    }

    if (auth0Response.status !== 200) {
      return Err({ message: "Cannot send password reset email.", code: "unknown", cause: extractResponseDetails(auth0Response) });
    }

    return Ok(undefined);
  }
}

export interface OauthConfig {
  ISSUER_BASE_URL: string;
  CLIENT_ID: string;
  CLIENT_SECRET: string;
  AUDIENCE: string;
}

function notServerError(status: number) {
  return status >= 200 && status < 500;
}

const IDENTITY_CLAIM_FILTER = new Set(["aud", "iss", "iat", "exp", "nbf", "nonce", "azp", "auth_time", "s_hash", "at_hash", "c_hash"]);
const decoder = new TextDecoder("utf-8");

function getClaimsFromToken(token: string) {
  const stringifiedClaims = decoder.decode(fromBase64Url(token.split(".").at(1) || ""));
  const claims = JSON.parse(stringifiedClaims, (key, value) => {
    if (IDENTITY_CLAIM_FILTER.has(key)) return undefined;
    return value;
  });
  return claims;
}

function extractResponseDetails(response: AxiosResponse) {
  return {
    url: response.config?.url,
    method: response.config?.method,
    status: response.status,
    data: response.data
  };
}
