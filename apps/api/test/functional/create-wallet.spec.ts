import { eq } from "drizzle-orm";
import { container } from "tsyringe";

import { app } from "@src/app";
import { BILLING_CONFIG, BillingConfig, USER_WALLET_SCHEMA, UserWalletSchema } from "@src/billing/providers";
import { ApiPgDatabase, POSTGRES_DB } from "@src/core";
import { USER_SCHEMA, UserSchema } from "@src/user/providers";

jest.setTimeout(10000);

describe("wallets", () => {
  const userWalletSchema = container.resolve<UserWalletSchema>(USER_WALLET_SCHEMA);
  const userSchema = container.resolve<UserSchema>(USER_SCHEMA);
  const config = container.resolve<BillingConfig>(BILLING_CONFIG);
  const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);
  const userWalletsTable = db.query.userWalletSchema;

  afterEach(async () => {
    await Promise.all([db.delete(userWalletSchema), db.delete(userSchema)]);
  });

  describe("POST /v1/wallets", () => {
    it("should create a wallet for a user", async () => {
      const userResponse = await app.request("/v1/anonymous-users", {
        method: "POST",
        headers: new Headers({ "Content-Type": "application/json" })
      });
      const {
        data: { id: userId }
      } = await userResponse.json();
      const res = await app.request("/v1/wallets", {
        method: "POST",
        body: JSON.stringify({ data: { userId } }),
        headers: new Headers({ "Content-Type": "application/json" })
      });
      const userWallet = await userWalletsTable.findFirst({ where: eq(userWalletSchema.userId, userId) });

      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({
        data: {
          id: expect.any(Number),
          userId,
          creditAmount: expect.any(Number),
          address: expect.any(String)
        }
      });
      expect(userWallet).toMatchObject({
        id: expect.any(Number),
        userId,
        address: expect.any(String),
        deploymentAllowance: `${config.TRIAL_DEPLOYMENT_ALLOWANCE_AMOUNT}.00`,
        feeAllowance: `${config.TRIAL_FEES_ALLOWANCE_AMOUNT}.00`
      });
    });
  });
});
