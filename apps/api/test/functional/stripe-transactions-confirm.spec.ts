import { faker } from "@faker-js/faker";
import nock from "nock";
import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";

import { UserAuthTokenService } from "@src/auth/services/user-auth-token/user-auth-token.service";
import { StripeTransactionRepository } from "@src/billing/repositories";
import { app } from "@src/rest-app";
import { UserRepository } from "@src/user/repositories/user/user.repository";

describe("Stripe transactions confirm", () => {
  const userRepository = container.resolve(UserRepository);
  const stripeTransactionRepository = container.resolve(StripeTransactionRepository);
  const userAuthTokenService = container.resolve(UserAuthTokenService);

  afterEach(() => {
    vi.restoreAllMocks();
    nock.cleanAll();
  });

  describe("POST /v1/stripe/transactions/confirm", () => {
    it("threads the namespaced idempotency key through to Stripe and records it on the transaction row", async () => {
      const { user, token, stripeCustomerId, paymentMethodId } = await setup();
      const clientKey = faker.string.uuid();
      const namespacedKey = `topup_${user.id}_${clientKey}`;
      const paymentIntentId = `pi_${faker.string.alphanumeric(24)}`;

      nock("https://api.stripe.com")
        .get(`/v1/payment_methods/${paymentMethodId}`)
        .reply(200, { id: paymentMethodId, object: "payment_method", customer: stripeCustomerId });
      nock("https://api.stripe.com")
        .post("/v1/payment_intents")
        .matchHeader("idempotency-key", namespacedKey)
        .reply(200, { id: paymentIntentId, object: "payment_intent", status: "succeeded", amount: 2000, currency: "usd" });

      const response = await confirmPayment(token, { userId: user.userId!, paymentMethodId, amount: 20, idempotencyKey: clientKey });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.data).toEqual(expect.objectContaining({ success: true }));
      expect(await stripeTransactionRepository.findById(body.data.transactionId)).toMatchObject({
        userId: user.id,
        stripeIdempotencyKey: namespacedKey,
        stripePaymentIntentId: paymentIntentId,
        amount: 2000
      });
      expect(nock.isDone()).toBe(true);
    });

    it("replays an already-credited attempt without creating another payment intent", async () => {
      const { user, token, stripeCustomerId, paymentMethodId } = await setup();
      const clientKey = faker.string.uuid();
      const namespacedKey = `topup_${user.id}_${clientKey}`;

      const creditedTransaction = await stripeTransactionRepository.create({
        userId: user.id,
        type: "payment_intent",
        status: "succeeded",
        amount: 2000,
        currency: "usd",
        stripePaymentIntentId: `pi_${faker.string.alphanumeric(24)}`,
        stripeIdempotencyKey: namespacedKey
      });

      nock("https://api.stripe.com")
        .get(`/v1/payment_methods/${paymentMethodId}`)
        .reply(200, { id: paymentMethodId, object: "payment_method", customer: stripeCustomerId });

      const response = await confirmPayment(token, { userId: user.userId!, paymentMethodId, amount: 20, idempotencyKey: clientKey });

      expect(response.status).toBe(200);
      expect((await response.json()).data).toEqual(
        expect.objectContaining({
          success: true,
          transactionId: creditedTransaction.id,
          transactionStatus: "succeeded"
        })
      );
      expect(await stripeTransactionRepository.find({ userId: user.id })).toHaveLength(1);
    });
  });

  async function confirmPayment(token: string, data: { userId: string; paymentMethodId: string; amount: number; idempotencyKey?: string }) {
    return await app.request("/v1/stripe/transactions/confirm", {
      method: "POST",
      body: JSON.stringify({ data }),
      headers: new Headers({
        "Content-Type": "application/json",
        authorization: `Bearer ${token}`
      })
    });
  }

  async function setup() {
    const stripeCustomerId = `cus_${faker.string.alphanumeric(14)}`;
    const user = await userRepository.create({ userId: faker.string.uuid(), stripeCustomerId });
    const token = faker.string.alphanumeric(40);
    const paymentMethodId = `pm_${faker.string.alphanumeric(24)}`;

    vi.spyOn(userAuthTokenService, "getValidUserId").mockImplementation(async received => (received.replace(/^Bearer +/i, "") === token ? user.userId! : null));

    return { user, token, stripeCustomerId, paymentMethodId };
  }
});
