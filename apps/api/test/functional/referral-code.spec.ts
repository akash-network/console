import { faker } from "@faker-js/faker";
import { container } from "tsyringe";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import { AffiliateRepository } from "@src/affiliate/repositories/affiliate/affiliate.repository";
import { BILLING_CONFIG } from "@src/billing/providers";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import { app } from "@src/rest-app";
import { UserRepository } from "@src/user/repositories/user/user.repository";

describe("GET /v1/referral-codes/{code}", () => {
  const userRepository = container.resolve(UserRepository);
  const affiliateRepository = container.resolve(AffiliateRepository);
  const billingConfig = container.resolve(BILLING_CONFIG);
  const INVALID_CODE_BODY = { data: { valid: false } };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await container.dispose();
  });

  it("returns the referral trial credits for an active code to an anonymous visitor", async () => {
    const affiliate = await seedAffiliate();

    const response = await request(affiliate.code.toUpperCase());

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("public");
    expect(await response.json()).toEqual({
      data: { valid: true, trialCreditsUsd: billingConfig.REFERRAL_TRIAL_DEPLOYMENT_ALLOWANCE_AMOUNT / 1_000_000 }
    });
  });

  it("answers an unknown code as invalid", async () => {
    const response = await request(faker.string.alpha({ length: 10, casing: "lower" }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(INVALID_CODE_BODY);
  });

  it("answers a malformed code as invalid", async () => {
    const response = await request("not a code!");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(INVALID_CODE_BODY);
  });

  it("answers a revoked code as invalid", async () => {
    const affiliate = await seedAffiliate({ revokedAt: new Date(), revokedBy: "ops@akash.network" });

    const response = await request(affiliate.code);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(INVALID_CODE_BODY);
  });

  it("answers a code as invalid when the affiliate program is off for its affiliate", async () => {
    const affiliate = await seedAffiliate();
    vi.spyOn(container.resolve(FeatureFlagsService), "isEnabled").mockImplementation(
      (flag, context) => flag !== FeatureFlags.AFFILIATE_PROGRAM || context?.userId !== affiliate.userId
    );

    const response = await request(affiliate.code);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(INVALID_CODE_BODY);
  });

  async function request(code: string) {
    return app.request(`/v1/referral-codes/${encodeURIComponent(code)}`, { method: "GET" });
  }

  async function seedAffiliate(input: { revokedAt?: Date; revokedBy?: string } = {}) {
    const referrer = await userRepository.create({ userId: faker.string.uuid() });
    return affiliateRepository.create({
      userId: referrer.id,
      code: faker.string.alpha({ length: 8, casing: "lower" }),
      approvedAt: new Date(),
      approvedBy: "ops@akash.network",
      ...input
    });
  }
});
