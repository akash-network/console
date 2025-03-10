import { AuthzHttpService } from "@akashnetwork/http-sdk";
import { faker } from "@faker-js/faker";
import { eq } from "drizzle-orm";
import { container } from "tsyringe";

import { app } from "@src/app";
import { BILLING_CONFIG, BillingConfig } from "@src/billing/providers";
import { resolveWallet } from "@src/billing/providers/wallet.provider";
import { ApiPgDatabase, POSTGRES_DB, resolveTable } from "@src/core";

jest.setTimeout(20000);

describe("start trial", () => {
  const userWalletsTable = resolveTable("UserWallets");
  const config = container.resolve<BillingConfig>(BILLING_CONFIG);
  const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);
  const userWalletsQuery = db.query.UserWallets;
  const authzHttpService = container.resolve(AuthzHttpService);

  describe("POST /v1/start-trial", () => {
    it("should create a wallet for a user", async () => {
      const userResponse = await app.request("/v1/anonymous-users", {
        method: "POST",
        headers: new Headers({ "Content-Type": "application/json" })
      });
      const {
        data: { id: userId },
        token
      } = await userResponse.json();
      const headers = new Headers({ "Content-Type": "application/json", authorization: `Bearer ${token}` });
      const createWalletResponse = await app.request("/v1/start-trial", {
        method: "POST",
        body: JSON.stringify({ data: { userId } }),
        headers
      });
      const getWalletsResponse = await app.request(`/v1/wallets?userId=${userId}`, { headers });
      const userWallet = await userWalletsQuery.findFirst({ where: eq(userWalletsTable.userId, userId) });
      const masterWalletAddress = await resolveWallet("MANAGED").getFirstAddress();
      const allowances = await Promise.all([
        authzHttpService.getValidDepositDeploymentGrantsForGranterAndGrantee(masterWalletAddress, userWallet.address),
        authzHttpService.getValidFeeAllowancesForGrantee(userWallet.address)
      ]);

      expect(createWalletResponse.status).toBe(200);
      expect(getWalletsResponse.status).toBe(200);
      expect(await createWalletResponse.json()).toMatchObject({
        data: {
          id: expect.any(Number),
          userId,
          creditAmount: expect.any(Number),
          address: expect.any(String),
          isTrialing: true
        }
      });
      expect(await getWalletsResponse.json()).toMatchObject({
        data: [
          {
            id: expect.any(Number),
            userId,
            creditAmount: expect.any(Number),
            address: expect.any(String),
            isTrialing: true
          }
        ]
      });
      expect(userWallet).toMatchObject({
        id: expect.any(Number),
        userId,
        address: expect.any(String),
        deploymentAllowance: `${config.TRIAL_DEPLOYMENT_ALLOWANCE_AMOUNT}.00`,
        feeAllowance: `${config.TRIAL_FEES_ALLOWANCE_AMOUNT}.00`,
        isTrialing: true
      });
      expect(allowances).toMatchObject([
        {
          authorization: {
            "@type": "/akash.deployment.v1beta3.DepositDeploymentAuthorization",
            spend_limit: { denom: config.DEPLOYMENT_GRANT_DENOM, amount: String(config.TRIAL_DEPLOYMENT_ALLOWANCE_AMOUNT) }
          },
          expiration: expect.any(String)
        },
        [
          {
            granter: expect.any(String),
            grantee: userWallet.address,
            allowance: {
              "@type": "/cosmos.feegrant.v1beta1.BasicAllowance",
              spend_limit: [{ denom: "uakt", amount: String(config.TRIAL_FEES_ALLOWANCE_AMOUNT) }],
              expiration: expect.any(String)
            }
          }
        ]
      ]);
    });

    it("should throw 401 provided no auth header ", async () => {
      const createWalletResponse = await app.request("/v1/start-trial", {
        method: "POST",
        body: JSON.stringify({ data: { userId: faker.string.uuid() } }),
        headers: new Headers({ "Content-Type": "application/json" })
      });

      expect(createWalletResponse.status).toBe(401);
      expect(await createWalletResponse.json()).toMatchObject({ error: "UnauthorizedError", message: "Unauthorized" });
    });
  });

  describe("GET /v1/wallets", () => {
    it("should throw 401 provided no auth header ", async () => {
      const getWalletsResponse = await app.request(`/v1/wallets?userId=${faker.string.uuid()}`);

      expect(getWalletsResponse.status).toBe(401);
      expect(await getWalletsResponse.json()).toMatchObject({ error: "UnauthorizedError", message: "Unauthorized" });
    });
  });
});
