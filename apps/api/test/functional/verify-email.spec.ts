import type { ApiResponse, GetUsers200ResponseOneOfInner } from "auth0";
import { ManagementClient } from "auth0";
import { container } from "tsyringe";

import { Auth0Service } from "@src/auth/services/auth0/auth0.service";
import { UserAuthTokenService } from "@src/auth/services/user-auth-token/user-auth-token.service";
import { app } from "@src/rest-app";
import { UserRepository } from "@src/user/repositories";

import { WalletTestingService } from "@test/services/wallet-testing.service";

jest.setTimeout(30000);

describe("Syncing 'email verified' from auth0", () => {
  describe("POST /v1/verify-email", () => {
    it("sets emailVerified to true when Auth0 responds with email_verified=true", async () => {
      const { user, token } = await setup({ emailVerified: true });

      const response = await app.request("/v1/verify-email", {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json"
        },
        body: JSON.stringify({
          data: {
            email: user.email
          }
        })
      });

      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result).toMatchObject({
        data: {
          emailVerified: true
        }
      });

      await expectVerified(token, true);
    });

    it("sets emailVerified to false when Auth0 responds with email_verified=false", async () => {
      const { user, token } = await setup({ emailVerified: false });

      const response = await app.request("/v1/verify-email", {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json"
        },
        body: JSON.stringify({
          data: {
            email: user.email
          }
        })
      });

      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result).toMatchObject({
        data: {
          emailVerified: false
        }
      });

      await expectVerified(token, false);
    });

    it("throws 404 when user is not found in auth0", async () => {
      const { user, token } = await setup({ emailVerified: false });
      const auth0Service = container.resolve(Auth0Service);
      jest.spyOn(auth0Service, "getUserByEmail").mockResolvedValueOnce(null);

      const response = await app.request("/v1/verify-email", {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json"
        },
        body: JSON.stringify({
          data: {
            email: user.email
          }
        })
      });

      expect(response.status).toBe(404);
    });

    it("throws 404 when user is not registered", async () => {
      const { user, token } = await setup({ emailVerified: false });
      const userRepository = await container.resolve(UserRepository);
      await userRepository.deleteById(user.id);

      const response = await app.request("/v1/verify-email", {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json"
        },
        body: JSON.stringify({
          data: {
            email: user.email
          }
        })
      });

      expect(response.status).toBe(404);
    });
  });

  async function setup(input: { emailVerified: boolean }) {
    const walletTestingService = new WalletTestingService(app);
    const { user, token } = await walletTestingService.createRegisteredUser({
      email_verified: input.emailVerified
    });

    const managementClient = container.resolve(ManagementClient);
    jest.spyOn(managementClient.usersByEmail, "getByEmail").mockResolvedValueOnce({
      data: [
        {
          user_id: user.userId,
          email_verified: input.emailVerified
        }
      ]
    } as ApiResponse<GetUsers200ResponseOneOfInner[]>);

    const userAuthTokenService = container.resolve(UserAuthTokenService);
    jest.spyOn(userAuthTokenService, "getValidUserId").mockResolvedValue(user.userId);

    return { user, token };
  }

  async function expectVerified(token: string, emailVerified: boolean) {
    const currentUserResponse = await app.request("/v1/user/me", {
      method: "GET",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json"
      }
    });
    const body = (await currentUserResponse.json()) as { data: { emailVerified: boolean } };

    expect(body.data.emailVerified).toBe(emailVerified);
  }
});
