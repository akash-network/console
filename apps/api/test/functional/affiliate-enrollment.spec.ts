import { faker } from "@faker-js/faker";
import { container } from "tsyringe";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import type { AffiliateEnrollmentEligibilityResponse, JoinAffiliateProgramResponse } from "@src/affiliate/http-schemas/affiliate-profile.schema";
import { AffiliateRepository } from "@src/affiliate/repositories/affiliate/affiliate.repository";
import { UserAuthTokenService } from "@src/auth/services/user-auth-token/user-auth-token.service";
import { StripeTransactionRepository } from "@src/billing/repositories";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import { app } from "@src/rest-app";
import type { UserOutput } from "@src/user/repositories";

import { seedOrganization, seedOrganizationMember } from "@test/seeders/db/organization.seeder";
import { seedPersonalOrganizationIdOf, seedUserWithWallet } from "@test/seeders/db/user-with-wallet.seeder";

describe("Affiliate enrollment", () => {
  const affiliateRepository = container.resolve(AffiliateRepository);
  const stripeTransactionRepository = container.resolve(StripeTransactionRepository);
  const userAuthTokenService = container.resolve(UserAuthTokenService);

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await container.dispose();
  });

  describe("GET /v1/affiliates/me/eligibility", () => {
    it("returns 401 when the caller is not authenticated", async () => {
      const response = await request("GET", "/v1/affiliates/me/eligibility");

      expect(response.status).toBe(401);
    });

    it("returns eligible with the program terms for a user who spent the minimum across their organizations", async () => {
      const { token, user } = await setup();
      await seedPayment(user, { amount: 6000 });
      const team = await seedOrganization({ type: "team", createdByUserId: user.id });
      await seedPayment(user, { amount: 4000, organizationId: team.id });

      const response = await request("GET", "/v1/affiliates/me/eligibility", token);

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        data: {
          eligible: true,
          terms: {
            commissionPercent: 5,
            commissionMonths: 3,
            referralTrialCreditsUsd: expect.any(Number),
            commissionHoldDays: 30,
            firstPurchaseBonusUsd: 5,
            firstPurchaseBonusMinPaymentUsd: 20,
            firstPurchaseBonusMinUsageUsd: 20
          }
        }
      });
    });

    it("returns ineligible without a reason for a user who spent less than the minimum", async () => {
      const { token, user } = await setup();
      await seedPayment(user, { amount: 10000, amountRefunded: 1 });

      const response = await request("GET", "/v1/affiliates/me/eligibility", token);
      const body = (await response.json()) as AffiliateEnrollmentEligibilityResponse;

      expect(response.status).toBe(200);
      expect(body.data.eligible).toBe(false);
      expect(Object.keys(body.data)).toEqual(["eligible", "terms"]);
    });

    it("returns ineligible for an abuse-locked user while one of their teams is active", async () => {
      const { token, user } = await setup({ abuseLocked: true });
      await seedPayment(user, { amount: 20000 });
      const team = await seedOrganization({ type: "team", createdByUserId: user.id });
      await seedOrganizationMember({ organizationId: team.id, userId: user.id, role: "owner" });

      const response = await request("GET", "/v1/affiliates/me/eligibility", token, { organizationId: team.id });
      const body = (await response.json()) as AffiliateEnrollmentEligibilityResponse;

      expect(response.status).toBe(200);
      expect(body.data.eligible).toBe(false);
    });

    it("returns ineligible when open enrollment is off for the user", async () => {
      const { token, user } = await setup({ openEnrollment: false });
      await seedPayment(user, { amount: 20000 });

      const response = await request("GET", "/v1/affiliates/me/eligibility", token);
      const body = (await response.json()) as AffiliateEnrollmentEligibilityResponse;

      expect(body.data.eligible).toBe(false);
    });
  });

  describe("POST /v1/affiliates/me", () => {
    it("returns 401 when the caller is not authenticated", async () => {
      const response = await request("POST", "/v1/affiliates/me");

      expect(response.status).toBe(401);
    });

    it("returns 403 for a user who spent less than the minimum, and approves nobody", async () => {
      const { token, user } = await setup();
      await seedPayment(user, { amount: 9999 });

      const response = await request("POST", "/v1/affiliates/me", token);

      expect(response.status).toBe(403);
      expect(await affiliateRepository.findByUserId(user.id)).toBeUndefined();
    });

    it("returns 403 for a revoked affiliate who spent the minimum", async () => {
      const { token, user } = await setup();
      await seedPayment(user, { amount: 20000 });
      await affiliateRepository.create({
        userId: user.id,
        code: faker.string.alpha({ length: 8, casing: "lower" }),
        approvedAt: new Date(),
        approvedBy: "ops@akash.network",
        revokedAt: new Date(),
        revokedBy: "ops@akash.network"
      });

      const response = await request("POST", "/v1/affiliates/me", token);

      expect(response.status).toBe(403);
    });

    it("approves an eligible user as a self-service affiliate and returns their profile", async () => {
      const { token, user } = await setup();
      await seedPayment(user, { amount: 10000 });

      const response = await request("POST", "/v1/affiliates/me", token);
      const body = (await response.json()) as JoinAffiliateProgramResponse;
      const affiliate = await affiliateRepository.findByUserId(user.id);

      expect(response.status).toBe(200);
      expect(affiliate).toMatchObject({ approvedBy: "self-service", revokedAt: null });
      expect(body.data).toMatchObject({ code: affiliate?.code, terms: { commissionPercent: 5 }, stats: { signups: 0 }, commissions: [] });
    });

    it("returns the same profile when an affiliate joins again", async () => {
      const { token, user } = await setup();
      await seedPayment(user, { amount: 10000 });
      const first = (await (await request("POST", "/v1/affiliates/me", token)).json()) as JoinAffiliateProgramResponse;

      const response = await request("POST", "/v1/affiliates/me", token);

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual(first);
    });

    it("approves the user once when two joins race", async () => {
      const { token, user } = await setup();
      await seedPayment(user, { amount: 10000 });

      const responses = await Promise.all([request("POST", "/v1/affiliates/me", token), request("POST", "/v1/affiliates/me", token)]);
      const bodies = (await Promise.all(responses.map(response => response.json()))) as JoinAffiliateProgramResponse[];

      expect(responses.map(response => response.status)).toEqual([200, 200]);
      expect(bodies[0].data.code).toBe(bodies[1].data.code);
      expect(await affiliateRepository.find({ userId: user.id })).toHaveLength(1);
    });
  });

  async function seedPayment(user: UserOutput, overrides: { amount: number; amountRefunded?: number; organizationId?: string }) {
    await stripeTransactionRepository.create({
      userId: user.id,
      organizationId: overrides.organizationId ?? (await seedPersonalOrganizationIdOf(user.id)),
      type: "payment_intent",
      status: "succeeded",
      amount: overrides.amount,
      amountRefunded: overrides.amountRefunded ?? 0,
      currency: "usd"
    });
  }

  async function request(method: "GET" | "POST", path: string, token?: string, options: { organizationId?: string } = {}) {
    return app.request(path, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(options.organizationId ? { "x-organization-id": options.organizationId } : {})
      }
    });
  }

  async function setup(input: { abuseLocked?: boolean; openEnrollment?: boolean } = {}) {
    const { user } = await seedUserWithWallet({ user: { userId: faker.string.uuid() }, abuseLockedAt: input.abuseLocked ? new Date() : null });
    const token = faker.string.alphanumeric(40);

    vi.spyOn(userAuthTokenService, "getValidUserId").mockImplementation(async header => (header.replace(/^Bearer +/i, "") === token ? user.userId! : null));
    vi.spyOn(container.resolve(FeatureFlagsService), "isEnabledForSubject").mockImplementation(
      flag => flag !== FeatureFlags.AFFILIATE_OPEN_ENROLLMENT || (input.openEnrollment ?? true)
    );

    return { user, token };
  }
});
