import assert from "http-assert";
import Stripe from "stripe";
import { inject, singleton } from "tsyringe";

import { STRIPE_CLIENT } from "@src/billing/providers/stripe-client.provider";
import type { Payer } from "@src/billing/services/payer/payer";
import { type OrganizationOutput, OrganizationRepository } from "@src/organization/repositories/organization/organization.repository";
import { type UserOutput, UserRepository } from "@src/user/repositories/user/user.repository";

export const ORGANIZATION_PAYMENTS_SETUP_IN_PROGRESS_ERROR_CODE = "organization_payments_setup_in_progress";

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

    return payer.team ? await this.#createTeamCustomer(payer.team) : await this.#createUserCustomer(payer.user);
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
  async #createTeamCustomer(team: OrganizationOutput): Promise<string> {
    const customer = await this.#createCustomerOnce(team);

    if (!customer) {
      return await this.#customerIdStoredByAnotherMember(team);
    }

    await this.stripe.customers.update(customer.id, { name: team.name });

    const updated = await this.organizationRepository.updateBy({ id: team.id, stripeCustomerId: null }, { stripeCustomerId: customer.id }, { returning: true });

    if (updated?.stripeCustomerId) {
      return updated.stripeCustomerId;
    }

    return await this.#reloadTeamCustomerId(team);
  }

  /** Stripe refuses a key reused with other parameters, so the keyed create carries nothing a rename could change. */
  async #createCustomerOnce(team: OrganizationOutput): Promise<Stripe.Customer | undefined> {
    try {
      return await this.stripe.customers.create({ metadata: { organizationId: team.id } }, { idempotencyKey: `create-organization-customer:${team.id}` });
    } catch (error) {
      if (error instanceof Stripe.errors.StripeIdempotencyError) return undefined;
      throw error;
    }
  }

  /** Stripe also refuses a key while the first request with it is still running, before the winner has stored the customer. */
  async #customerIdStoredByAnotherMember(team: OrganizationOutput): Promise<string> {
    const reloaded = await this.organizationRepository.findById(team.id);
    assert(reloaded?.stripeCustomerId, 409, "Payments are being set up for this organization, please retry", {
      errorCode: ORGANIZATION_PAYMENTS_SETUP_IN_PROGRESS_ERROR_CODE
    });
    return reloaded.stripeCustomerId;
  }

  async #reloadTeamCustomerId(team: OrganizationOutput): Promise<string> {
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
}
