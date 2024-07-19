import { faker } from "@faker-js/faker";
import { eq } from "drizzle-orm";
import { container } from "tsyringe";

import { app } from "@src/app";
import { BILLING_CONFIG, BillingConfig, USER_WALLET_SCHEMA, UserWalletSchema } from "@src/billing/providers";
import { ApiPgDatabase, POSTGRES_DB } from "@src/core";

jest.setTimeout(10000);

describe("wallets", () => {
  const schema = container.resolve<UserWalletSchema>(USER_WALLET_SCHEMA);
  const config = container.resolve<BillingConfig>(BILLING_CONFIG);
  const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);
  const userWalletsTable = db.query.userWalletSchema;

  afterEach(async () => {
    await db.delete(schema);
  });

  describe("POST /v1/wallets", () => {
    it("should create a wallet for a user", async () => {
      const userId = faker.string.uuid();
      const res = await app.request("/v1/wallets", {
        method: "POST",
        body: JSON.stringify({ data: { userId } }),
        headers: new Headers({ "Content-Type": "application/json" })
      });
      const userWallet = await userWalletsTable.findFirst({ where: eq(schema.userId, userId) });

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
