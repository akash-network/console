import { faker } from "@faker-js/faker";
import type { Context, Next } from "hono";
import first from "lodash/first";
import omit from "lodash/omit";
import { container } from "tsyringe";

import { app } from "@src/app";
import { UserWalletRepository } from "@src/billing/repositories";
import { ApiPgDatabase, POSTGRES_DB, resolveTable } from "@src/core";
import { getCurrentUserId } from "@src/middlewares/userMiddleware";

import { DbTestingService } from "@test/services/db-testing.service";
import { WalletTestingService } from "@test/services/wallet-testing.service";

jest.mock("../../src/middlewares/userMiddleware.ts", () => ({
  getCurrentUserId: jest.fn(),
  requiredUserMiddleware: async (c: Context, next: Next) => next(),
  optionalUserMiddleware: async (c: Context, next: Next) => next()
}));

jest.setTimeout(30000);

describe("User Init", () => {
  const usersTable = resolveTable("Users");
  const userWalletRepository = container.resolve(UserWalletRepository);
  const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);
  const walletService = new WalletTestingService(app);
  let auth0Payload: {
    userId: string;
    wantedUsername: string;
    email: string;
    emailVerified: boolean;
    subscribedToNewsletter: boolean;
  };
  let dbPayload: {
    userId: string;
    emailVerified: boolean;
    email: string;
    username: string;
    subscribedToNewsletter: boolean;
  };

  beforeEach(async () => {
    auth0Payload = {
      userId: faker.string.alphanumeric(10),
      wantedUsername: faker.internet.userName(),
      email: faker.internet.email(),
      emailVerified: true,
      subscribedToNewsletter: false
    };
    dbPayload = {
      userId: auth0Payload.userId,
      emailVerified: auth0Payload.emailVerified,
      email: auth0Payload.email,
      username: auth0Payload.wantedUsername,
      subscribedToNewsletter: auth0Payload.subscribedToNewsletter
    };

    (getCurrentUserId as jest.Mock).mockReturnValue(auth0Payload.userId);
  });
  const dbService = container.resolve(DbTestingService);

  afterEach(async () => {
    await dbService.cleanAll();
  });

  describe("POST /user/tokenInfo", () => {
    it("should create a new user", async () => {
      const res = await sendTokenInfo();

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ email: auth0Payload.email });
    });

    it("should resolve with existing user", async () => {
      const existingUser = first(await db.insert(usersTable).values(dbPayload).returning());
      const res = await sendTokenInfo();

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject(omit(existingUser, ["createdAt", "lastActiveAt"]));
    });

    it("should register an anonymous user", async () => {
      const { user: anonymousUser, token: anonymousToken } = await walletService.createUser();
      const res = await sendTokenInfo(anonymousToken);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        ...omit(anonymousUser, ["createdAt", "lastActiveAt", "username"]),
        ...omit(auth0Payload, "wantedUsername")
      });
    });

    it("should resolve with existing user and transfer anonymous wallet", async () => {
      const { user: anonymousUser, wallet: anonymousWallet, token: anonymousToken } = await walletService.createUserAndWallet();
      const existingUser = first(await db.insert(usersTable).values(dbPayload).returning());

      const res = await sendTokenInfo(anonymousToken);
      const wallet = await userWalletRepository.findById(anonymousWallet.id);

      expect(res.status).toBe(200);
      expect(anonymousWallet.userId).toEqual(anonymousUser.id);
      expect(wallet.userId).toEqual(existingUser.id);
    });

    it("should resolve with existing user without transferring anonymous wallet", async () => {
      const { user: anonymousUser, wallet: anonymousWallet, token: anonymousToken } = await walletService.createUserAndWallet();
      const existingUser = first(await db.insert(usersTable).values(dbPayload).returning());

      await userWalletRepository.create({ userId: existingUser.id, address: faker.string.alphanumeric(10) });
      const res = await sendTokenInfo(anonymousToken);
      const anonymousWalletAfterResponse = await userWalletRepository.findById(anonymousWallet.id);

      expect(res.status).toBe(200);
      expect(anonymousWallet.userId).toEqual(anonymousUser.id);
      expect(anonymousWalletAfterResponse.userId).toEqual(anonymousUser.id);
    });

    async function sendTokenInfo(token?: string) {
      const headers = new Headers({ "Content-Type": "application/json" });

      if (token) {
        headers.set("x-anonymous-authorization", `Bearer ${token}`);
      }

      const res = await app.request("/user/tokenInfo", {
        method: "POST",
        headers,
        body: JSON.stringify(auth0Payload)
      });

      return {
        body: await res.json(),
        status: res.status
      };
    }
  });
});
