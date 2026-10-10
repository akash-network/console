import assert from "http-assert";
import Stripe from "stripe";
import { inject, singleton } from "tsyringe";

import { STRIPE_CLIENT } from "@src/billing/providers/stripe-client.provider";
import type { Payer } from "@src/billing/services/payer/payer";
import { type OrganizationOutput, OrganizationRepository } from "@src/organization/repositories/organization/organization.repository";
import { type UserOutput, UserRepository } from "@src/user/repositories/user/user.repository";

@singleton()
export class CustomerService {
  constructor(
    @inject(STRIPE_CLIENT) private readonly stripe: Stripe,
    private readonly userRepository: UserRepository,
    private readonly organizationRepository: OrganizationRepository
  ) {}

  async getStripeCustomerId(payer: Payer): Promise<string> {
    if (payer.stripeCustomerId) {
      return payer.stripeCustomerId;
    }

    return payer.team ? await this.#createTeamCustomer(payer.team, payer.user) : await this.#createUserCustomer(payer.user);
  }

  async #createUserCustomer(user: UserOutput): Promise<string> {
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

  /** Keyed on the organization like the user customer is on the user, so members setting up payments at once share one customer. */
  async #createTeamCustomer(team: OrganizationOutput, actingUser: UserOutput): Promise<string> {
    const customer = await this.stripe.customers.create(
      {
        email: actingUser.email ?? undefined,
        name: team.name,
        metadata: {
          organizationId: team.id,
          createdByUserId: actingUser.id
        }
      },
      { idempotencyKey: `create-organization-customer:${team.id}` }
    );

    const updated = await this.organizationRepository.updateBy({ id: team.id, stripeCustomerId: null }, { stripeCustomerId: customer.id }, { returning: true });

    if (updated?.stripeCustomerId) {
      return updated.stripeCustomerId;
    }

    const reloaded = await this.organizationRepository.findById(team.id);
    assert(reloaded?.stripeCustomerId, 500, "Failed to retrieve stripeCustomerId");
    return reloaded.stripeCustomerId;
  }

  async deleteCustomer(customerId: string): Promise<void> {
    try {
      await this.stripe.customers.del(customerId);
    } catch (error) {
      if (error instanceof Stripe.errors.StripeInvalidRequestError && error.code === "resource_missing") return;
      throw error;
    }
  }

  async updateCustomerOrganization(customerId: string, organization: string): Promise<void> {
    const customer = await this.stripe.customers.retrieve(customerId);

    assert(!("deleted" in customer), 404, "Customer is deleted");

    await this.stripe.customers.update(customerId, {
      business_name: organization
    });
  }
}
