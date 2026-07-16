import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { StripeService } from "@src/billing/services/stripe/stripe.service";
import { StripeCustomerProvisioner } from "./stripe-customer-provisioner.service";

import { createUser } from "@test/seeders/user.seeder";

describe(StripeCustomerProvisioner.name, () => {
  describe("provisionCustomer", () => {
    it("ensures a Stripe customer via StripeService.getStripeCustomerId", async () => {
      const user = createUser({ stripeCustomerId: null });
      const { provisioner, stripeService } = setup();

      await provisioner.provisionCustomer(user);

      expect(stripeService.getStripeCustomerId).toHaveBeenCalledWith(user);
    });
  });

  function setup() {
    const stripeService = mock<StripeService>({ getStripeCustomerId: vi.fn().mockResolvedValue("cus_new") });
    const provisioner = new StripeCustomerProvisioner(stripeService);

    return { provisioner, stripeService };
  }
});
