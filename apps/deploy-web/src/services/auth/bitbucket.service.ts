import axios, { AxiosResponse } from "axios";
import { URLSearchParams } from "url";

import { GitProviderTokens } from "@src/types/remotedeploy";

interface Tokens {
  access_token: string;
  refresh_token: string;
}

class BitbucketAuth {
  private tokenUrl: string;
  private clientId: string;
  private clientSecret: string;

  constructor(clientId: string, clientSecret: string) {
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
      const response: AxiosResponse = await axios.post(this.tokenUrl, params.toString(), { headers });
      const { access_token, refresh_token }: Tokens = response.data;
      return {
        accessToken: access_token,
        refreshToken: refresh_token
      };
    } catch (error) {
      throw new Error(error);
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
      const response: AxiosResponse = await axios.post(this.tokenUrl, params.toString(), { headers });
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

export default BitbucketAuth;
