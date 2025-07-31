import { faker } from "@faker-js/faker";
import type { Hono } from "hono";
import { decode } from "jsonwebtoken";
import { container } from "tsyringe";

import { AbilityService } from "@src/auth/services/ability/ability.service";
import { AuthService } from "@src/auth/services/auth.service";
import type { UserWalletOutput } from "@src/billing/repositories/user-wallet/user-wallet.repository";
import { WalletInitializerService } from "@src/billing/services";
import { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";

export class WalletTestingService<T extends Hono<any>> {
  constructor(private readonly app: T) {}

  async createUserAndWallet() {
    const { user, token } = await this.createRegisteredUser({
      username: faker.internet.displayName(),
      email: faker.internet.email(),
      email_verified: true,
      name: faker.person.fullName(),
      nickname: faker.person.firstName(),
      picture: faker.image.url(),
      updated_at: faker.date.recent().toISOString(),
      sub: faker.string.uuid()
    });
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

  /** @deprecated anonymous users will not be supported in the nearest future */
  async createAnonymousUserAndWallet() {
    const { user, token } = await this.createUser();
    return container.resolve(ExecutionContextService).runWithContext(async () => {
      container.resolve(AuthService).currentUser = user;
      container.resolve(AuthService).ability = container.resolve(AbilityService).getAbilityFor("REGULAR_ANONYMOUS_USER", user);
      const wallet = (await container.resolve(WalletInitializerService).initializeAndGrantTrialLimits(user.id)) as {
        [K in keyof UserWalletOutput]: NonNullable<UserWalletOutput[K]>;
      };

      return { user, token, wallet };
    });
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
   * @returns The user and token.
   */
  async createRegisteredUser(claims: {
    username: string;
    email: string;
    email_verified: boolean;
    name: string;
    nickname: string;
    picture: string;
    updated_at: string;
    sub: string;
  }) {
    const oauth2ServerUrl = "http://localhost:8080";
    const redirectUri = "http://localhost:8080/api";
    const requestParams = new URLSearchParams({
      client_id: "debug-client",
      scope: "openid profile email",
      response_type: "code",
      redirect_uri: redirectUri,
      audience: "my-audience",
      action: "signup",
      nonce: "9iicXKCPLq68WIm8DPexHa4j7-qLqRpWXkxbOBjgrQI"
    });
    const tokenResponse = await fetch(`${oauth2ServerUrl}/default/authorize?${requestParams}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      redirect: "manual",
      body: new URLSearchParams({
        username: claims.username,
        claims: JSON.stringify({
          sub: claims.sub,
          email: claims.email,
          email_verified: claims.email_verified,
          name: claims.name,
          nickname: claims.nickname,
          picture: claims.picture,
          updated_at: claims.updated_at
        })
      })
    });

    const redirectLocation = new URL(tokenResponse.headers.get("Location") ?? "");
    const code = redirectLocation.searchParams.get("code") || "";

    const result = await fetch(`${oauth2ServerUrl}/default/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: "debug-client",
        client_secret: "debug-client-secret"
      }).toString()
    });
    const { access_token } = (await result.json()) as {
      token_type: string;
      access_token: string;
      refresh_token: string;
      id_token: string;
      expires_in: number;
    };

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
