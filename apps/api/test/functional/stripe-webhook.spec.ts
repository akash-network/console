import { UserSetting } from "@akashnetwork/database/dbSchemas/user";
import { faker } from "@faker-js/faker";
import { eq } from "drizzle-orm";
import nock from "nock";
import stripe from "stripe";
import { container } from "tsyringe";

import { app } from "@src/app";
import { CheckoutSessionRepository } from "@src/billing/repositories";
import type { ApiPgDatabase } from "@src/core";
import { POSTGRES_DB, resolveTable } from "@src/core";

jest.setTimeout(20000);

describe("Stripe webhook", () => {
  const userWalletsTable = resolveTable("UserWallets");
  const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);
  const userWalletsQuery = db.query.UserWallets;
  const checkoutSessionRepository = container.resolve(CheckoutSessionRepository);

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

    return await app.request("/v1/stripe-webhook", {
      method: "POST",
      body: payload,
      headers: new Headers({
        "Content-Type": "text/plain",
        "Stripe-Signature": stripe.webhooks.generateTestHeaderString({
          payload,
          secret: process.env.STRIPE_WEBHOOK_SECRET
        })
      })
    });
  };

  describe("POST /v1/stripe-webhook", () => {
    ["checkout.session.completed", "checkout.session.async_payment_succeeded"].forEach(eventType => {
      it(`tops up wallet and drops session from cache for event ${eventType}`, async () => {
        const sessionId = faker.string.uuid();
        const userId = faker.string.uuid();
        await UserSetting.create({ id: userId });
        await checkoutSessionRepository.create({
          sessionId,
          userId
        });
        nock("https://api.stripe.com").get(`/v1/checkout/sessions/${sessionId}?expand[0]=line_items`).reply(200, {
          payment_status: "paid",
          amount_subtotal: 100
        });

        const webhookResponse = await getWebhookResponse(sessionId, eventType);

        const userWallet = await userWalletsQuery.findFirst({ where: eq(userWalletsTable.userId, userId) });
        const checkoutSession = await checkoutSessionRepository.findOneBy({
          sessionId
        });
        expect(webhookResponse.status).toBe(200);
        expect(userWallet).toMatchObject({
          userId,
          deploymentAllowance: `1000000.00`,
          isTrialing: false
        });
        expect(checkoutSession).toBeUndefined();
      });
    });

    it("does not top up wallet and keeps cache if the payment is not done", async () => {
      const sessionId = faker.string.uuid();
      const userId = faker.string.uuid();
      await UserSetting.create({ id: userId });
      await checkoutSessionRepository.create({
        sessionId,
        userId
      });
      nock("https://api.stripe.com").get(`/v1/checkout/sessions/${sessionId}?expand[0]=line_items`).reply(200, {
        payment_status: "unpaid",
        amount_subtotal: 100
      });

      const webhookResponse = await getWebhookResponse(sessionId, "checkout.session.completed");

      const userWallet = await userWalletsQuery.findFirst({ where: eq(userWalletsTable.userId, userId) });
      const checkoutSession = await checkoutSessionRepository.findOneBy({
        sessionId
      });
      expect(webhookResponse.status).toBe(200);
      expect(userWallet).toBeUndefined();
      expect(checkoutSession).toMatchObject({
        sessionId
      });
    });

    it("does not top up wallet and keeps cache if the event is different", async () => {
      const sessionId = faker.string.uuid();
      const userId = faker.string.uuid();
      await UserSetting.create({ id: userId });
      await checkoutSessionRepository.create({
        sessionId,
        userId
      });

      const webhookResponse = await getWebhookResponse(sessionId, "checkout.session.not-found");

      const userWallet = await userWalletsQuery.findFirst({ where: eq(userWalletsTable.userId, userId) });
      const checkoutSession = await checkoutSessionRepository.findOneBy({
        sessionId
      });
      expect(webhookResponse.status).toBe(200);
      expect(userWallet).toBeUndefined();
      expect(checkoutSession).toMatchObject({
        sessionId
      });
    });
  });
});
