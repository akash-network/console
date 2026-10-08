import { describe, expect, it } from "vitest";

import type { CreditsAdded } from "@src/billing/events/credits-added";
import type { EventPayload } from "@src/core";
import { buildCreditsAddedSlackMessage } from "./credits-added-slack-message";

const USER_ID = "11111111-2222-4333-8444-555555555555";
const AMPLITUDE_PROJECT_URL = "https://app.amplitude.com/analytics/example-org/project/100001";
const ADMIN_URL = "https://console-admin.example.com";
const STRIPE_DASHBOARD_URL = "https://dashboard.stripe.example/acct_test";

describe(buildCreditsAddedSlackMessage.name, () => {
  it.each([
    { source: "payment_intent", isAutoRecharge: false, label: ":credit_card: *Card purchase*" },
    { source: "payment_intent", isAutoRecharge: true, label: ":repeat: *Auto-recharge*" },
    { source: "coupon_claim", isAutoRecharge: false, label: ":ticket: *Coupon claim*" },
    { source: "manual_credit", isAutoRecharge: false, label: ":gift: *Admin credit*" },
    { source: "affiliate_commission", isAutoRecharge: false, label: ":handshake: *Affiliate commission*" }
  ] as const)(
    "labels a $source credit (auto-recharge: $isAutoRecharge) from a returning customer with the credited amount in bold",
    ({ source, isAutoRecharge, label }) => {
      const message = setup({ event: { source, isAutoRecharge, paidAmountCents: 2505 }, hasPaidBefore: true });

      expect(lines(message)[0]).toBe(`${label} · *$25.05* credited · Returning customer`);
    }
  );

  it.each([
    { isAutoRecharge: false, label: ":credit_card: *Card purchase*" },
    { isAutoRecharge: true, label: ":repeat: *Auto-recharge*" }
  ])("calls the buyer a new customer when the $label is their first paid purchase", ({ isAutoRecharge, label }) => {
    const message = setup({ event: { source: "payment_intent", isAutoRecharge }, hasPaidBefore: false });

    expect(lines(message)[0]).toBe(`${label} · *$25.00* credited · :new: New customer`);
  });

  it.each([
    { source: "coupon_claim", label: ":ticket: *Coupon claim*" },
    { source: "manual_credit", label: ":gift: *Admin credit*" },
    { source: "affiliate_commission", label: ":handshake: *Affiliate commission*" }
  ] as const)("says a $source buyer who never paid has no paid purchase yet rather than calling them a customer", ({ source, label }) => {
    const message = setup({ event: { source }, hasPaidBefore: false });

    expect(lines(message)[0]).toBe(`${label} · *$25.00* credited · No paid purchase yet`);
  });

  it("credits the bonus on top of the payment and breaks both down next to the buyer", () => {
    const message = setup({ event: { paidAmountCents: 10000, bonusAmountCents: 1000 }, hasPaidBefore: false });

    expect(lines(message).slice(0, 2)).toEqual([
      ":credit_card: *Card purchase* · *$110.00* credited · :new: New customer",
      "buyer@example.com · $100.00 paid + $10.00 first-purchase bonus"
    ]);
  });

  it("names the buyer by email alone when there is no bonus", () => {
    const message = setup({ event: { bonusAmountCents: 0 } });

    expect(lines(message)[1]).toBe("buyer@example.com");
  });

  it.each([null, undefined, ""])("names the buyer by user id when the email is %j", email => {
    const message = setup({ email });

    expect(lines(message)[1]).toBe(USER_ID);
  });

  it("escapes the characters Slack reads as markup in the email", () => {
    const message = setup({ email: "a&b<c>@example.com" });

    expect(lines(message)[1]).toBe("a&amp;b&lt;c&gt;@example.com");
  });

  it("links to the user's Amplitude profile, admin page, Stripe customer and Stripe payment in that order", () => {
    const message = setup({ event: { stripeCustomerId: "cus_1", stripePaymentIntentId: "pi_1" } });

    expect(lines(message)[2]).toBe(
      [
        `<${AMPLITUDE_PROJECT_URL}/search/user_id%3D${USER_ID}|Amplitude sessions>`,
        `<${ADMIN_URL}/users/${USER_ID}|Admin>`,
        `<${STRIPE_DASHBOARD_URL}/customers/cus_1|Stripe customer>`,
        `<${STRIPE_DASHBOARD_URL}/payments/pi_1|Stripe payment>`
      ].join(" · ")
    );
  });

  it("links only to Amplitude when no admin URL is configured", () => {
    const message = setup({ adminUrl: undefined });

    expect(lines(message)[2]).toBe(`<${AMPLITUDE_PROJECT_URL}/search/user_id%3D${USER_ID}|Amplitude sessions>`);
  });

  it("links only to the admin page when no Amplitude URL is configured", () => {
    const message = setup({ amplitudeProjectUrl: undefined });

    expect(lines(message)[2]).toBe(`<${ADMIN_URL}/users/${USER_ID}|Admin>`);
  });

  describe("when only the Stripe dashboard URL is configured", () => {
    it("links to the payment rather than the invoice when the credit has both", () => {
      const message = setupStripeOnly({ stripeCustomerId: "cus_1", stripePaymentIntentId: "pi_1", stripeInvoiceId: "in_1" });

      expect(lines(message)[2]).toBe(`<${STRIPE_DASHBOARD_URL}/customers/cus_1|Stripe customer> · <${STRIPE_DASHBOARD_URL}/payments/pi_1|Stripe payment>`);
    });

    it("links to the invoice when the credit has no payment", () => {
      const message = setupStripeOnly({ stripeCustomerId: "cus_1", stripeInvoiceId: "in_1" });

      expect(lines(message)[2]).toBe(`<${STRIPE_DASHBOARD_URL}/customers/cus_1|Stripe customer> · <${STRIPE_DASHBOARD_URL}/invoices/in_1|Stripe invoice>`);
    });

    it("links only to the customer when the credit has neither a payment nor an invoice", () => {
      const message = setupStripeOnly({ stripeCustomerId: "cus_1" });

      expect(lines(message)[2]).toBe(`<${STRIPE_DASHBOARD_URL}/customers/cus_1|Stripe customer>`);
    });

    it("links only to the payment when the customer is unknown", () => {
      const message = setupStripeOnly({ stripePaymentIntentId: "pi_1" });

      expect(lines(message)[2]).toBe(`<${STRIPE_DASHBOARD_URL}/payments/pi_1|Stripe payment>`);
    });

    function setupStripeOnly(event: Partial<EventPayload<CreditsAdded>>) {
      return setup({ event, amplitudeProjectUrl: undefined, adminUrl: undefined });
    }
  });

  it("leaves out the Stripe links when no Stripe dashboard URL is configured", () => {
    const message = setup({ event: { stripeCustomerId: "cus_1", stripePaymentIntentId: "pi_1" }, stripeDashboardUrl: undefined });

    expect(lines(message)[2]).toBe(`<${AMPLITUDE_PROJECT_URL}/search/user_id%3D${USER_ID}|Amplitude sessions> · <${ADMIN_URL}/users/${USER_ID}|Admin>`);
  });

  it("leaves out the links line when no URL is configured", () => {
    const message = setup({
      event: { stripeCustomerId: "cus_1", stripePaymentIntentId: "pi_1" },
      amplitudeProjectUrl: undefined,
      adminUrl: undefined,
      stripeDashboardUrl: undefined
    });

    expect(lines(message)).toEqual([":credit_card: *Card purchase* · *$25.00* credited · Returning customer", "buyer@example.com"]);
  });

  function lines(message: { text: string }) {
    return message.text.split("\n");
  }

  function setup(input: {
    event?: Partial<EventPayload<CreditsAdded>>;
    email?: string | null;
    hasPaidBefore?: boolean;
    amplitudeProjectUrl?: string;
    adminUrl?: string;
    stripeDashboardUrl?: string;
  }) {
    return buildCreditsAddedSlackMessage({
      event: {
        version: 1,
        userId: USER_ID,
        transactionId: "tx-1",
        source: "payment_intent",
        isAutoRecharge: false,
        paidAmountCents: 2500,
        bonusAmountCents: 0,
        ...input.event
      },
      email: "email" in input ? input.email : "buyer@example.com",
      hasPaidBefore: input.hasPaidBefore ?? true,
      amplitudeProjectUrl: "amplitudeProjectUrl" in input ? input.amplitudeProjectUrl : AMPLITUDE_PROJECT_URL,
      adminUrl: "adminUrl" in input ? input.adminUrl : ADMIN_URL,
      stripeDashboardUrl: "stripeDashboardUrl" in input ? input.stripeDashboardUrl : STRIPE_DASHBOARD_URL
    });
  }
});
