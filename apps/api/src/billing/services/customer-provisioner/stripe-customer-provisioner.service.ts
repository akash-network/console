import { singleton } from "tsyringe";

import { StripeService } from "@src/billing/services/stripe/stripe.service";
import type { UserOutput } from "@src/user/repositories";
import type { CustomerProvisioner } from "@src/user/services/customer-provisioner/customer-provisioner";

/**
 * Billing-side implementation of the user module's CustomerProvisioner port. Ensures the user has
 * a Stripe customer via the race-safe get-or-create in StripeService. Registered against
 * CUSTOMER_PROVISIONER in customer-provisioner.provider.ts.
 */
@singleton()
export class StripeCustomerProvisioner implements CustomerProvisioner {
  constructor(private readonly stripeService: StripeService) {}

  async provisionCustomer(user: UserOutput): Promise<void> {
    await this.stripeService.getStripeCustomerId(user);
  }
}
