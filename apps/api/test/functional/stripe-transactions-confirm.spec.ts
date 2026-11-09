import { faker } from "@faker-js/faker";
import nock from "nock";
import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";

import { UserAuthTokenService } from "@src/auth/services/user-auth-token/user-auth-token.service";
import type { ConfirmPaymentResponse } from "@src/billing/http-schemas/stripe.schema";
import { StripeTransactionRepository, UserWalletRepository } from "@src/billing/repositories";
import { PAYMENT_METHOD_REFUSED_ERROR_CODE, REFUSALS_PER_PAYMENT_METHOD } from "@src/billing/services/payment-refusal/payment-refusal.service";
import { app } from "@src/rest-app";
import { AccountStatusEventRepository } from "@src/user/repositories/account-status-event/account-status-event.repository";
import { UserRepository } from "@src/user/repositories/user/user.repository";

import { createAkashAddress } from "@test/seeders/akash-address.seeder";

describe("Stripe transactions confirm", () => {
  const userRepository = container.resolve(UserRepository);
  const stripeTransactionRepository = container.resolve(StripeTransactionRepository);
  const userWalletRepository = container.resolve(UserWalletRepository);
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
        .get("/v1/payment_intents")
        .query(true)
        .reply(200, { object: "list", data: [], has_more: false, url: "/v1/payment_intents" });
      nock("https://api.stripe.com")
        .post("/v1/payment_intents")
        .matchHeader("idempotency-key", namespacedKey)
        .reply(200, { id: paymentIntentId, object: "payment_intent", status: "succeeded", amount: 2000, currency: "usd" });

      const response = await confirmPayment(token, { userId: user.userId!, paymentMethodId, amount: 20, idempotencyKey: clientKey });

      expect(response.status).toBe(200);
      const body = (await response.json()) as ConfirmPaymentResponse;
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
      nock("https://api.stripe.com")
        .get("/v1/payment_intents")
        .query(true)
        .reply(200, { object: "list", data: [], has_more: false, url: "/v1/payment_intents" });
      const paymentIntentCreateScope = nock("https://api.stripe.com").post("/v1/payment_intents").reply(500);

      const response = await confirmPayment(token, { userId: user.userId!, paymentMethodId, amount: 20, idempotencyKey: clientKey });

      expect(response.status).toBe(200);
      expect(((await response.json()) as ConfirmPaymentResponse).data).toEqual(
        expect.objectContaining({
          success: true,
          transactionId: creditedTransaction.id,
          transactionStatus: "succeeded"
        })
      );
      expect(await stripeTransactionRepository.find({ userId: user.id })).toHaveLength(1);
      expect(paymentIntentCreateScope.isDone()).toBe(false);
    });

    it("rejects a replayed key whose amount changed with a definitive idempotency_key_mismatch code", async () => {
      const { user, token, stripeCustomerId, paymentMethodId } = await setup();
      const clientKey = faker.string.uuid();

      await stripeTransactionRepository.create({
        userId: user.id,
        type: "payment_intent",
        status: "created",
        amount: 2000,
        currency: "usd",
        stripeIdempotencyKey: `topup_${user.id}_${clientKey}`
      });

      nock("https://api.stripe.com")
        .get(`/v1/payment_methods/${paymentMethodId}`)
        .reply(200, { id: paymentMethodId, object: "payment_method", customer: stripeCustomerId });
      nock("https://api.stripe.com")
        .get("/v1/payment_intents")
        .query(true)
        .reply(200, { object: "list", data: [], has_more: false, url: "/v1/payment_intents" });

      const response = await confirmPayment(token, { userId: user.userId!, paymentMethodId, amount: 25, idempotencyKey: clientKey });

      expect(response.status).toBe(409);
      expect(await response.json()).toEqual(expect.objectContaining({ code: "idempotency_key_mismatch" }));
    });

    it("refuses a payment method the bank refused repeatedly without charging it again", async () => {
      const { user, token, stripeCustomerId, paymentMethodId } = await setup();
      const refusedAt = Math.floor(Date.now() / 1000) - 60;
      const refusedPaymentIntents = Array.from({ length: REFUSALS_PER_PAYMENT_METHOD }, (_, index) => ({
        id: `pi_${faker.string.alphanumeric(24)}`,
        object: "payment_intent",
        status: "requires_payment_method",
        created: refusedAt - index,
        customer: stripeCustomerId,
        payment_method: null,
        metadata: {},
        last_payment_error: { type: "card_error", code: "card_declined", payment_method: { id: paymentMethodId, object: "payment_method" } }
      }));
      nock("https://api.stripe.com")
        .get(`/v1/payment_methods/${paymentMethodId}`)
        .reply(200, { id: paymentMethodId, object: "payment_method", customer: stripeCustomerId });
      nock("https://api.stripe.com")
        .get("/v1/payment_intents")
        .query(query => query.customer === stripeCustomerId)
        .reply(200, { object: "list", data: refusedPaymentIntents, has_more: false, url: "/v1/payment_intents" });
      const paymentIntentCreateScope = nock("https://api.stripe.com").post("/v1/payment_intents").reply(200, {});

      const response = await confirmPayment(token, { userId: user.userId!, paymentMethodId, amount: 20, idempotencyKey: faker.string.uuid() });

      expect(response.status).toBe(402);
      expect(await response.json()).toMatchObject({ code: PAYMENT_METHOD_REFUSED_ERROR_CODE });
      expect(paymentIntentCreateScope.isDone()).toBe(false);
      expect(await stripeTransactionRepository.find({ userId: user.id })).toEqual([]);
    });

    it("refuses a suspended user with account_suspended and the reason written for them, without charging", async () => {
      const { user, token, paymentMethodId } = await setup();
      await userRepository.updateById(user.id, { accountStatus: "suspended" });
      await container.resolve(AccountStatusEventRepository).create({
        userId: user.id,
        userEmail: user.email,
        action: "suspend",
        actorEmail: "admin@akash.network",
        actorName: "Admin",
        userReason: "Unpaid invoices",
        internalNote: "Chargeback on card"
      });
      const stripeScope = nock("https://api.stripe.com").post("/v1/payment_intents").reply(500);

      const response = await confirmPayment(token, { userId: user.userId!, paymentMethodId, amount: 20, idempotencyKey: faker.string.uuid() });

      expect(response.status).toBe(403);
      const body = await response.text();
      expect(JSON.parse(body)).toMatchObject({ code: "account_suspended", data: { reason: "Unpaid invoices" } });
      expect(body).not.toContain("Chargeback on card");
      expect(stripeScope.isDone()).toBe(false);
      expect(await stripeTransactionRepository.find({ userId: user.id })).toEqual([]);
    });

    it("answers 402 without charging a user who has not set up payments", async () => {
      const { user, token, paymentMethodId } = await setup({ hasStripeCustomer: false });

      const response = await confirmPayment(token, { userId: user.userId!, paymentMethodId, amount: 20, idempotencyKey: faker.string.uuid() });

      expect(response.status).toBe(402);
      expect(await response.json()).toMatchObject({ message: "User payments are not set up." });
      expect(await stripeTransactionRepository.find({ userId: user.id })).toEqual([]);
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

  async function setup(input: { hasStripeCustomer?: boolean } = {}) {
    const stripeCustomerId = `cus_${faker.string.alphanumeric(14)}`;
    const user = await userRepository.create({
      userId: faker.string.uuid(),
      stripeCustomerId: input.hasStripeCustomer === false ? undefined : stripeCustomerId
    });
    const wallet = await userWalletRepository.create({ userId: user.id, address: createAkashAddress() });
    await userWalletRepository.updateById(wallet.id, { activatedAt: new Date(), isTrialing: false });
    const token = faker.string.alphanumeric(40);
    const paymentMethodId = `pm_${faker.string.alphanumeric(24)}`;

    vi.spyOn(userAuthTokenService, "getValidUserId").mockImplementation(async received => (received.replace(/^Bearer +/i, "") === token ? user.userId! : null));

    return { user, token, stripeCustomerId, paymentMethodId };
  }
});
