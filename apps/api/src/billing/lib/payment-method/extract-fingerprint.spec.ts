import crypto from "crypto";
import type Stripe from "stripe";
import { describe, expect, it } from "vitest";

import { extractFingerprint } from "./extract-fingerprint";

import { generatePaymentMethod } from "@test/seeders/payment-method.seeder";

describe("extractFingerprint", () => {
  it("returns the card fingerprint when present", () => {
    const paymentMethod = generatePaymentMethod({ card: { fingerprint: "fp_card_1" } });

    expect(extractFingerprint(paymentMethod)).toBe("fp_card_1");
  });

  it("hashes the lowercased Link email when there is no card fingerprint", () => {
    const paymentMethod = generatePaymentMethod({
      type: "link",
      card: null,
      link: { email: "User@Test.com" }
    } as unknown as Parameters<typeof generatePaymentMethod>[0]);
    const expected = `link_${crypto.createHash("sha256").update("user@test.com").digest("hex")}`;

    expect(extractFingerprint(paymentMethod)).toBe(expected);
  });

  it("returns undefined when neither a card fingerprint nor a Link email identifies the method", () => {
    const paymentMethod = generatePaymentMethod({
      type: "us_bank_account",
      card: null
    } as unknown as Parameters<typeof generatePaymentMethod>[0]);

    expect(extractFingerprint(paymentMethod as Stripe.PaymentMethod)).toBeUndefined();
  });
});
