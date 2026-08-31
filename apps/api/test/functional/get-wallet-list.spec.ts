import { faker } from "@faker-js/faker";
import addDays from "date-fns/addDays";
import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";

import { UserAuthTokenService } from "@src/auth/services/user-auth-token/user-auth-token.service";
import { UserWalletRepository } from "@src/billing/repositories";
import { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import { app } from "@src/rest-app";
import { UserRepository } from "@src/user/repositories/user/user.repository";

import { createAkashAddress } from "@test/seeders/akash-address.seeder";

describe("Get Wallet List", () => {
  const userRepository = container.resolve(UserRepository);
  const userAuthTokenService = container.resolve(UserAuthTokenService);
  const userWalletRepository = container.resolve(UserWalletRepository);
  const billingConfig = container.resolve(BillingConfigService);

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("GET /v1/wallets", () => {
    it("returns the trial expiry counted from activation for a trialing wallet", async () => {
      const activatedAt = new Date("2026-08-01T00:00:00.000Z");
      const { user, token } = await setup({ isTrialing: true, activatedAt });

      const response = await app.request(`/v1/wallets?userId=${user.id}`, {
        headers: { authorization: `Bearer ${token}` }
      });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.data[0].isTrialing).toBe(true);
      expect(body.data[0].trialEndsAt).toBe(addDays(activatedAt, billingConfig.get("TRIAL_ALLOWANCE_EXPIRATION_DAYS")).toISOString());
    });

    it("reports the trial length the expiry was counted from", async () => {
      const { user, token } = await setup({ isTrialing: true, activatedAt: new Date("2026-08-01T00:00:00.000Z") });

      const response = await app.request(`/v1/wallets?userId=${user.id}`, {
        headers: { authorization: `Bearer ${token}` }
      });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.data[0].trialDurationDays).toBe(billingConfig.get("TRIAL_ALLOWANCE_EXPIRATION_DAYS"));
    });

    it("returns no trial expiry once the wallet has stopped trialing", async () => {
      const { user, token } = await setup({ isTrialing: false, activatedAt: new Date("2026-08-01T00:00:00.000Z") });

      const response = await app.request(`/v1/wallets?userId=${user.id}`, {
        headers: { authorization: `Bearer ${token}` }
      });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.data[0].isTrialing).toBe(false);
      expect(body.data[0].trialEndsAt).toBeNull();
      expect(body.data[0].trialDurationDays).toBeNull();
    });
  });

  async function setup(input: { isTrialing: boolean; activatedAt: Date }) {
    const user = await userRepository.create({ userId: faker.string.uuid() });
    const token = faker.string.alphanumeric(40);
    const { wallet } = await userWalletRepository.getOrCreate({ userId: user.id });
    await userWalletRepository.updateById(wallet.id, {
      address: createAkashAddress(),
      isTrialing: input.isTrialing,
      activatedAt: input.activatedAt
    });

    vi.spyOn(userAuthTokenService, "getValidUserId").mockResolvedValue(user.userId);

    return { user, token };
  }
});
