import type { AxiosInstance, AxiosResponse } from "axios";
import { URLSearchParams } from "url";

import type { GitProviderTokens } from "@src/types/remotedeploy";

interface Tokens {
  access_token: string;
  refresh_token: string;
}

class BitbucketAuth {
  private tokenUrl: string;
  private clientId: string;
  private clientSecret: string;
  private readonly httpClient: AxiosInstance;

  constructor(clientId: string, clientSecret: string, httpClient: AxiosInstance) {
    this.httpClient = httpClient;
    this.tokenUrl = "https://bitbucket.org/site/oauth2/access_token";
    this.clientId = clientId;
    this.clientSecret = clientSecret;
  }

  async exchangeAuthorizationCodeForTokens(authorizationCode: string): Promise<GitProviderTokens> {
    const params = new URLSearchParams();
    params.append("grant_type", "authorization_code");
    params.append("code", authorizationCode);

    const headers = {
      Authorization: `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded"
    };

    try {
      const response: AxiosResponse = await this.httpClient.post(this.tokenUrl, params.toString(), { headers });
      const { access_token, refresh_token }: Tokens = response.data;
      return {
        accessToken: access_token,
        refreshToken: refresh_token
      };
    } catch (error) {
      throw new Error("Failed to exchange authorization code for tokens", { cause: error });
    }
  }

  async refreshTokensUsingRefreshToken(refreshToken: string): Promise<GitProviderTokens> {
    const params = new URLSearchParams();
    params.append("grant_type", "refresh_token");
    params.append("refresh_token", refreshToken);

    const headers = {
      Authorization: `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded"
    };

    try {
      const response: AxiosResponse = await this.httpClient.post(this.tokenUrl, params.toString(), { headers });
      const { access_token, refresh_token }: Tokens = response.data;
      return {
        accessToken: access_token,
        refreshToken: refresh_token
      };
    } catch (error) {
      throw new Error("Failed to refresh tokens using refresh token", { cause: error });
    }
  }
}

export default BitbucketAuth;
