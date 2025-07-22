import type { AxiosInstance, AxiosResponse } from "axios";

import type { GitProviderTokens } from "@src/types/remotedeploy";
interface Tokens {
  access_token: string;
  refresh_token: string;
}

class GitlabAuth {
  private tokenUrl: string;
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string | undefined;
  private readonly httpClient: AxiosInstance;

  constructor(clientId: string, clientSecret: string, redirectUri: string | undefined, httpClient: AxiosInstance) {
    this.tokenUrl = "https://gitlab.com/oauth/token";
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.redirectUri = redirectUri;
    this.httpClient = httpClient;
  }

  async exchangeAuthorizationCodeForTokens(authorizationCode: string): Promise<GitProviderTokens> {
    try {
      const response: AxiosResponse = await this.httpClient.post(this.tokenUrl, {
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code: authorizationCode,
        redirect_uri: this.redirectUri,
        grant_type: "authorization_code"
      });

      const { access_token, refresh_token }: Tokens = response.data;
      return {
        accessToken: access_token,
        refreshToken: refresh_token
      };
    } catch (error) {
      throw new Error("Failed to exchange authorization code for tokens", { cause: error });
    }
  }

  async refreshTokensUsingRefreshToken(token: string): Promise<GitProviderTokens> {
    try {
      const response: AxiosResponse = await this.httpClient.post(this.tokenUrl, {
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: token,
        grant_type: "refresh_token"
      });

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

export default GitlabAuth;
