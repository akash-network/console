import type { AxiosResponse } from "axios";
import axios from "axios";

class GitHubAuth {
  private tokenUrl: string;
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string | undefined;

  constructor(clientId: string, clientSecret: string, redirectUri?: string) {
    this.tokenUrl = "https://github.com/login/oauth/access_token";
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.redirectUri = redirectUri;
  }

  async exchangeAuthorizationCodeForToken(authorizationCode: string): Promise<string> {
    try {
      const response: AxiosResponse = await axios.post(this.tokenUrl, {
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code: authorizationCode,
        redirect_uri: this.redirectUri
      });

      const params = new URLSearchParams(response.data);
      const accessToken = params.get("access_token");
      return accessToken as string;
    } catch (error: any) {
      throw new Error(error);
    }
  }
}

export default GitHubAuth;
