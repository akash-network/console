import { faker } from "@faker-js/faker";
import { eq } from "drizzle-orm";
import nock from "nock";
import stripe from "stripe";
import { container } from "tsyringe";

import { CheckoutSessionRepository } from "@src/billing/repositories";
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
  const checkoutSessionRepository = container.resolve(CheckoutSessionRepository);
  const walletService = new WalletTestingService(app);

  const generatePayload = (sessionId: string, eventType: string) =>
    JSON.stringify({
      data: {
        object: {
          id: sessionId
        }
      },
      type: eventType
    });

  const getWebhookResponse = async (sessionId: string, eventType: string) => {
    const payload = generatePayload(sessionId, eventType);
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
    ["checkout.session.completed", "checkout.session.async_payment_succeeded"].forEach(eventType => {
      it(`tops up wallet and drops session from cache for event ${eventType}`, async () => {
        const sessionId = faker.string.uuid();

        // Create user with wallet and Stripe customer ID
        const { user } = await walletService.createUserAndWallet();
        const stripeCustomerId = faker.string.uuid();
        await db.update(Users).set({ stripeCustomerId }).where(eq(Users.id, user.id));

        await checkoutSessionRepository.create({
          sessionId,
          userId: user.id
        });

        nock("https://api.stripe.com")
          .get(`/v1/checkout/sessions/${sessionId}?expand[0]=line_items`)
          .reply(200, {
            payment_status: "paid",
            amount_subtotal: 100,
            customer: stripeCustomerId,
            line_items: {
              data: [
                {
                  price: {
                    unit_amount: 10000
                  }
                }
              ]
            }
          });

        const webhookResponse = await getWebhookResponse(sessionId, eventType);

        const userWallet = await userWalletsQuery.findFirst({ where: eq(userWalletsTable.userId, user.id) });
        const checkoutSession = await checkoutSessionRepository.findOneBy({
          sessionId
        });

        expect(webhookResponse.status).toBe(200);
        expect(userWallet).toMatchObject({
          userId: user.id,
          isTrialing: false
        });
        expect(checkoutSession).toBeUndefined();
      });
    });

    it("does not top up wallet and keeps cache if the payment is not done", async () => {
      const sessionId = faker.string.uuid();

      // Create user with wallet and Stripe customer ID
      const { user } = await walletService.createUserAndWallet();
      const stripeCustomerId = faker.string.uuid();
      await db.update(Users).set({ stripeCustomerId }).where(eq(Users.id, user.id));

      await checkoutSessionRepository.create({
        sessionId,
        userId: user.id
      });

      nock("https://api.stripe.com")
        .get(`/v1/checkout/sessions/${sessionId}?expand[0]=line_items`)
        .reply(200, {
          payment_status: "unpaid",
          amount_subtotal: 100,
          customer: stripeCustomerId,
          line_items: {
            data: [
              {
                price: {
                  unit_amount: 10000
                }
              }
            ]
          }
        });

      const webhookResponse = await getWebhookResponse(sessionId, "checkout.session.completed");

      const userWallet = await userWalletsQuery.findFirst({ where: eq(userWalletsTable.userId, user.id) });
      const checkoutSession = await checkoutSessionRepository.findOneBy({
        sessionId
      });
      expect(webhookResponse.status).toBe(200);
      // Wallet should exist but balance should not have changed (no payment processed)
      expect(userWallet).toMatchObject({
        userId: user.id,
        isTrialing: true
      });
      expect(checkoutSession).toMatchObject({
        sessionId
      });
    });

    it("does not top up wallet and keeps cache if the event is different", async () => {
      const sessionId = faker.string.uuid();

      // Create user with wallet and Stripe customer ID
      const { user } = await walletService.createUserAndWallet();
      const stripeCustomerId = faker.string.uuid();
      await db.update(Users).set({ stripeCustomerId }).where(eq(Users.id, user.id));

      await checkoutSessionRepository.create({
        sessionId,
        userId: user.id
      });

      const webhookResponse = await getWebhookResponse(sessionId, "checkout.session.not-found");

      const userWallet = await userWalletsQuery.findFirst({ where: eq(userWalletsTable.userId, user.id) });
      const checkoutSession = await checkoutSessionRepository.findOneBy({
        sessionId
      });
      expect(webhookResponse.status).toBe(200);
      // Wallet should exist but balance should not have changed (no payment processed)
      expect(userWallet).toMatchObject({
        userId: user.id,
        isTrialing: true
      });
      expect(checkoutSession).toMatchObject({
        sessionId
      });
    });
  });
});
