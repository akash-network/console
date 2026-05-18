import type { HttpClient } from "@akashnetwork/http-sdk";
import type { AxiosResponse } from "axios";
import type { Result } from "ts-results";
import { Err, Ok } from "ts-results";

import { Session } from "@src/lib/auth0";
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

  async signIn(input: { email: string; password: string }): Promise<Result<Session, { code: "invalid_credentials"; message: string; cause: unknown }>> {
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
  }): Promise<Result<Session, { code: "user_exists"; message: string; cause: unknown } | { code: "signup_failed"; message: string; cause: unknown }>> {
    const signupResponse = await this.#consoleApiHttpClient.post(
      "/v1/auth/signup",
      {
        email: input.email,
        password: input.password
      },
      {
        validateStatus: notServerError
      }
    );

    const isUserExists = signupResponse.status === 422;
    if (signupResponse.status >= 400 && !isUserExists) {
      return Err({
        message: signupResponse.data?.message || "Signup failed",
        code: "signup_failed",
        cause: extractResponseDetails(signupResponse)
      });
    }

    const result = await this.signIn({
      email: input.email,
      password: input.password
    });

    if (result.ok) {
      const session = result.val;
      const userSettings = await this.createLocalUser(result.val);
      session.user = { ...session.user, nickname: userSettings.username };
      return Ok(session);
    }

    if (isUserExists) {
      return Err({
        message: "Such user already exists but credentials are invalid",
        code: "user_exists",
        cause: extractResponseDetails(signupResponse)
      });
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

  async startEmailCode(input: {
    email: string;
  }): Promise<
    Result<
      void,
      | { code: "invalid_email"; message: string; cause: unknown }
      | { code: "rate_limited"; message: string; retryAfter: number; cause: unknown }
      | { code: "unknown"; message: string; cause: unknown }
    >
  > {
    const oauthIssuerUrl = new URL(this.#config.ISSUER_BASE_URL);

    const response = await this.#externalHttpClient.post(
      `${oauthIssuerUrl.origin}/passwordless/start`,
      {
        client_id: this.#config.CLIENT_ID,
        client_secret: this.#config.CLIENT_SECRET,
        connection: "email",
        email: input.email,
        send: "code"
      },
      { validateStatus: notServerError }
    );

    if (response.status >= 200 && response.status < 300) {
      return Ok(undefined);
    }

    if (response.status === 429) {
      return Err({
        code: "rate_limited",
        message: "Too many attempts. Please try again later.",
        retryAfter: retryAfterFromHeaders(response.headers),
        cause: extractResponseDetails(response)
      });
    }

    if (response.status === 400 && response.data?.error === "bad.email") {
      return Err({
        code: "invalid_email",
        message: response.data.error_description || "Invalid email.",
        cause: extractResponseDetails(response)
      });
    }

    return Err({
      code: "unknown",
      message: response.data?.error_description || "Unable to send code.",
      cause: extractResponseDetails(response)
    });
  }

  async verifyEmailCode(input: {
    email: string;
    code: string;
  }): Promise<
    Result<
      Session,
      | { code: "invalid_code"; message: string; cause: unknown }
      | { code: "rate_limited"; message: string; retryAfter: number; cause: unknown }
      | { code: "unknown"; message: string; cause: unknown }
    >
  > {
    const oauthIssuerUrl = new URL(this.#config.ISSUER_BASE_URL);

    const tokenResponse = await this.#externalHttpClient.post(
      `${oauthIssuerUrl.origin}/oauth/token`,
      {
        grant_type: "http://auth0.com/oauth/grant-type/passwordless/otp",
        client_id: this.#config.CLIENT_ID,
        client_secret: this.#config.CLIENT_SECRET,
        realm: "email",
        username: input.email,
        otp: input.code,
        scope: "openid profile email offline_access",
        audience: this.#config.AUDIENCE || undefined
      },
      { validateStatus: notServerError }
    );

    if (tokenResponse.status === 429) {
      return Err({
        code: "rate_limited",
        message: "Too many attempts. Please try again later.",
        retryAfter: retryAfterFromHeaders(tokenResponse.headers),
        cause: extractResponseDetails(tokenResponse)
      });
    }

    if (tokenResponse.status >= 400) {
      if (tokenResponse.data?.error === "invalid_grant") {
        return Err({
          code: "invalid_code",
          message: tokenResponse.data.error_description,
          cause: extractResponseDetails(tokenResponse)
        });
      }
      return Err({
        code: "unknown",
        message: tokenResponse.data?.error_description || "Verification failed.",
        cause: extractResponseDetails(tokenResponse)
      });
    }

    const { id_token, access_token, scope, expires_in, expires_at, refresh_token, ...remainder } = tokenResponse.data;
    const claims = getClaimsFromToken(id_token);
    const session = Object.assign(
      new Session(claims),
      {
        accessToken: access_token,
        accessTokenScope: scope,
        accessTokenExpiresAt: Math.floor(Date.now() / 1000) + Number(expires_in),
        refreshToken: refresh_token,
        idToken: id_token
      },
      remainder
    );

    return Ok(session);
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
        retryAfter: retryAfterFromHeaders(auth0Response.headers)
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

/** Auth0's `x-ratelimit-reset` is a Unix epoch timestamp; consumers want "seconds until retry". */
function retryAfterFromHeaders(headers: AxiosResponse["headers"]): number {
  const resetAt = parseInt(headers["x-ratelimit-reset"] || "0", 10);
  if (!Number.isFinite(resetAt) || resetAt <= 0) return 0;
  return Math.max(0, resetAt - Math.floor(Date.now() / 1000));
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
    data: response.data,
    headers: {
      "Content-Type": response.headers["content-type"],
      server: response.headers["server"]
    }
  };
}
