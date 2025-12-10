import type { HttpClient } from "@akashnetwork/http-sdk";
import { Session } from "@auth0/nextjs-auth0";
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

  async signIn(input: { email: string; password: string }): Promise<Result<Session, { message: string; code: string }>> {
    const result = await this.#signInOnProvider(input);
    if (result.ok) {
      const session = result.val;
      const userSettings = await this.getLocalUserDetails(session);

      session.user = { ...session.user, ...userSettings };
      return Ok(session);
    }

    return result;
  }

  async #signInOnProvider(input: { email: string; password: string }): Promise<Result<Session, { message: string; code: string }>> {
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
        code: "invalid_credentials"
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
        code: "invalid_credentials"
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

  async signUp(input: { email: string; password: string }): Promise<Result<Session, { message: string; code: string }>> {
    const oauthIssuerUrl = new URL(this.#config.ISSUER_BASE_URL);

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
          code: "invalid_password"
        });
      }

      return Err({
        message: signupResponse.data.message || signupResponse.data.description || "Signup failed",
        code: "signup_failed"
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

    return result;
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
