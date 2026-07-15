import { faker } from "@faker-js/faker";
import { eq } from "drizzle-orm";
import nock from "nock";
import stripe from "stripe";
import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BILLING_CONFIG, type BillingConfig } from "@src/billing/providers";
import { StripeTransactionRepository, UserWalletRepository } from "@src/billing/repositories";
import { RefillService } from "@src/billing/services/refill/refill.service";
import type { ApiPgDatabase } from "@src/core";
import { POSTGRES_DB, resolveTable } from "@src/core";
import { app } from "@src/rest-app";
import { UserRepository } from "@src/user/repositories";

import { createAkashAddress } from "@test/seeders/akash-address.seeder";

describe("Stripe webhook", () => {
  const userWalletsTable = resolveTable("UserWallets");
  const stripeTransactionsTable = resolveTable("StripeTransactions");
  const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);
  const userWalletsQuery = db.query.UserWallets;
  const stripeTransactionRepository = container.resolve(StripeTransactionRepository);
  const billingConfig = container.resolve<BillingConfig>(BILLING_CONFIG);
  const userRepository = container.resolve(UserRepository);

  const generateChargeRefundedPayload = (chargeId: string, customerId: string, amountRefunded: number, previousAmountRefunded = 0) =>
    JSON.stringify({
      data: {
        object: {
          id: chargeId,
          customer: customerId,
          amount_refunded: amountRefunded,
          refunded: amountRefunded > 0
        },
        previous_attributes: {
          amount_refunded: previousAmountRefunded
        }
      },
      type: "charge.refunded"
    });

  const generateInvoicePayload = ({
    type = "invoice.paid",
    id,
    customer
  }: {
    type?: "invoice.paid" | "invoice.payment_succeeded";
    id: string;
    customer: string;
  }) =>
    JSON.stringify({
      data: {
        object: {
          id,
          object: "invoice",
          customer,
          amount_paid: 0,
          currency: "usd"
        }
      },
      type
    });

  const getWebhookResponse = async (payload: string) => {
    const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!stripeWebhookSecret) throw new Error("STRIPE_WEBHOOK_SECRET env variable is not set");

    return await app.request("/v1/stripe-webhook", {
      method: "POST",
      body: payload,
      headers: new Headers({
        "Content-Type": "text/plain",
        "Stripe-Signature": stripe.webhooks.generateTestHeaderString({
          payload,
          secret: stripeWebhookSecret
        })
      })
    });
  };

  afterEach(() => {
    vi.restoreAllMocks();
    nock.cleanAll();
  });

  describe("POST /v1/stripe-webhook", () => {
    describe("payment_intent.succeeded", () => {
      it("handles duplicate webhook deliveries idempotently", async () => {
        const paymentIntentId = `pi_${faker.string.alphanumeric(24)}`;
        const chargeId = `ch_${faker.string.alphanumeric(24)}`;
        const amount = 10000;

        const { user, stripeCustomerId } = await setup();

        await stripeTransactionRepository.create({
          userId: user.id,
          type: "payment_intent",
          status: "created",
          amount,
          currency: "usd",
          stripePaymentIntentId: paymentIntentId
        });

        nock("https://api.stripe.com")
          .get(`/v1/charges/${chargeId}`)
          .reply(200, {
            id: chargeId,
            payment_method_details: { card: { brand: "visa", last4: "4242" } },
            receipt_url: "https://pay.stripe.com/receipts/test"
          });

        const payload = JSON.stringify({
          data: {
            object: {
              id: paymentIntentId,
              customer: stripeCustomerId,
              amount,
              amount_received: amount,
              latest_charge: chargeId,
              payment_method_types: ["card"],
              metadata: {}
            }
          },
          type: "payment_intent.succeeded"
        });

        // First webhook delivery
        const response1 = await getWebhookResponse(payload);
        expect(response1.status).toBe(200);

        const walletAfterFirst = await userWalletsQuery.findFirst({ where: eq(userWalletsTable.userId, user.id) });
        // Functional tests run with FEATURE_FLAGS_ENABLE_ALL, so this first $100 purchase earns the 10% first-purchase bonus
        const firstPurchaseBonus = amount / 10;
        const expectedBalance = billingConfig.TRIAL_DEPLOYMENT_ALLOWANCE_AMOUNT + (amount + firstPurchaseBonus) * 10000;
        expect(walletAfterFirst?.deploymentAllowance).toBe(`${expectedBalance}.00`);

        // Second webhook delivery (retry) - should not double-credit nor double-grant the bonus
        const response2 = await getWebhookResponse(payload);
        expect(response2.status).toBe(200);

        const walletAfterSecond = await userWalletsQuery.findFirst({ where: eq(userWalletsTable.userId, user.id) });
        // Balance should be unchanged - no double credit
        expect(walletAfterSecond?.deploymentAllowance).toBe(`${expectedBalance}.00`);
      });

      it("tops up wallet when payment intent succeeds", async () => {
        const paymentIntentId = `pi_${faker.string.alphanumeric(24)}`;
        const chargeId = `ch_${faker.string.alphanumeric(24)}`;
        const amount = 10000; // $100 in cents

        // Create user with wallet and Stripe customer ID
        const { user, stripeCustomerId } = await setup();

        // Create a transaction record first (simulating what createPaymentIntent does)
        await stripeTransactionRepository.create({
          userId: user.id,
          type: "payment_intent",
          status: "created",
          amount,
          currency: "usd",
          stripePaymentIntentId: paymentIntentId
        });

        // Mock the charge retrieval for card details
        nock("https://api.stripe.com")
          .get(`/v1/charges/${chargeId}`)
          .reply(200, {
            id: chargeId,
            payment_method_details: {
              card: {
                brand: "visa",
                last4: "4242"
              }
            },
            receipt_url: "https://pay.stripe.com/receipts/test"
          });

        const payload = JSON.stringify({
          data: {
            object: {
              id: paymentIntentId,
              customer: stripeCustomerId,
              amount,
              amount_received: amount,
              latest_charge: chargeId,
              payment_method_types: ["card"],
              metadata: {}
            }
          },
          type: "payment_intent.succeeded"
        });

        const webhookResponse = await getWebhookResponse(payload);

        const userWallet = await userWalletsQuery.findFirst({ where: eq(userWalletsTable.userId, user.id) });
        const transaction = await stripeTransactionRepository.findByPaymentIntentId(paymentIntentId);

        // Calculate expected balance: trial allowance + payment amount + 10% first-purchase bonus (cents * 10000 multiplier for uakt)
        const firstPurchaseBonus = amount / 10;
        const expectedBalance = billingConfig.TRIAL_DEPLOYMENT_ALLOWANCE_AMOUNT + (amount + firstPurchaseBonus) * 10000;

        expect(webhookResponse.status).toBe(200);
        expect(userWallet).toMatchObject({
          userId: user.id,
          deploymentAllowance: `${expectedBalance}.00`,
          isTrialing: false
        });
        expect(transaction).toMatchObject({
          status: "succeeded",
          stripeChargeId: chargeId,
          paymentMethodType: "card",
          bonusAmount: firstPurchaseBonus
        });
      });

      it("caps the first-purchase bonus at $100 for large payments", async () => {
        const paymentIntentId = `pi_${faker.string.alphanumeric(24)}`;
        const chargeId = `ch_${faker.string.alphanumeric(24)}`;
        const amount = 1000000; // $10,000 in cents

        const { user, stripeCustomerId } = await setup();

        await stripeTransactionRepository.create({
          userId: user.id,
          type: "payment_intent",
          status: "created",
          amount,
          currency: "usd",
          stripePaymentIntentId: paymentIntentId
        });

        nock("https://api.stripe.com")
          .get(`/v1/charges/${chargeId}`)
          .reply(200, {
            id: chargeId,
            payment_method_details: { card: { brand: "visa", last4: "4242" } },
            receipt_url: "https://pay.stripe.com/receipts/test"
          });

        const payload = JSON.stringify({
          data: {
            object: {
              id: paymentIntentId,
              customer: stripeCustomerId,
              amount,
              amount_received: amount,
              latest_charge: chargeId,
              payment_method_types: ["card"],
              metadata: {}
            }
          },
          type: "payment_intent.succeeded"
        });

        const webhookResponse = await getWebhookResponse(payload);

        const userWallet = await userWalletsQuery.findFirst({ where: eq(userWalletsTable.userId, user.id) });
        const transaction = await stripeTransactionRepository.findByPaymentIntentId(paymentIntentId);
        const cappedBonus = 10000; // $100 in cents
        const expectedBalance = billingConfig.TRIAL_DEPLOYMENT_ALLOWANCE_AMOUNT + (amount + cappedBonus) * 10000;

        expect(webhookResponse.status).toBe(200);
        expect(userWallet?.deploymentAllowance).toBe(`${expectedBalance}.00`);
        expect(transaction).toMatchObject({ status: "succeeded", bonusAmount: cappedBonus });
      });

      it("does not grant the bonus below the $100 minimum", async () => {
        const paymentIntentId = `pi_${faker.string.alphanumeric(24)}`;
        const chargeId = `ch_${faker.string.alphanumeric(24)}`;
        const amount = 9900; // $99 in cents

        const { user, stripeCustomerId } = await setup();

        await stripeTransactionRepository.create({
          userId: user.id,
          type: "payment_intent",
          status: "created",
          amount,
          currency: "usd",
          stripePaymentIntentId: paymentIntentId
        });

        nock("https://api.stripe.com")
          .get(`/v1/charges/${chargeId}`)
          .reply(200, {
            id: chargeId,
            payment_method_details: { card: { brand: "visa", last4: "4242" } },
            receipt_url: "https://pay.stripe.com/receipts/test"
          });

        const payload = JSON.stringify({
          data: {
            object: {
              id: paymentIntentId,
              customer: stripeCustomerId,
              amount,
              amount_received: amount,
              latest_charge: chargeId,
              payment_method_types: ["card"],
              metadata: {}
            }
          },
          type: "payment_intent.succeeded"
        });

        const webhookResponse = await getWebhookResponse(payload);

        const userWallet = await userWalletsQuery.findFirst({ where: eq(userWalletsTable.userId, user.id) });
        const transaction = await stripeTransactionRepository.findByPaymentIntentId(paymentIntentId);
        const expectedBalance = billingConfig.TRIAL_DEPLOYMENT_ALLOWANCE_AMOUNT + amount * 10000;

        expect(webhookResponse.status).toBe(200);
        expect(userWallet?.deploymentAllowance).toBe(`${expectedBalance}.00`);
        expect(transaction).toMatchObject({ status: "succeeded", bonusAmount: 0 });
      });

      it("does not grant the bonus when the user already completed a paid purchase", async () => {
        const paymentIntentId = `pi_${faker.string.alphanumeric(24)}`;
        const chargeId = `ch_${faker.string.alphanumeric(24)}`;
        const amount = 10000;

        const { user, stripeCustomerId } = await setup();

        // Prior completed paid purchase consumed the one-time eligibility
        await stripeTransactionRepository.create({
          userId: user.id,
          type: "payment_intent",
          status: "succeeded",
          amount: 20000,
          currency: "usd",
          stripePaymentIntentId: `pi_${faker.string.alphanumeric(24)}`
        });

        await stripeTransactionRepository.create({
          userId: user.id,
          type: "payment_intent",
          status: "created",
          amount,
          currency: "usd",
          stripePaymentIntentId: paymentIntentId
        });

        nock("https://api.stripe.com")
          .get(`/v1/charges/${chargeId}`)
          .reply(200, {
            id: chargeId,
            payment_method_details: { card: { brand: "visa", last4: "4242" } },
            receipt_url: "https://pay.stripe.com/receipts/test"
          });

        const payload = JSON.stringify({
          data: {
            object: {
              id: paymentIntentId,
              customer: stripeCustomerId,
              amount,
              amount_received: amount,
              latest_charge: chargeId,
              payment_method_types: ["card"],
              metadata: {}
            }
          },
          type: "payment_intent.succeeded"
        });

        const webhookResponse = await getWebhookResponse(payload);

        const userWallet = await userWalletsQuery.findFirst({ where: eq(userWalletsTable.userId, user.id) });
        const transaction = await stripeTransactionRepository.findByPaymentIntentId(paymentIntentId);
        const expectedBalance = billingConfig.TRIAL_DEPLOYMENT_ALLOWANCE_AMOUNT + amount * 10000;

        expect(webhookResponse.status).toBe(200);
        expect(userWallet?.deploymentAllowance).toBe(`${expectedBalance}.00`);
        expect(transaction).toMatchObject({ status: "succeeded", bonusAmount: 0 });
      });

      it("grants the bonus exactly once when two first purchases are delivered concurrently", async () => {
        const amount = 10000;
        const paymentIntentIds = [`pi_${faker.string.alphanumeric(24)}`, `pi_${faker.string.alphanumeric(24)}`];
        const chargeIds = [`ch_${faker.string.alphanumeric(24)}`, `ch_${faker.string.alphanumeric(24)}`];

        const { user, stripeCustomerId } = await setup();

        for (const paymentIntentId of paymentIntentIds) {
          await stripeTransactionRepository.create({
            userId: user.id,
            type: "payment_intent",
            status: "created",
            amount,
            currency: "usd",
            stripePaymentIntentId: paymentIntentId
          });
        }

        for (const chargeId of chargeIds) {
          nock("https://api.stripe.com")
            .get(`/v1/charges/${chargeId}`)
            .reply(200, {
              id: chargeId,
              payment_method_details: { card: { brand: "visa", last4: "4242" } },
              receipt_url: "https://pay.stripe.com/receipts/test"
            });
        }

        const payloads = paymentIntentIds.map((paymentIntentId, index) =>
          JSON.stringify({
            data: {
              object: {
                id: paymentIntentId,
                customer: stripeCustomerId,
                amount,
                amount_received: amount,
                latest_charge: chargeIds[index],
                payment_method_types: ["card"],
                metadata: {}
              }
            },
            type: "payment_intent.succeeded"
          })
        );

        const responses = await Promise.all(payloads.map(payload => getWebhookResponse(payload)));
        responses.forEach(response => expect(response.status).toBe(200));

        // The user-row lock serializes the two eligibility checks: whichever webhook commits
        // first wins the bonus, the other sees a prior completed purchase and grants none
        const transactions = await Promise.all(paymentIntentIds.map(id => stripeTransactionRepository.findByPaymentIntentId(id)));
        const bonusAmounts = transactions.map(transaction => transaction?.bonusAmount ?? 0).sort((a, b) => a - b);
        expect(bonusAmounts).toEqual([0, amount / 10]);

        const userWallet = await userWalletsQuery.findFirst({ where: eq(userWalletsTable.userId, user.id) });
        const expectedBalance = billingConfig.TRIAL_DEPLOYMENT_ALLOWANCE_AMOUNT + (amount * 2 + amount / 10) * 10000;
        expect(userWallet?.deploymentAllowance).toBe(`${expectedBalance}.00`);
      });
    });

    describe("invoice.payment_succeeded", () => {
      it("does not grant the bonus for coupon claims nor consume the user's eligibility", async () => {
        const invoiceId = `in_${faker.string.alphanumeric(24)}`;
        const paymentIntentId = `pi_${faker.string.alphanumeric(24)}`;
        const chargeId = `ch_${faker.string.alphanumeric(24)}`;
        const couponAmount = 15000; // $150 coupon, above the bonus minimum
        const purchaseAmount = 10000; // $100 first real purchase

        const { user, stripeCustomerId } = await setup();

        // Coupon claim redeemed via invoice
        await stripeTransactionRepository.create({
          userId: user.id,
          type: "coupon_claim",
          status: "created",
          amount: couponAmount,
          currency: "usd",
          stripeInvoiceId: invoiceId
        });

        const invoicePayload = JSON.stringify({
          data: {
            object: {
              id: invoiceId,
              customer: stripeCustomerId
            }
          },
          type: "invoice.payment_succeeded"
        });

        const invoiceResponse = await getWebhookResponse(invoicePayload);
        expect(invoiceResponse.status).toBe(200);

        const couponTransaction = await stripeTransactionRepository.findByInvoiceId(invoiceId);
        const walletAfterCoupon = await userWalletsQuery.findFirst({ where: eq(userWalletsTable.userId, user.id) });
        const balanceAfterCoupon = billingConfig.TRIAL_DEPLOYMENT_ALLOWANCE_AMOUNT + couponAmount * 10000;

        // Coupon credits only its own amount - no bonus
        expect(couponTransaction).toMatchObject({ status: "succeeded", bonusAmount: 0 });
        expect(walletAfterCoupon?.deploymentAllowance).toBe(`${balanceAfterCoupon}.00`);

        // A later first real purchase still earns the bonus - the coupon did not consume eligibility
        await stripeTransactionRepository.create({
          userId: user.id,
          type: "payment_intent",
          status: "created",
          amount: purchaseAmount,
          currency: "usd",
          stripePaymentIntentId: paymentIntentId
        });

        nock("https://api.stripe.com")
          .get(`/v1/charges/${chargeId}`)
          .reply(200, {
            id: chargeId,
            payment_method_details: { card: { brand: "visa", last4: "4242" } },
            receipt_url: "https://pay.stripe.com/receipts/test"
          });

        const purchasePayload = JSON.stringify({
          data: {
            object: {
              id: paymentIntentId,
              customer: stripeCustomerId,
              amount: purchaseAmount,
              amount_received: purchaseAmount,
              latest_charge: chargeId,
              payment_method_types: ["card"],
              metadata: {}
            }
          },
          type: "payment_intent.succeeded"
        });

        const purchaseResponse = await getWebhookResponse(purchasePayload);
        expect(purchaseResponse.status).toBe(200);

        const purchaseTransaction = await stripeTransactionRepository.findByPaymentIntentId(paymentIntentId);
        const walletAfterPurchase = await userWalletsQuery.findFirst({ where: eq(userWalletsTable.userId, user.id) });
        const purchaseBonus = purchaseAmount / 10;
        const balanceAfterPurchase = balanceAfterCoupon + (purchaseAmount + purchaseBonus) * 10000;

        expect(purchaseTransaction).toMatchObject({ status: "succeeded", bonusAmount: purchaseBonus });
        expect(walletAfterPurchase?.deploymentAllowance).toBe(`${balanceAfterPurchase}.00`);
      });
    });

    describe("payment_intent.payment_failed", () => {
      it("updates transaction status to failed", async () => {
        const paymentIntentId = `pi_${faker.string.alphanumeric(24)}`;
        const amount = 5000;

        const { user, stripeCustomerId } = await setup();

        await stripeTransactionRepository.create({
          userId: user.id,
          type: "payment_intent",
          status: "created",
          amount,
          currency: "usd",
          stripePaymentIntentId: paymentIntentId
        });

        const payload = JSON.stringify({
          data: {
            object: {
              id: paymentIntentId,
              customer: stripeCustomerId,
              amount,
              last_payment_error: {
                message: "Your card was declined."
              }
            }
          },
          type: "payment_intent.payment_failed"
        });

        const webhookResponse = await getWebhookResponse(payload);
        const transaction = await stripeTransactionRepository.findByPaymentIntentId(paymentIntentId);

        expect(webhookResponse.status).toBe(200);
        expect(transaction).toMatchObject({
          status: "failed",
          errorMessage: "Your card was declined."
        });
      });
    });

    describe("charge.refunded", () => {
      it("handles duplicate refund webhook deliveries idempotently", async () => {
        const paymentIntentId = `pi_${faker.string.alphanumeric(24)}`;
        const chargeId = `ch_${faker.string.alphanumeric(24)}`;
        const amount = 50;

        const { user, stripeCustomerId } = await setup();

        await stripeTransactionRepository.create({
          userId: user.id,
          type: "payment_intent",
          status: "succeeded",
          amount,
          currency: "usd",
          stripePaymentIntentId: paymentIntentId,
          stripeChargeId: chargeId
        });

        const payload = generateChargeRefundedPayload(chargeId, stripeCustomerId, amount, 0);

        // First webhook delivery
        const response1 = await getWebhookResponse(payload);
        expect(response1.status).toBe(200);

        const walletAfterFirst = await userWalletsQuery.findFirst({ where: eq(userWalletsTable.userId, user.id) });
        const balanceAfterFirstRefund = walletAfterFirst?.deploymentAllowance;

        // Second webhook delivery (retry) - should not double-deduct
        const response2 = await getWebhookResponse(payload);
        expect(response2.status).toBe(200);

        const walletAfterSecond = await userWalletsQuery.findFirst({ where: eq(userWalletsTable.userId, user.id) });
        // Balance should be unchanged - no double deduction
        expect(walletAfterSecond?.deploymentAllowance).toBe(balanceAfterFirstRefund);
      });

      it("deducts the refund exactly once when duplicate deliveries arrive concurrently", async () => {
        const paymentIntentId = `pi_${faker.string.alphanumeric(24)}`;
        const chargeId = `ch_${faker.string.alphanumeric(24)}`;
        const amount = 50;

        const { user, stripeCustomerId } = await setup();

        await stripeTransactionRepository.create({
          userId: user.id,
          type: "payment_intent",
          status: "succeeded",
          amount,
          currency: "usd",
          stripePaymentIntentId: paymentIntentId,
          stripeChargeId: chargeId
        });

        const payload = generateChargeRefundedPayload(chargeId, stripeCustomerId, amount, 0);

        // The transaction-row lock serializes the two deliveries: the loser re-reads the
        // committed amountRefunded and bails on the idempotency check
        const responses = await Promise.all([getWebhookResponse(payload), getWebhookResponse(payload)]);
        responses.forEach(response => expect(response.status).toBe(200));

        const userWallet = await userWalletsQuery.findFirst({ where: eq(userWalletsTable.userId, user.id) });
        const expectedBalance = billingConfig.TRIAL_DEPLOYMENT_ALLOWANCE_AMOUNT - amount * 10000;
        expect(userWallet?.deploymentAllowance).toBe(`${expectedBalance}.00`);
      });

      it("reduces wallet balance and updates transaction status on full refund", async () => {
        const paymentIntentId = `pi_${faker.string.alphanumeric(24)}`;
        const chargeId = `ch_${faker.string.alphanumeric(24)}`;
        // Use small amount that fits within trial allowance (trial allowance is ~$2)
        const amount = 50; // 50 cents = $0.50

        const { user, stripeCustomerId } = await setup();

        // Create a succeeded transaction
        await stripeTransactionRepository.create({
          userId: user.id,
          type: "payment_intent",
          status: "succeeded",
          amount,
          currency: "usd",
          stripePaymentIntentId: paymentIntentId,
          stripeChargeId: chargeId
        });

        const payload = generateChargeRefundedPayload(chargeId, stripeCustomerId, amount, 0);
        const webhookResponse = await getWebhookResponse(payload);
        const transaction = await stripeTransactionRepository.findByChargeId(chargeId);

        expect(webhookResponse.status).toBe(200);
        expect(transaction).toMatchObject({
          status: "refunded"
        });
      });

      it("handles partial refunds correctly using delta calculation", async () => {
        const chargeId = `ch_${faker.string.alphanumeric(24)}`;
        const paymentIntentId = `pi_${faker.string.alphanumeric(24)}`;
        // Use small amounts that fit within trial allowance
        const totalAmount = 100; // $1.00
        const firstRefund = 30; // $0.30
        const secondRefund = 20; // $0.20

        const { user, stripeCustomerId } = await setup();

        await stripeTransactionRepository.create({
          userId: user.id,
          type: "payment_intent",
          status: "succeeded",
          amount: totalAmount,
          currency: "usd",
          stripePaymentIntentId: paymentIntentId,
          stripeChargeId: chargeId
        });

        // First partial refund: $0.30
        const payload1 = JSON.stringify({
          data: {
            object: {
              id: chargeId,
              customer: stripeCustomerId,
              amount_refunded: firstRefund,
              refunded: false // Not fully refunded
            },
            previous_attributes: {
              amount_refunded: 0
            }
          },
          type: "charge.refunded"
        });

        const response1 = await getWebhookResponse(payload1);
        expect(response1.status).toBe(200);

        // Transaction should still be "succeeded" (not fully refunded)
        let transaction = await stripeTransactionRepository.findByChargeId(chargeId);
        expect(transaction?.status).toBe("succeeded");

        // Second partial refund: $0.20 more (total now $0.50)
        const payload2 = JSON.stringify({
          data: {
            object: {
              id: chargeId,
              customer: stripeCustomerId,
              amount_refunded: firstRefund + secondRefund,
              refunded: false
            },
            previous_attributes: {
              amount_refunded: firstRefund
            }
          },
          type: "charge.refunded"
        });

        const response2 = await getWebhookResponse(payload2);
        expect(response2.status).toBe(200);

        transaction = await stripeTransactionRepository.findByChargeId(chargeId);
        expect(transaction?.status).toBe("succeeded"); // Still not fully refunded
      });
    });

    describe("invoice.paid (manual credit)", () => {
      it("credits the wallet once and keeps the user trialing for a pre-created manual_credit invoice", async () => {
        const invoiceId = `in_${faker.string.alphanumeric(24)}`;
        const amount = 50000; // $500 in cents

        const { user, stripeCustomerId } = await setup();

        // The admin app pre-creates the pending row (direct DB write) before marking the invoice paid
        await stripeTransactionRepository.create({
          userId: user.id,
          type: "manual_credit",
          status: "pending",
          amount,
          currency: "usd",
          stripeInvoiceId: invoiceId,
          description: "Enterprise GPU prepay"
        });

        const response = await getWebhookResponse(generateInvoicePayload({ id: invoiceId, customer: stripeCustomerId }));
        expect(response.status).toBe(200);

        const wallet = await userWalletsQuery.findFirst({ where: eq(userWalletsTable.userId, user.id) });
        const expectedBalance = billingConfig.TRIAL_DEPLOYMENT_ALLOWANCE_AMOUNT + amount * 10000;
        expect(wallet).toMatchObject({
          deploymentAllowance: `${expectedBalance}.00`,
          isTrialing: true // a granted credit must not graduate a trial user
        });

        const rows = await db.query.StripeTransactions.findMany({ where: eq(stripeTransactionsTable.stripeInvoiceId, invoiceId) });
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({ type: "manual_credit", status: "succeeded", amount });
      });

      it("credits exactly once when invoice.paid and invoice.payment_succeeded both fire for the same invoice", async () => {
        const invoiceId = `in_${faker.string.alphanumeric(24)}`;
        const amount = 50000;

        const { user, stripeCustomerId } = await setup();

        await stripeTransactionRepository.create({
          userId: user.id,
          type: "manual_credit",
          status: "pending",
          amount,
          currency: "usd",
          stripeInvoiceId: invoiceId
        });

        const paidResponse = await getWebhookResponse(generateInvoicePayload({ type: "invoice.paid", id: invoiceId, customer: stripeCustomerId }));
        expect(paidResponse.status).toBe(200);

        const succeededResponse = await getWebhookResponse(
          generateInvoicePayload({ type: "invoice.payment_succeeded", id: invoiceId, customer: stripeCustomerId })
        );
        expect(succeededResponse.status).toBe(200);

        const wallet = await userWalletsQuery.findFirst({ where: eq(userWalletsTable.userId, user.id) });
        const expectedBalance = billingConfig.TRIAL_DEPLOYMENT_ALLOWANCE_AMOUNT + amount * 10000;
        expect(wallet?.deploymentAllowance).toBe(`${expectedBalance}.00`);

        const rows = await db.query.StripeTransactions.findMany({ where: eq(stripeTransactionsTable.stripeInvoiceId, invoiceId) });
        expect(rows).toHaveLength(1);
        expect(rows[0].status).toBe("succeeded");
      });

      it("does not credit for an invoice with no matching transaction (double-credit guard)", async () => {
        const invoiceId = `in_${faker.string.alphanumeric(24)}`;

        const { user, stripeCustomerId } = await setup();

        const response = await getWebhookResponse(generateInvoicePayload({ id: invoiceId, customer: stripeCustomerId }));
        expect(response.status).toBe(200);

        const wallet = await userWalletsQuery.findFirst({ where: eq(userWalletsTable.userId, user.id) });
        expect(wallet?.deploymentAllowance).toBe(`${billingConfig.TRIAL_DEPLOYMENT_ALLOWANCE_AMOUNT}.00`);
        expect(wallet?.isTrialing).toBe(true);

        const rows = await db.query.StripeTransactions.findMany({ where: eq(stripeTransactionsTable.stripeInvoiceId, invoiceId) });
        expect(rows).toHaveLength(0);
      });
    });
  });

  async function setup() {
    const refillService = container.resolve(RefillService);
    const userWalletRepository = container.resolve(UserWalletRepository);

    vi.spyOn(refillService, "topUpWallet").mockImplementation(async (amountUsd, userId, options) => {
      const wallet = await userWalletRepository.findOneBy({ userId });
      if (!wallet) return;
      // Mirror the real service: only graduate the trial when endTrial is not explicitly false
      const endTrial = options?.endTrial ?? true;
      await userWalletRepository.updateById(wallet.id, {
        deploymentAllowance: wallet.deploymentAllowance + amountUsd * 10000,
        ...(endTrial ? { isTrialing: false } : {})
      });
    });

    vi.spyOn(refillService, "reduceWalletBalance").mockImplementation(async (amountUsd, userId) => {
      const wallet = await userWalletRepository.findOneBy({ userId });
      if (!wallet) return;
      await userWalletRepository.updateById(wallet.id, {
        deploymentAllowance: Math.max(0, wallet.deploymentAllowance - amountUsd * 10000)
      });
    });

    const user = await userRepository.create({});
    const stripeCustomerId = `cus_${faker.string.alphanumeric(14)}`;
    await userRepository.updateById(user.id, { stripeCustomerId });
    const wallet = await userWalletRepository.create({
      userId: user.id,
      address: createAkashAddress()
    });
    await userWalletRepository.updateById(wallet.id, {
      isTrialing: true,
      deploymentAllowance: billingConfig.TRIAL_DEPLOYMENT_ALLOWANCE_AMOUNT,
      feeAllowance: billingConfig.TRIAL_FEES_ALLOWANCE_AMOUNT
    });
    return { user, wallet, stripeCustomerId };
  }
});
