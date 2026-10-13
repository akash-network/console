import type { LoggerService } from "@akashnetwork/logging";
import { faker } from "@faker-js/faker";
import { and, eq, sql } from "drizzle-orm";
import Stripe from "stripe";
import { container } from "tsyringe";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { StripeTransactionRepository } from "@src/billing/repositories";
import type { CustomerService } from "@src/billing/services/customer/customer.service";
import type { Payer } from "@src/billing/services/payer/payer";
import { StripeTransactionService } from "@src/billing/services/stripe-transaction/stripe-transaction.service";
import { type ApiPgDatabase, POSTGRES_DB, resolveTable, TxService } from "@src/core";
import { CouponRedemptionService } from "./coupon-redemption.service";

import { seedOrganization } from "@test/seeders/db/organization.seeder";
import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";
import { createTestCoupon, createTestInvoice, createTestPromotionCode } from "@test/seeders/stripe-test-data.seeder";

describe(CouponRedemptionService.name, () => {
  it("lets one of two simultaneous redemptions of the same coupon by one person claim it, across their personal and team payers", async () => {
    const { service, ownPayer, teamPayer, findClaims, code } = await setup();

    const results = await Promise.allSettled([service.redeemCoupon(ownPayer, code), service.redeemCoupon(teamPayer, code)]);

    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect(rejectionMessagesOf(results)).toEqual(["Promotion code has already been used"]);
    expect((await findClaims()).filter(claim => claim.status !== "failed")).toHaveLength(1);
  });

  it("lets another payer claim the coupon once the person's earlier claim failed", async () => {
    const { service, stripe, ownPayer, teamPayer, findClaims, code } = await setup();
    vi.spyOn(stripe.invoiceItems, "create").mockRejectedValueOnce(new Error("stripe unavailable"));

    await expect(service.redeemCoupon(ownPayer, code)).rejects.toThrow("stripe unavailable");
    await service.redeemCoupon(teamPayer, code);

    expect((await findClaims()).map(claim => claim.status).sort()).toEqual(["failed", "pending"]);
  });

  it("keeps a stale claim released once its draft invoice was deleted, even when the new claim then fails", async () => {
    const { service, stripe, ownPayer, teamPayer, findClaims, code, insertStaleClaim } = await setup();
    const staleClaim = await insertStaleClaim(ownPayer);
    const deleteInvoice = vi.spyOn(stripe.invoices, "del").mockResolvedValue(mock());
    vi.spyOn(container.resolve(StripeTransactionService), "recordCouponClaim").mockRejectedValueOnce(new Error("db unavailable"));

    await expect(service.redeemCoupon(teamPayer, code)).rejects.toThrow("db unavailable");

    expect(deleteInvoice).toHaveBeenCalledWith(staleClaim.stripeInvoiceId);
    expect((await findClaims()).find(claim => claim.id === staleClaim.id)).toMatchObject({ status: "failed" });
  });

  it("releases a stale claim whose invoice no longer exists at Stripe and claims the coupon for the other payer", async () => {
    const { service, stripe, ownPayer, teamPayer, findClaims, code, insertStaleClaim } = await setup();
    const staleClaim = await insertStaleClaim(ownPayer);
    vi.spyOn(stripe.invoices, "retrieve").mockRejectedValue(
      new Stripe.errors.StripeInvalidRequestError({
        type: "invalid_request_error",
        code: "resource_missing",
        message: "No such invoice"
      } as Stripe.StripeRawError)
    );

    await service.redeemCoupon(teamPayer, code);

    const claims = await findClaims();
    expect(claims.find(claim => claim.id === staleClaim.id)).toMatchObject({ status: "failed" });
    expect(claims.filter(claim => claim.status === "pending")).toEqual([expect.objectContaining({ organizationId: teamPayer.organizationId })]);
  });

  function rejectionMessagesOf(results: PromiseSettledResult<unknown>[]): string[] {
    return results.flatMap(result => (result.status === "rejected" ? [String(result.reason?.message)] : []));
  }

  async function setup() {
    const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);
    const user = await seedUser({ stripeCustomerId: `cus_${faker.string.alphanumeric(14)}` });
    const [personal, team] = await Promise.all([
      seedOrganization({ type: "personal", createdByUserId: user.id }),
      seedOrganization({ type: "team", stripeCustomerId: `cus_${faker.string.alphanumeric(14)}` })
    ]);
    const ownPayer: Payer = { user, organizationId: personal.id, stripeCustomerId: user.stripeCustomerId };
    const teamPayer: Payer = { user, organizationId: team.id, team, stripeCustomerId: team.stripeCustomerId };

    const couponId = `coupon_${faker.string.alphanumeric(10)}`;
    const coupon = createTestCoupon({ id: couponId, amount_off: 1000, percent_off: null, valid: true, currency: "usd" });
    const promotionCode = createTestPromotionCode({ id: `promo_${faker.string.alphanumeric(10)}`, promotion: { type: "coupon", coupon } });

    const stripe = new Stripe(`sk_test_${faker.string.alphanumeric(32)}`, { apiVersion: "2025-10-29.clover", httpClient: Stripe.createFetchHttpClient() });
    vi.spyOn(stripe.promotionCodes, "list").mockResolvedValue(mock<Stripe.Response<Stripe.ApiList<Stripe.PromotionCode>>>({ data: [promotionCode] }));
    vi.spyOn(stripe.invoices, "create").mockImplementation(async () => createTestInvoice({ id: `in_${faker.string.alphanumeric(14)}`, status: "draft" }));
    vi.spyOn(stripe.invoiceItems, "create").mockResolvedValue(mock<Stripe.Response<Stripe.InvoiceItem>>());
    vi.spyOn(stripe.invoices, "finalizeInvoice").mockImplementation(async id => createTestInvoice({ id, status: "paid" }));
    vi.spyOn(stripe.invoices, "voidInvoice").mockResolvedValue(mock<Stripe.Response<Stripe.Invoice>>());
    vi.spyOn(stripe.invoices, "retrieve").mockImplementation(async id => createTestInvoice({ id, status: "draft" }));
    vi.spyOn(stripe.invoices, "del").mockResolvedValue(mock());

    const customerService = mock<CustomerService>();
    customerService.getStripeCustomerId.mockImplementation(async payer => payer.stripeCustomerId!);

    const service = new CouponRedemptionService(
      stripe,
      customerService,
      container.resolve(StripeTransactionService),
      container.resolve(StripeTransactionRepository),
      container.resolve(TxService),
      () => mock<LoggerService>()
    );

    const transactions = resolveTable("StripeTransactions");
    const findClaims = async () =>
      await db
        .select()
        .from(transactions)
        .where(and(eq(transactions.userId, user.id), eq(transactions.stripeCouponId, couponId)));

    const insertStaleClaim = async (payer: Payer) => {
      const [claim] = await db
        .insert(transactions)
        .values({
          userId: user.id,
          organizationId: payer.organizationId,
          type: "coupon_claim",
          status: "pending",
          amount: 1000,
          stripeCouponId: couponId,
          stripeInvoiceId: `in_stale_${faker.string.alphanumeric(10)}`,
          createdAt: sql`now() - interval '2 hours'`
        })
        .returning();

      return claim;
    };

    return { service, stripe, ownPayer, teamPayer, findClaims, insertStaleClaim, code: promotionCode.code };
  }
});
