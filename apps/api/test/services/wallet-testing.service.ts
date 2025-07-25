import type { Hono } from "hono";
import { decode } from "jsonwebtoken";

export class WalletTestingService {
  constructor(private readonly app: Hono) {}

  async createUserAndWallet() {
    const { user, token } = await this.createRegisteredUser();
    const walletResponse = await this.app.request("/v1/start-trial", {
      method: "POST",
      body: JSON.stringify({
        data: { userId: user.id }
      }),
      headers: new Headers({ "Content-Type": "application/json", authorization: `Bearer ${token}` })
    });
    const { data: wallet } = (await walletResponse.json()) as any;

    return { user, token, wallet };
  }

  async createAnonymousUserAndWallet() {
    const { user, token } = await this.createUser();
    const walletResponse = await this.app.request("/v1/start-trial", {
      method: "POST",
      body: JSON.stringify({
        data: { userId: user.id }
      }),
      headers: new Headers({ "Content-Type": "application/json", authorization: `Bearer ${token}` })
    });
    const { data: wallet } = (await walletResponse.json()) as any;

    return { user, token, wallet };
  }

  async createUser() {
    const userResponse = await this.app.request("/v1/anonymous-users", {
      method: "POST",
      headers: new Headers({ "Content-Type": "application/json" })
    });
    const { data: user, token } = (await userResponse.json()) as any;

    return { user, token };
  }

  /**
   * Creates a registered user and returns the user and token.
   * Specify the user code to use for the user.
   * "debug" will create a user with the email "dev@example.com" and the nickname "dev".
   * "debug1" will create a user with the email "dev1@example.com" and the nickname "dev1".
   * "debug2" through "debug20" will create users with corresponding emails and nicknames.
   * This is setup in the docker-compose.dev.yml file.
   * @param userCode - The user code to use for the user.
   * @returns The user and token.
   */
  async createRegisteredUser(userCode: string = "debug") {
    const tokenResponse = await fetch("http://localhost:8080/default/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: `grant_type=authorization_code&code=${userCode}&client_id=debug-client&code_verifier=abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMN123456`
    });

    const tokenData = (await tokenResponse.json()) as { access_token: string };
    const { access_token } = tokenData;
    const decoded = decode(access_token) as { sub: string; email: string; nickname: string; email_verified: boolean };

    const userResponse = await this.app.request(`/user/tokenInfo`, {
      method: "POST",
      headers: new Headers({
        "Content-Type": "application/json",
        Authorization: `Bearer ${access_token}`
      }),
      body: JSON.stringify({
        wantedUsername: decoded.nickname,
        email: decoded.email,
        emailVerified: decoded.email_verified,
        subscribedToNewsletter: false
      })
    });

    return { user: (await userResponse.json()) as any, token: access_token };
  }

  async getWalletByUserId(userId: string, token: string): Promise<{ id: number; address: string; creditAmount: number }> {
    const walletResponse = await this.app.request(`/v1/wallets?userId=${userId}`, {
      headers: new Headers({ "Content-Type": "application/json", authorization: `Bearer ${token}` })
    });
    const { data } = (await walletResponse.json()) as any;

    return data[0];
  }
}
