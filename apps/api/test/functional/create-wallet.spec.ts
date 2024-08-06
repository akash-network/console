import { faker } from "@faker-js/faker";
import { eq } from "drizzle-orm";
import { container } from "tsyringe";

import { app } from "@src/app";
import { BILLING_CONFIG, BillingConfig, USER_WALLET_SCHEMA, UserWalletSchema } from "@src/billing/providers";
import { ApiPgDatabase, POSTGRES_DB } from "@src/core";
import { USER_SCHEMA, UserSchema } from "@src/user/providers";

jest.setTimeout(20000);

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
      const headers = new Headers({ "Content-Type": "application/json", "x-anonymous-user-id": userId });
      const createWalletResponse = await app.request("/v1/wallets", {
        method: "POST",
        body: JSON.stringify({ data: { userId } }),
        headers
      });
      const getWalletsResponse = await app.request(`/v1/wallets?userId=${userId}`, { headers });
      const userWallet = await userWalletsTable.findFirst({ where: eq(userWalletSchema.userId, userId) });

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
    });

    it("should throw 401 provided no auth header ", async () => {
      const createWalletResponse = await app.request("/v1/wallets", {
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
