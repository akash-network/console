import { faker } from "@faker-js/faker";
import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";

import { UserAuthTokenService } from "@src/auth/services/user-auth-token/user-auth-token.service";
import { UserWalletRepository } from "@src/billing/repositories";
import { app } from "@src/rest-app";
import { UserRepository } from "@src/user/repositories/user/user.repository";

import { createAkashAddress } from "@test/seeders/akash-address.seeder";
import { createUserWallet } from "@test/seeders/user-wallet.seeder";

describe("Wallet Settings", () => {
  const userRepository = container.resolve(UserRepository);
  const userAuthTokenService = container.resolve(UserAuthTokenService);
  const userWalletRepository = container.resolve(UserWalletRepository);

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("PUT /v1/wallet-settings", () => {
    it("returns 401 if user is not authenticated", async () => {
      const response = await app.request("/v1/wallet-settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ data: { autoReloadEnabled: false } })
      });

      expect(response.status).toBe(401);
    });

    it("returns 400 when autoReloadAmount is below the minimum", async () => {
      const { token } = await setup();

      const response = await app.request("/v1/wallet-settings", {
        method: "PUT",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ data: { autoReloadEnabled: true, autoReloadAmount: 5 } })
      });

      expect(response.status).toBe(400);
    });

    it("returns 400 when autoReloadThreshold is below the minimum", async () => {
      const { token } = await setup();

      const response = await app.request("/v1/wallet-settings", {
        method: "PUT",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ data: { autoReloadEnabled: true, autoReloadThreshold: 1 } })
      });

      expect(response.status).toBe(400);
    });

    it("returns 400 when autoReloadAmount exceeds the maximum", async () => {
      const { token } = await setup();

      const response = await app.request("/v1/wallet-settings", {
        method: "PUT",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ data: { autoReloadEnabled: true, autoReloadAmount: 10_001 } })
      });

      expect(response.status).toBe(400);
    });

    it("returns 400 when autoReloadThreshold exceeds the maximum", async () => {
      const { token } = await setup();

      const response = await app.request("/v1/wallet-settings", {
        method: "PUT",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ data: { autoReloadEnabled: true, autoReloadThreshold: 10_001 } })
      });

      expect(response.status).toBe(400);
    });
  });

  async function setup() {
    const user = await userRepository.create({ userId: faker.string.uuid() });
    const token = faker.string.alphanumeric(40);
    const wallet = createUserWallet({ userId: user.id, address: createAkashAddress() });

    vi.spyOn(userAuthTokenService, "getValidUserId").mockResolvedValue(user.userId);
    vi.spyOn(userWalletRepository, "findOneByUserId").mockResolvedValue(wallet);

    return { user, token, wallet };
  }
});
