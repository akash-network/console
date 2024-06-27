import { faker } from "@faker-js/faker";
import { eq } from "drizzle-orm";
import { container } from "tsyringe";

import { app, initDb } from "@src/app";
import { USER_WALLET_SCHEMA, UserWalletSchema } from "@src/billing/providers";
import { ApiPgDatabase, POSTGRES_DB } from "@src/core";
import { closeConnections } from "@src/db/dbConnection";

describe("wallets", () => {
  const schema = container.resolve<UserWalletSchema>(USER_WALLET_SCHEMA);
  const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);
  const userWalletsTable = db.query.userWalletSchema;

  beforeAll(async () => {
    await initDb();
  });

  afterAll(async () => {
    await closeConnections();
  });

  afterEach(async () => {
    await db.delete(schema);
  });

  describe("POST /v1/wallets", () => {
    it("should create a wallet for a user", async () => {
      jest.setTimeout(10000);

      const userId = faker.string.uuid();
      const res = await app.request("/v1/wallets", {
        method: "POST",
        body: JSON.stringify({ userId }),
        headers: new Headers({ "Content-Type": "application/json" })
      });
      const userWallet = await userWalletsTable.findFirst({ where: eq(schema.userId, userId) });

      expect(res.status).toBe(200);
      expect(userWallet).toMatchObject({
        userId,
        address: expect.any(String),
        creditAmount: "0.00"
      });
    });
  });
});
