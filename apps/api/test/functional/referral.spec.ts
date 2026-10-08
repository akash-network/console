import { faker } from "@faker-js/faker";
import { container } from "tsyringe";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import { AffiliateRepository } from "@src/affiliate/repositories/affiliate/affiliate.repository";
import { ReferralRepository } from "@src/affiliate/repositories/referral/referral.repository";
import { UserAuthTokenService } from "@src/auth/services/user-auth-token/user-auth-token.service";
import { BILLING_CONFIG } from "@src/billing/providers";
import { app } from "@src/rest-app";
import { UserRepository } from "@src/user/repositories/user/user.repository";

describe("GET /v1/referral", () => {
  const userRepository = container.resolve(UserRepository);
  const affiliateRepository = container.resolve(AffiliateRepository);
  const referralRepository = container.resolve(ReferralRepository);
  const userAuthTokenService = container.resolve(UserAuthTokenService);
  const billingConfig = container.resolve(BILLING_CONFIG);

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await container.dispose();
  });

  it("returns 401 when the caller is not authenticated", async () => {
    const response = await request();

    expect(response.status).toBe(401);
  });

  it("returns null data for an authenticated user who was never referred", async () => {
    const { token } = await setup();

    const response = await request(token);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: null });
  });

  it("returns the configured referral trial amount before the trial is granted", async () => {
    const { token, user } = await setup();
    const referrer = await userRepository.create({ userId: faker.string.uuid() });
    const affiliate = await affiliateRepository.create({
      userId: referrer.id,
      code: faker.string.alpha({ length: 8, casing: "lower" }),
      approvedAt: new Date(),
      approvedBy: "ops@akash.network"
    });
    await referralRepository.createIfAbsent({ referredUserId: user.id, affiliateId: affiliate.id });

    const response = await request(token);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      data: { trialCreditsUsd: billingConfig.REFERRAL_TRIAL_DEPLOYMENT_ALLOWANCE_AMOUNT / 1_000_000 }
    });
  });

  it("returns the recorded trial credits once the trial has been granted", async () => {
    const { token, user } = await setup();
    const referrer = await userRepository.create({ userId: faker.string.uuid() });
    const affiliate = await affiliateRepository.create({
      userId: referrer.id,
      code: faker.string.alpha({ length: 8, casing: "lower" }),
      approvedAt: new Date(),
      approvedBy: "ops@akash.network"
    });
    const referral = await referralRepository.createIfAbsent({ referredUserId: user.id, affiliateId: affiliate.id });
    await referralRepository.updateById(referral!.id, { trialCreditsCents: 500 });

    const response = await request(token);

    expect(await response.json()).toEqual({ data: { trialCreditsUsd: 5 } });
  });

  it("does not expose another user's referral", async () => {
    const { token } = await setup();
    const stranger = await setup();
    const referrer = await userRepository.create({ userId: faker.string.uuid() });
    const affiliate = await affiliateRepository.create({
      userId: referrer.id,
      code: faker.string.alpha({ length: 8, casing: "lower" }),
      approvedAt: new Date(),
      approvedBy: "ops@akash.network"
    });
    await referralRepository.createIfAbsent({ referredUserId: stranger.user.id, affiliateId: affiliate.id });

    const response = await request(token);

    expect(await response.json()).toEqual({ data: null });
  });

  async function request(token?: string) {
    return app.request("/v1/referral", {
      method: "GET",
      headers: { "Content-Type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }
    });
  }

  async function setup() {
    const user = await userRepository.create({ userId: faker.string.uuid() });
    const token = faker.string.alphanumeric(40);
    const otherTokens = vi.isMockFunction(userAuthTokenService.getValidUserId)
      ? vi.mocked(userAuthTokenService.getValidUserId).getMockImplementation()
      : undefined;

    vi.spyOn(userAuthTokenService, "getValidUserId").mockImplementation(async header =>
      header.replace(/^Bearer +/i, "") === token ? user.userId! : (await otherTokens?.(header)) ?? null
    );

    return { user, token };
  }
});
