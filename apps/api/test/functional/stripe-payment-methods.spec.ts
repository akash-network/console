import { faker } from "@faker-js/faker";
import nock from "nock";
import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";

import { UserAuthTokenService } from "@src/auth/services/user-auth-token/user-auth-token.service";
import { app } from "@src/rest-app";
import { UserRepository } from "@src/user/repositories/user/user.repository";

describe("Stripe payment methods", () => {
  const userRepository = container.resolve(UserRepository);
  const userAuthTokenService = container.resolve(UserAuthTokenService);

  afterEach(() => {
    vi.restoreAllMocks();
    nock.cleanAll();
  });

  describe("DELETE /v1/stripe/payment-methods/{paymentMethodId}", () => {
    it("detaches a payment method that belongs to the user", async () => {
      const { token, stripeCustomerId, paymentMethodId } = await setup();
      nock("https://api.stripe.com")
        .get(`/v1/payment_methods/${paymentMethodId}`)
        .reply(200, { id: paymentMethodId, object: "payment_method", customer: stripeCustomerId });
      const detachScope = nock("https://api.stripe.com")
        .post(`/v1/payment_methods/${paymentMethodId}/detach`)
        .reply(200, { id: paymentMethodId, object: "payment_method", customer: null });

      const response = await removePaymentMethod(token, paymentMethodId);

      expect(response.status).toBe(204);
      expect(detachScope.isDone()).toBe(true);
    });

    it("answers 402 without calling Stripe for a user who has not set up payments", async () => {
      const { token, paymentMethodId } = await setup({ hasStripeCustomer: false });
      const retrieveScope = nock("https://api.stripe.com").get(`/v1/payment_methods/${paymentMethodId}`).reply(200, {});

      const response = await removePaymentMethod(token, paymentMethodId);

      expect(response.status).toBe(402);
      expect(await response.json()).toMatchObject({ message: "User payments are not set up." });
      expect(retrieveScope.isDone()).toBe(false);
    });
  });

  async function removePaymentMethod(token: string, paymentMethodId: string) {
    return await app.request(`/v1/stripe/payment-methods/${paymentMethodId}`, {
      method: "DELETE",
      headers: new Headers({ authorization: `Bearer ${token}` })
    });
  }

  async function setup(input: { hasStripeCustomer?: boolean } = {}) {
    const stripeCustomerId = `cus_${faker.string.alphanumeric(14)}`;
    const user = await userRepository.create({
      userId: faker.string.uuid(),
      stripeCustomerId: input.hasStripeCustomer === false ? undefined : stripeCustomerId
    });
    const token = faker.string.alphanumeric(40);
    const paymentMethodId = `pm_${faker.string.alphanumeric(24)}`;

    vi.spyOn(userAuthTokenService, "getValidUserId").mockImplementation(async received => (received.replace(/^Bearer +/i, "") === token ? user.userId! : null));

    return { user, token, stripeCustomerId, paymentMethodId };
  }
});
