import { faker } from "@faker-js/faker";
import nock from "nock";
import { container } from "tsyringe";

import { app } from "@src/app";
import type { ApiKeyOutput } from "@src/auth/repositories/api-key/api-key.repository";
import { AbilityService } from "@src/auth/services/ability/ability.service";
import { ApiKeyAuthService } from "@src/auth/services/api-key/api-key-auth.service";
import type { UserWalletOutput } from "@src/billing/repositories";
import { UserWalletRepository } from "@src/billing/repositories";
import type { UserOutput } from "@src/user/repositories";
import { UserRepository } from "@src/user/repositories";
import { apiNodeUrl } from "@src/utils/constants";

import { ApiKeySeeder } from "@test/seeders/api-key.seeder";
import { UserSeeder } from "@test/seeders/user.seeder";
import { UserWalletSeeder } from "@test/seeders/user-wallet.seeder";

jest.setTimeout(20000);

describe("Bids API", () => {
  const userRepository = container.resolve(UserRepository);
  const apiKeyAuthService = container.resolve(ApiKeyAuthService);
  const userWalletRepository = container.resolve(UserWalletRepository);
  const abilityService = container.resolve(AbilityService);

  let knownUsers: Record<string, UserOutput>;
  let knownApiKeys: Record<string, ApiKeyOutput>;
  let knownWallets: Record<string, UserWalletOutput[]>;

  beforeEach(() => {
    knownUsers = {};
    knownApiKeys = {};
    knownWallets = {};

    jest.spyOn(userRepository, "findById").mockImplementation(async (id: string) => {
      return Promise.resolve(
        knownUsers[id]
          ? {
              ...knownUsers[id],
              trial: false,
              userWallets: { isTrialing: false }
            }
          : undefined
      );
    });

    jest.spyOn(apiKeyAuthService, "getAndValidateApiKeyFromHeader").mockImplementation(async (key: string) => {
      return Promise.resolve(knownApiKeys[key]);
    });

    const fakeWalletRepository = {
      findOneByUserId: async (id: string) => {
        return Promise.resolve(knownWallets[id][0]);
      }
    } as unknown as UserWalletRepository;

    jest.spyOn(userWalletRepository, "accessibleBy").mockReturnValue(fakeWalletRepository);
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    nock.cleanAll();
  });

  afterAll(async () => {
    jest.restoreAllMocks();
    nock.cleanAll();
  });

  async function mockUser(dseq = "1234") {
    const userId = faker.string.uuid();
    const userApiKeySecret = faker.word.noun();
    const user = UserSeeder.create({ userId });
    const apiKey = ApiKeySeeder.create({ userId });
    const wallets = [UserWalletSeeder.create({ userId })];

    knownUsers[userId] = user;
    knownApiKeys[userApiKeySecret] = apiKey;
    knownWallets[user.id] = wallets;

    nock(apiNodeUrl)
      .get(`/akash/market/v1beta4/bids/list?filters.owner=${wallets[0].address}&filters.dseq=${dseq}`)
      .reply(200, {
        bids: [
          {
            bid: "fake-bid",
            escrow_account: "fake-escrow-account"
          }
        ]
      });

    return { user, userApiKeySecret, wallets };
  }

  async function mockAdmin() {
    const adminId = faker.string.uuid();
    const adminApiKeySecret = faker.word.noun();
    const adminUser = UserSeeder.create({ userId: adminId });
    const apiKeyForAdmin = ApiKeySeeder.create({ userId: adminId });

    knownUsers[adminId] = adminUser;
    knownApiKeys[adminApiKeySecret] = apiKeyForAdmin;

    const originalGetAbilityFor = abilityService.getAbilityFor.bind(abilityService);
    jest.spyOn(abilityService, "getAbilityFor").mockImplementation((role, user) => {
      if (user.userId === adminId) {
        return originalGetAbilityFor("SUPER_USER", user);
      }

      return originalGetAbilityFor(role, user);
    });

    return { adminApiKeySecret };
  }

  describe("GET /v1/bids", () => {
    it("returns bids by dseq", async () => {
      const dseq = "1234";
      const { userApiKeySecret } = await mockUser(dseq);

      const response = await app.request(`/v1/bids?dseq=${dseq}`, {
        method: "GET",
        headers: new Headers({ "Content-Type": "application/json", "x-api-key": userApiKeySecret })
      });

      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.data).toEqual([
        {
          bid: "fake-bid",
          escrow_account: "fake-escrow-account"
        }
      ]);
    });

    it("returns bids by dseq and userId", async () => {
      const dseq = "1234";
      const { user, userApiKeySecret } = await mockUser(dseq);

      const response = await app.request(`/v1/bids?dseq=${dseq}&userId=${user.id}`, {
        method: "GET",
        headers: new Headers({ "Content-Type": "application/json", "x-api-key": userApiKeySecret })
      });

      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.data).toEqual([
        {
          bid: "fake-bid",
          escrow_account: "fake-escrow-account"
        }
      ]);
    });

    it("returns bids by dseq and userId, any user for an admin", async () => {
      const dseq = "1234";
      const { user } = await mockUser(dseq);
      const { adminApiKeySecret } = await mockAdmin();

      const response = await app.request(`/v1/bids?dseq=${dseq}&userId=${user.id}`, {
        method: "GET",
        headers: new Headers({ "Content-Type": "application/json", "x-api-key": adminApiKeySecret })
      });

      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.data).toEqual([
        {
          bid: "fake-bid",
          escrow_account: "fake-escrow-account"
        }
      ]);
    });

    it("returns 401 for an unauthenticated request", async () => {
      const response = await app.request(`/v1/bids?dseq=1234`, {
        method: "GET",
        headers: new Headers({ "Content-Type": "application/json" })
      });

      expect(response.status).toBe(401);
    });

    it("returns 400 if no dseq set", async () => {
      const { userApiKeySecret } = await mockUser();

      const response = await app.request(`/v1/bids`, {
        method: "GET",
        headers: new Headers({ "Content-Type": "application/json", "x-api-key": userApiKeySecret })
      });

      expect(response.status).toBe(400);
    });
  });
});
