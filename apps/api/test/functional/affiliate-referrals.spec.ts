import { faker } from "@faker-js/faker";
import { container } from "tsyringe";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import type { ListAffiliateReferralsResponse } from "@src/affiliate/http-schemas/affiliate-referral.schema";
import { AffiliateRepository } from "@src/affiliate/repositories/affiliate/affiliate.repository";
import { ReferralRepository } from "@src/affiliate/repositories/referral/referral.repository";
import { UserAuthTokenService } from "@src/auth/services/user-auth-token/user-auth-token.service";
import { StripeTransactionRepository } from "@src/billing/repositories";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import { app } from "@src/rest-app";
import { UserRepository } from "@src/user/repositories/user/user.repository";

import { seedOrganization, seedOrganizationMember } from "@test/seeders/db/organization.seeder";

describe("GET /v1/affiliates/me/referrals", () => {
  const userRepository = container.resolve(UserRepository);
  const affiliateRepository = container.resolve(AffiliateRepository);
  const referralRepository = container.resolve(ReferralRepository);
  const stripeTransactionRepository = container.resolve(StripeTransactionRepository);
  const userAuthTokenService = container.resolve(UserAuthTokenService);

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

  it("returns 404 for a caller who is not an approved affiliate", async () => {
    const { token } = await setup();

    const response = await request(token);

    expect(response.status).toBe(404);
  });

  it("returns an empty first page for an affiliate nobody signed up through yet", async () => {
    const { token, user } = await setup();
    await approveAffiliate(user.id);

    const response = await request(token);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: { referrals: [], pagination: { total: 0, limit: 20, offset: 0 } } });
  });

  it("lists the affiliate's referrals newest first with what they paid and what it earned, teams they created included", async () => {
    const { token, user } = await setup();
    const affiliate = await approveAffiliate(user.id);
    const payingUser = await userRepository.create({ userId: faker.string.uuid() });
    await referralRepository.createIfAbsent({ referredUserId: payingUser.id, affiliateId: affiliate.id });
    const quietUser = await userRepository.create({ userId: faker.string.uuid() });
    await referralRepository.createIfAbsent({ referredUserId: quietUser.id, affiliateId: affiliate.id });
    const team = await seedOrganization({ type: "team", createdByUserId: payingUser.id });
    const payment = await stripeTransactionRepository.create({
      userId: payingUser.id,
      type: "payment_intent",
      status: "succeeded",
      amount: 20000,
      currency: "usd"
    });
    await stripeTransactionRepository.create({
      userId: (await userRepository.create({ userId: faker.string.uuid() })).id,
      organizationId: team.id,
      type: "payment_intent",
      status: "succeeded",
      amount: 10000,
      currency: "usd"
    });
    await stripeTransactionRepository.create({
      userId: user.id,
      type: "affiliate_commission",
      status: "pending",
      amount: 1000,
      currency: "usd",
      sourceTransactionId: payment.id
    });

    const response = await request(token, { query: "?limit=1" });
    const body = (await response.json()) as ListAffiliateReferralsResponse;
    const nextPage = (await (await request(token, { query: "?limit=1&offset=1" })).json()) as ListAffiliateReferralsResponse;

    expect(body.data.pagination).toEqual({ total: 2, limit: 1, offset: 0 });
    expect(body.data.referrals).toEqual([
      {
        code: expect.stringMatching(/^[0-9A-F]{6}$/),
        joinedAt: expect.any(String),
        status: "inactive",
        commissionEndsAt: expect.any(String),
        commissionMonthsLeft: 12,
        paidUsd: 0,
        earnedUsd: 0
      }
    ]);
    expect(nextPage.data.referrals).toMatchObject([{ status: "paying", paidUsd: 300, earnedUsd: 10 }]);
  });

  it("lists the referrals while one of the affiliate's teams is active", async () => {
    const { token, user } = await setup({ hasOrganizations: true });
    const affiliate = await approveAffiliate(user.id);
    const team = await seedOrganization({ type: "team", createdByUserId: user.id });
    await seedOrganizationMember({ organizationId: team.id, userId: user.id, role: "owner" });
    const referredUser = await userRepository.create({ userId: faker.string.uuid() });
    await referralRepository.createIfAbsent({ referredUserId: referredUser.id, affiliateId: affiliate.id });

    const response = await request(token, { organizationId: team.id });
    const body = (await response.json()) as ListAffiliateReferralsResponse;

    expect(response.status).toBe(200);
    expect(body.data.pagination.total).toBe(1);
  });

  it("carries no field that identifies the referred person, their account or their organizations", async () => {
    const { token, user } = await setup();
    const affiliate = await approveAffiliate(user.id);
    const referredUser = await userRepository.create({ userId: faker.string.uuid(), email: "referred-user@example.com", username: "referred-username" });
    const referral = await referralRepository.createIfAbsent({ referredUserId: referredUser.id, affiliateId: affiliate.id });
    const team = await seedOrganization({ type: "team", createdByUserId: referredUser.id, name: "Referred Team Name" });
    const payment = await stripeTransactionRepository.create({
      userId: referredUser.id,
      organizationId: team.id,
      type: "payment_intent",
      status: "succeeded",
      amount: 10000,
      currency: "usd"
    });

    const response = await request(token);
    const rawBody = await response.text();
    const [row] = (JSON.parse(rawBody) as ListAffiliateReferralsResponse).data.referrals;

    expect(Object.keys(row).sort()).toEqual(["code", "commissionEndsAt", "commissionMonthsLeft", "earnedUsd", "joinedAt", "paidUsd", "status"]);
    for (const identifier of [
      referredUser.id,
      referredUser.userId!,
      "referred-user@example.com",
      "referred-username",
      team.id,
      team.slug,
      "Referred Team Name",
      referral!.id,
      payment.id
    ]) {
      expect(rawBody).not.toContain(identifier);
    }
  });

  async function approveAffiliate(userId: string) {
    return affiliateRepository.create({
      userId,
      code: faker.string.alpha({ length: 8, casing: "lower" }),
      approvedAt: new Date(),
      approvedBy: "ops@akash.network"
    });
  }

  async function request(token?: string, options: { organizationId?: string; query?: string } = {}) {
    return app.request(`/v1/affiliates/me/referrals${options.query ?? ""}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(options.organizationId ? { "x-organization-id": options.organizationId } : {})
      }
    });
  }

  async function setup(input: { hasOrganizations?: boolean } = {}) {
    const user = await userRepository.create({ userId: faker.string.uuid() });
    const token = faker.string.alphanumeric(40);
    const otherTokens = vi.isMockFunction(userAuthTokenService.getValidUserId)
      ? vi.mocked(userAuthTokenService.getValidUserId).getMockImplementation()
      : undefined;

    vi.spyOn(userAuthTokenService, "getValidUserId").mockImplementation(async header =>
      header.replace(/^Bearer +/i, "") === token ? user.userId! : (await otherTokens?.(header)) ?? null
    );

    if (input.hasOrganizations) {
      const featureFlagsService = container.resolve(FeatureFlagsService);
      const isEnabled = FeatureFlagsService.prototype.isEnabled.bind(featureFlagsService);
      vi.spyOn(featureFlagsService, "isEnabled").mockImplementation((flag, context) => flag === FeatureFlags.ORGANIZATIONS || isEnabled(flag, context));
    }

    return { user, token };
  }
});
