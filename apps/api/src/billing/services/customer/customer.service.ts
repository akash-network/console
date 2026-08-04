import assert from "http-assert";
import Stripe from "stripe";
import { inject, singleton } from "tsyringe";

import { STRIPE_CLIENT } from "@src/billing/providers/stripe-client.provider";
import { type UserOutput, UserRepository } from "@src/user/repositories/user/user.repository";

@singleton()
export class CustomerService {
  constructor(
    @inject(STRIPE_CLIENT) private readonly stripe: Stripe,
    private readonly userRepository: UserRepository
  ) {}

  async getStripeCustomerId(user: UserOutput): Promise<string> {
    if (user.stripeCustomerId) {
      return user.stripeCustomerId;
    }

    // Stripe idempotency keyed on the user id so concurrent provisioning (eager registration +
    // lazy billing paths) can never create duplicate/orphaned customers before the DB update wins.
    const customer = await this.stripe.customers.create(
      {
        email: user.email ?? undefined,
        name: user.username ?? undefined,
        metadata: {
          userId: user.id
        }
      },
      { idempotencyKey: `create-customer:${user.id}` }
    );

    const updated = await this.userRepository.updateBy({ id: user.id, stripeCustomerId: null }, { stripeCustomerId: customer.id }, { returning: true });

    if (updated) {
      return updated.stripeCustomerId!;
    }

    // Concurrent creation detected: fetch and return the persisted customer ID
    const reloaded = await this.userRepository.findOneBy({ id: user.id });
    assert(reloaded?.stripeCustomerId, 500, "Failed to retrieve stripeCustomerId");
    return reloaded.stripeCustomerId;
  }

  async updateCustomerOrganization(customerId: string, organization: string): Promise<void> {
    const customer = await this.stripe.customers.retrieve(customerId);

    assert(!("deleted" in customer), 404, "Customer is deleted");

    await this.stripe.customers.update(customerId, {
      business_name: organization
    });
  }
}
