import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ReferralRepository, ReferralSummary } from "@src/affiliate/repositories/referral/referral.repository";
import type { AffiliateService } from "@src/affiliate/services/affiliate/affiliate.service";
import type { BillingConfig } from "@src/billing/providers";
import { AffiliateReferralService } from "./affiliate-referral.service";

import { createAffiliate } from "@test/seeders/affiliate.seeder";

describe(AffiliateReferralService.name, () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("rejects a caller who is not an approved affiliate", async () => {
    const { service, affiliateService } = setup();
    affiliateService.findActiveByUserId.mockResolvedValue(undefined);

    await expect(service.listReferrals("user-1", { limit: 20, offset: 0 })).rejects.toMatchObject({ status: 404, errorCode: "affiliate_not_found" });
  });

  it("reads one page of the affiliate's referrals with the total and echoes the page bounds", async () => {
    const { service, affiliate, referralRepository } = setup();
    referralRepository.countByAffiliate.mockResolvedValue(42);

    const page = await service.listReferrals(affiliate.userId, { limit: 10, offset: 20 });

    expect(referralRepository.countByAffiliate).toHaveBeenCalledWith(affiliate.id);
    expect(referralRepository.findSummariesByAffiliate).toHaveBeenCalledWith(
      { affiliateId: affiliate.id, affiliateUserId: affiliate.userId },
      { limit: 10, offset: 20 }
    );
    expect(page.pagination).toEqual({ total: 42, limit: 10, offset: 20 });
  });

  it("shows each referral by a short code derived from its id, with its join date and usd amounts", async () => {
    const { service, affiliate, referralRepository } = setup();
    referralRepository.findSummariesByAffiliate.mockResolvedValue([
      buildSummary({ id: "referral-1", createdAt: new Date("2024-06-10T12:00:00Z"), paidCents: 58000, earnedCents: 2900 })
    ]);

    const { referrals } = await service.listReferrals(affiliate.userId, { limit: 20, offset: 0 });

    expect(referrals).toMatchObject([
      {
        code: createHash("sha256").update("referral-1").digest("hex").slice(0, 6).toUpperCase(),
        joinedAt: "2024-06-10T12:00:00.000Z",
        commissionEndsAt: "2025-06-10T12:00:00.000Z",
        paidUsd: 580,
        earnedUsd: 29
      }
    ]);
    expect(referrals[0].code).toMatch(/^[0-9A-F]{6}$/);
  });

  it("rounds a partial month left in the commission window up", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-08-20T00:00:00Z"));
    const { service, affiliate, referralRepository } = setup();
    referralRepository.findSummariesByAffiliate.mockResolvedValue([buildSummary({ createdAt: new Date("2024-06-10T12:00:00Z") })]);

    const { referrals } = await service.listReferrals(affiliate.userId, { limit: 20, offset: 0 });

    expect(referrals[0].commissionMonthsLeft).toBe(10);
  });

  it("counts exact months left without rounding them up", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-08-10T12:00:00Z"));
    const { service, affiliate, referralRepository } = setup();
    referralRepository.findSummariesByAffiliate.mockResolvedValue([buildSummary({ createdAt: new Date("2024-06-10T12:00:00Z") })]);

    const { referrals } = await service.listReferrals(affiliate.userId, { limit: 20, offset: 0 });

    expect(referrals[0].commissionMonthsLeft).toBe(10);
  });

  it("shows one month left in the last days of the window", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-06-01T00:00:00Z"));
    const { service, affiliate, referralRepository } = setup();
    referralRepository.findSummariesByAffiliate.mockResolvedValue([buildSummary({ createdAt: new Date("2024-06-10T12:00:00Z") })]);

    const { referrals } = await service.listReferrals(affiliate.userId, { limit: 20, offset: 0 });

    expect(referrals[0].commissionMonthsLeft).toBe(1);
  });

  it("shows no months left once the window has closed", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-06-10T12:00:00Z"));
    const { service, affiliate, referralRepository } = setup();
    referralRepository.findSummariesByAffiliate.mockResolvedValue([buildSummary({ createdAt: new Date("2024-06-10T12:00:00Z") })]);

    const { referrals } = await service.listReferrals(affiliate.userId, { limit: 20, offset: 0 });

    expect(referrals[0].commissionMonthsLeft).toBe(0);
  });

  it("calls a referral who paid by card paying, even with a trial still running", async () => {
    const { service, affiliate, referralRepository } = setup();
    referralRepository.findSummariesByAffiliate.mockResolvedValue([buildSummary({ hasPaid: true, wallet: trialWallet(new Date()) })]);

    const { referrals } = await service.listReferrals(affiliate.userId, { limit: 20, offset: 0 });

    expect(referrals[0].status).toBe("paying");
  });

  it("calls a referral on trial while their trial wallet is within the trial length", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-20T00:00:00Z"));
    const { service, affiliate, referralRepository } = setup({ trialDays: 14 });
    referralRepository.findSummariesByAffiliate.mockResolvedValue([buildSummary({ wallet: trialWallet(new Date("2024-06-10T00:00:00Z")) })]);

    const { referrals } = await service.listReferrals(affiliate.userId, { limit: 20, offset: 0 });

    expect(referrals[0].status).toBe("on_trial");
  });

  it("calls a referral inactive once the trial length has passed", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-24T00:00:00Z"));
    const { service, affiliate, referralRepository } = setup({ trialDays: 14 });
    referralRepository.findSummariesByAffiliate.mockResolvedValue([buildSummary({ wallet: trialWallet(new Date("2024-06-10T00:00:00Z")) })]);

    const { referrals } = await service.listReferrals(affiliate.userId, { limit: 20, offset: 0 });

    expect(referrals[0].status).toBe("inactive");
  });

  it("calls a referral inactive when their wallet left the trial without a card payment or never existed", async () => {
    const { service, affiliate, referralRepository } = setup();
    referralRepository.findSummariesByAffiliate.mockResolvedValue([
      buildSummary({ wallet: { isTrialing: false, activatedAt: new Date(), createdAt: new Date() } }),
      buildSummary({ wallet: null })
    ]);

    const { referrals } = await service.listReferrals(affiliate.userId, { limit: 20, offset: 0 });

    expect(referrals.map(referral => referral.status)).toEqual(["inactive", "inactive"]);
  });

  function trialWallet(startedAt: Date): ReferralSummary["wallet"] {
    return { isTrialing: true, activatedAt: startedAt, createdAt: startedAt };
  }

  function buildSummary(overrides: Partial<ReferralSummary> = {}): ReferralSummary {
    return { id: "referral-id", createdAt: new Date(), hasPaid: false, paidCents: 0, earnedCents: 0, wallet: null, ...overrides };
  }

  function setup(input: { trialDays?: number } = {}) {
    const affiliate = createAffiliate({ revokedAt: null });
    const affiliateService = mock<AffiliateService>();
    affiliateService.findActiveByUserId.mockResolvedValue(affiliate);
    const referralRepository = mock<ReferralRepository>();
    referralRepository.countByAffiliate.mockResolvedValue(0);
    referralRepository.findSummariesByAffiliate.mockResolvedValue([]);
    const billingConfig = mock<BillingConfig>({ TRIAL_ALLOWANCE_EXPIRATION_DAYS: input.trialDays ?? 30 });

    const service = new AffiliateReferralService(affiliateService, referralRepository, billingConfig);

    return { service, affiliate, affiliateService, referralRepository };
  }
});
