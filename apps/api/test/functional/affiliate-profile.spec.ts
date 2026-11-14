import { faker } from "@faker-js/faker";
import { container } from "tsyringe";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import type { AffiliateProfileResponse } from "@src/affiliate/http-schemas/affiliate-profile.schema";
import { AffiliateRepository } from "@src/affiliate/repositories/affiliate/affiliate.repository";
import { ReferralRepository } from "@src/affiliate/repositories/referral/referral.repository";
import { UserAuthTokenService } from "@src/auth/services/user-auth-token/user-auth-token.service";
import { StripeTransactionRepository } from "@src/billing/repositories";
import { app } from "@src/rest-app";
import { UserRepository } from "@src/user/repositories/user/user.repository";

import { seedOrganization, seedOrganizationMember } from "@test/seeders/db/organization.seeder";
import { seedPaymentCredit } from "@test/seeders/db/payment-credit.seeder";
import { seedPersonalOrganizationIdOf } from "@test/seeders/db/user-with-wallet.seeder";

describe("GET /v1/affiliates/me", () => {
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

  it("returns null data for an authenticated user who has never been an affiliate", async () => {
    const { token } = await setup();

    const response = await request(token);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: null });
  });

  it("returns null data for a revoked affiliate", async () => {
    const { token, user } = await setup();
    await affiliateRepository.create({
      userId: user.id,
      code: faker.string.alpha({ length: 8, casing: "lower" }),
      approvedAt: new Date(),
      approvedBy: "ops@akash.network",
      revokedAt: new Date(),
      revokedBy: "ops@akash.network"
    });

    const response = await request(token);

    expect(await response.json()).toEqual({ data: null });
  });

  it("returns the code, terms and zeroed stats for an approved affiliate with no referrals yet", async () => {
    const { token, user } = await setup();
    await affiliateRepository.create({
      userId: user.id,
      code: "friendcode",
      approvedAt: new Date(),
      approvedBy: "ops@akash.network"
    });

    const response = await request(token);
    const body = (await response.json()) as AffiliateProfileResponse;

    expect(response.status).toBe(200);
    expect(body).toEqual({
      data: {
        code: "friendcode",
        terms: { commissionPercent: 5, commissionMonths: 12, referralTrialCreditsUsd: expect.any(Number), commissionHoldDays: 30 },
        stats: { signups: 0, payingUsers: 0, totalCommissionUsd: 0, monthCommissionUsd: 0, creditedUsd: 0, onHoldUsd: 0, nextRelease: null },
        commissions: []
      }
    });
  });

  it("returns stats and commission entries built from the affiliate's referrals and commission transactions", async () => {
    const { token, user } = await setup();
    const affiliate = await affiliateRepository.create({
      userId: user.id,
      code: faker.string.alpha({ length: 8, casing: "lower" }),
      approvedAt: new Date(),
      approvedBy: "ops@akash.network"
    });
    const referredUser = await userRepository.create({ userId: faker.string.uuid() });
    await referralRepository.createIfAbsent({ referredUserId: referredUser.id, affiliateId: affiliate.id });
    await stripeTransactionRepository.create({
      userId: referredUser.id,
      organizationId: await seedPersonalOrganizationIdOf(referredUser.id),
      type: "payment_intent",
      status: "succeeded",
      amount: 10000,
      currency: "usd"
    });
    await stripeTransactionRepository.create({
      userId: user.id,
      organizationId: await seedPersonalOrganizationIdOf(user.id),
      type: "affiliate_commission",
      status: "succeeded",
      amount: 500,
      amountRefunded: 100,
      currency: "usd"
    });

    const response = await request(token);
    const body = (await response.json()) as AffiliateProfileResponse;

    expect(body.data).toMatchObject({
      stats: { signups: 1, payingUsers: 1, totalCommissionUsd: 4, monthCommissionUsd: expect.any(Number) },
      commissions: [{ id: expect.any(String), createdAt: expect.any(String), amountUsd: 5, reversedUsd: 1 }]
    });
  });

  it("returns each commission's state with the credited and held totals and the next release", async () => {
    const { token, user } = await setup();
    await affiliateRepository.create({
      userId: user.id,
      code: faker.string.alpha({ length: 8, casing: "lower" }),
      approvedAt: new Date(),
      approvedBy: "ops@akash.network"
    });
    const organizationId = await seedPersonalOrganizationIdOf(user.id);
    const payment = await stripeTransactionRepository.create({
      userId: user.id,
      organizationId,
      type: "payment_intent",
      status: "succeeded",
      amount: 20000,
      currency: "usd"
    });
    const heldAt = new Date();
    await stripeTransactionRepository.create({
      userId: user.id,
      organizationId,
      type: "affiliate_commission",
      status: "pending",
      amount: 1000,
      currency: "usd",
      sourceTransactionId: payment.id,
      createdAt: heldAt
    });
    const credited = await stripeTransactionRepository.create({
      userId: user.id,
      organizationId,
      type: "affiliate_commission",
      status: "succeeded",
      amount: 250,
      currency: "usd",
      createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000)
    });
    const credit = await seedPaymentCredit({ transactionId: credited.id, status: "landed" });

    const response = await request(token);
    const body = (await response.json()) as AffiliateProfileResponse;

    const releasesAt = new Date(heldAt.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
    expect(body.data).toMatchObject({
      stats: { creditedUsd: 2.5, onHoldUsd: 10, nextRelease: { releasesAt, amountUsd: 10 } },
      commissions: [
        { status: "on_hold", releasesAt, creditedAt: null, amountUsd: 10, paymentUsd: 200 },
        { status: "credited", releasesAt: null, creditedAt: credit.createdAt.toISOString(), amountUsd: 2.5, paymentUsd: null }
      ]
    });
  });

  it("returns the earnings filed under the affiliate's personal organization while one of their teams is active", async () => {
    const { token, user } = await setup();
    await affiliateRepository.create({
      userId: user.id,
      code: faker.string.alpha({ length: 8, casing: "lower" }),
      approvedAt: new Date(),
      approvedBy: "ops@akash.network"
    });
    const personalOrganization = await seedOrganization({ type: "personal", createdByUserId: user.id });
    const team = await seedOrganization({ type: "team", createdByUserId: user.id });
    await seedOrganizationMember({ organizationId: team.id, userId: user.id, role: "owner" });
    await stripeTransactionRepository.create({
      userId: user.id,
      organizationId: personalOrganization.id,
      type: "affiliate_commission",
      status: "succeeded",
      amount: 500,
      currency: "usd"
    });

    const response = await request(token, { organizationId: team.id });
    const body = (await response.json()) as AffiliateProfileResponse;

    expect(response.status).toBe(200);
    expect(body.data).toMatchObject({
      stats: { totalCommissionUsd: 5, monthCommissionUsd: 5 },
      commissions: [{ amountUsd: 5, reversedUsd: 0 }]
    });
  });

  it("never includes the referred user's id or email in the response", async () => {
    const { token, user } = await setup();
    const affiliate = await affiliateRepository.create({
      userId: user.id,
      code: faker.string.alpha({ length: 8, casing: "lower" }),
      approvedAt: new Date(),
      approvedBy: "ops@akash.network"
    });
    const referredUser = await userRepository.create({ userId: faker.string.uuid(), email: "referred-user@example.com" });
    await referralRepository.createIfAbsent({ referredUserId: referredUser.id, affiliateId: affiliate.id });
    await stripeTransactionRepository.create({
      userId: referredUser.id,
      organizationId: await seedPersonalOrganizationIdOf(referredUser.id),
      type: "payment_intent",
      status: "succeeded",
      amount: 10000,
      currency: "usd"
    });
    await stripeTransactionRepository.create({
      userId: user.id,
      organizationId: await seedPersonalOrganizationIdOf(user.id),
      type: "affiliate_commission",
      status: "succeeded",
      amount: 500,
      currency: "usd"
    });

    const response = await request(token);
    const rawBody = await response.text();

    expect(rawBody).not.toContain(referredUser.id);
    expect(rawBody).not.toContain(referredUser.userId);
    expect(rawBody).not.toContain("referred-user@example.com");
  });

  it("does not expose another user's affiliate profile", async () => {
    const { token } = await setup();
    const stranger = await setup();
    await affiliateRepository.create({
      userId: stranger.user.id,
      code: faker.string.alpha({ length: 8, casing: "lower" }),
      approvedAt: new Date(),
      approvedBy: "ops@akash.network"
    });

    const response = await request(token);

    expect(await response.json()).toEqual({ data: null });
  });

  async function request(token?: string, options: { organizationId?: string } = {}) {
    return app.request("/v1/affiliates/me", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(options.organizationId ? { "x-organization-id": options.organizationId } : {})
      }
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
