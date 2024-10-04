import axios, { AxiosResponse } from "axios";

import { GitProviderTokens } from "@src/types/remotedeploy";
interface Tokens {
  access_token: string;
  refresh_token: string;
}

class GitlabAuth {
  private tokenUrl: string;
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string | undefined;

  constructor(clientId: string, clientSecret: string, redirectUri?: string) {
    this.tokenUrl = "https://gitlab.com/oauth/token";
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.redirectUri = redirectUri;
  }

  async exchangeAuthorizationCodeForTokens(authorizationCode: string): Promise<GitProviderTokens> {
    try {
      const response: AxiosResponse = await axios.post(this.tokenUrl, {
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
      throw new Error(error);
    }
  }

  async refreshTokensUsingRefreshToken(token: string): Promise<GitProviderTokens> {
    try {
      const response: AxiosResponse = await axios.post(this.tokenUrl, {
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: token,
        grant_type: "refreshToken"
      });

      const { access_token, refresh_token }: Tokens = response.data;
      return {
        accessToken: access_token,
        refreshToken: refresh_token
      };
    } catch (error) {
      throw new Error(error);
    }
  }
}

export default GitlabAuth;
