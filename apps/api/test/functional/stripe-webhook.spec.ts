import { faker } from "@faker-js/faker";
import { eq } from "drizzle-orm";
import nock from "nock";
import stripe from "stripe";
import { container } from "tsyringe";

import { BILLING_CONFIG, type BillingConfig } from "@src/billing/providers";
import { StripeTransactionRepository } from "@src/billing/repositories";
import type { ApiPgDatabase } from "@src/core";
import { POSTGRES_DB, resolveTable } from "@src/core";
import { app } from "@src/rest-app";
import { Users } from "@src/user/model-schemas/user/user.schema";

import { WalletTestingService } from "@test/services/wallet-testing.service";

jest.setTimeout(30000);

describe("Stripe webhook", () => {
  const userWalletsTable = resolveTable("UserWallets");
  const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);
  const userWalletsQuery = db.query.UserWallets;
  const stripeTransactionRepository = container.resolve(StripeTransactionRepository);
  const billingConfig = container.resolve<BillingConfig>(BILLING_CONFIG);
  const walletService = new WalletTestingService(app);

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

  describe("POST /v1/stripe-webhook", () => {
    describe("payment_intent.succeeded", () => {
      it("handles duplicate webhook deliveries idempotently", async () => {
        const paymentIntentId = `pi_${faker.string.alphanumeric(24)}`;
        const chargeId = `ch_${faker.string.alphanumeric(24)}`;
        const amount = 10000;

        const { user } = await walletService.createUserAndWallet();
        const stripeCustomerId = `cus_${faker.string.alphanumeric(14)}`;
        await db.update(Users).set({ stripeCustomerId }).where(eq(Users.id, user.id));

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
              payment_method_types: ["card"]
            }
          },
          type: "payment_intent.succeeded"
        });

        // First webhook delivery
        const response1 = await getWebhookResponse(payload);
        expect(response1.status).toBe(200);

        const walletAfterFirst = await userWalletsQuery.findFirst({ where: eq(userWalletsTable.userId, user.id) });
        const expectedBalance = billingConfig.TRIAL_DEPLOYMENT_ALLOWANCE_AMOUNT + amount * 10000;
        expect(walletAfterFirst?.deploymentAllowance).toBe(`${expectedBalance}.00`);

        // Second webhook delivery (retry) - should not double-credit
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
        const { user } = await walletService.createUserAndWallet();
        const stripeCustomerId = `cus_${faker.string.alphanumeric(14)}`;
        await db.update(Users).set({ stripeCustomerId }).where(eq(Users.id, user.id));

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
              payment_method_types: ["card"]
            }
          },
          type: "payment_intent.succeeded"
        });

        const webhookResponse = await getWebhookResponse(payload);

        const userWallet = await userWalletsQuery.findFirst({ where: eq(userWalletsTable.userId, user.id) });
        const transaction = await stripeTransactionRepository.findByPaymentIntentId(paymentIntentId);

        // Calculate expected balance: trial allowance + payment amount (cents * 10000 multiplier for uakt)
        const expectedBalance = billingConfig.TRIAL_DEPLOYMENT_ALLOWANCE_AMOUNT + amount * 10000;

        expect(webhookResponse.status).toBe(200);
        expect(userWallet).toMatchObject({
          userId: user.id,
          deploymentAllowance: `${expectedBalance}.00`,
          isTrialing: false
        });
        expect(transaction).toMatchObject({
          status: "succeeded",
          stripeChargeId: chargeId,
          paymentMethodType: "card"
        });
      });
    });

    describe("payment_intent.payment_failed", () => {
      it("updates transaction status to failed", async () => {
        const paymentIntentId = `pi_${faker.string.alphanumeric(24)}`;
        const amount = 5000;

        const { user } = await walletService.createUserAndWallet();
        const stripeCustomerId = `cus_${faker.string.alphanumeric(14)}`;
        await db.update(Users).set({ stripeCustomerId }).where(eq(Users.id, user.id));

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
      it("reduces wallet balance and updates transaction status on full refund", async () => {
        const paymentIntentId = `pi_${faker.string.alphanumeric(24)}`;
        const chargeId = `ch_${faker.string.alphanumeric(24)}`;
        // Use small amount that fits within trial allowance (trial allowance is ~$2)
        const amount = 50; // 50 cents = $0.50

        const { user } = await walletService.createUserAndWallet();
        const stripeCustomerId = `cus_${faker.string.alphanumeric(14)}`;
        await db.update(Users).set({ stripeCustomerId }).where(eq(Users.id, user.id));

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

        const { user } = await walletService.createUserAndWallet();
        const stripeCustomerId = `cus_${faker.string.alphanumeric(14)}`;
        await db.update(Users).set({ stripeCustomerId }).where(eq(Users.id, user.id));

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
  });
});
