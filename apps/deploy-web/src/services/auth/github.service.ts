import type { AxiosInstance, AxiosResponse } from "axios";

class GitHubAuth {
  private tokenUrl: string;
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string | undefined;
  private readonly httpClient: AxiosInstance;

  constructor(clientId: string, clientSecret: string, redirectUri: string | undefined, httpClient: AxiosInstance) {
    this.tokenUrl = "https://github.com/login/oauth/access_token";
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.redirectUri = redirectUri;
    this.httpClient = httpClient;
  }

  async exchangeAuthorizationCodeForToken(authorizationCode: string): Promise<string> {
    try {
      const response: AxiosResponse = await this.httpClient.post(this.tokenUrl, {
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code: authorizationCode,
        redirect_uri: this.redirectUri
      });

      const params = new URLSearchParams(response.data);
      const accessToken = params.get("access_token");
      return accessToken as string;
    } catch (error) {
      throw new Error("Failed to exchange authorization code for token", { cause: error });
    }
  }
}

export default GitHubAuth;
