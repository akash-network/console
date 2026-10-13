import assert from "http-assert";
import { singleton } from "tsyringe";

import { AuthService } from "@src/auth/services/auth.service";
import type { BillingOwner } from "@src/billing/lib/billing-owner/billing-owner";
import { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import { type OrganizationOutput, OrganizationRepository } from "@src/organization/repositories/organization/organization.repository";
import { type UserOutput, UserRepository } from "@src/user/repositories/user/user.repository";
import { assertIsPayingPayer, type Payer, type PayingPayer } from "./payer";

/** The owner of a Stripe customer as a webhook finds it, without anyone acting. */
export type StripeCustomerOwner = { team: OrganizationOutput } | { user: UserOutput; personalOrganizationId?: string };

export function billingOwnerOfCustomer(customerOwner: StripeCustomerOwner): BillingOwner {
  return "team" in customerOwner ? { organizationId: customerOwner.team.id } : { userId: customerOwner.user.id };
}

@singleton()
export class PayerService {
  constructor(
    private readonly authService: AuthService,
    private readonly executionContextService: ExecutionContextService,
    private readonly organizationRepository: OrganizationRepository,
    private readonly userRepository: UserRepository
  ) {}

  /** A personal organization keeps paying with its owner's Stripe customer, so legacy and organization modes bill the same customer. */
  async getCurrentPayer(): Promise<Payer> {
    const user = this.authService.currentUser;
    const context = this.executionContextService.get("ORGANIZATION_CONTEXT");

    if (context?.organizationType !== "team") {
      return { user, organizationId: context?.organizationId, stripeCustomerId: user.stripeCustomerId };
    }

    const team = await this.organizationRepository.findById(context.organizationId);
    assert(team, 404, "Organization not found");

    return { user, organizationId: team.id, team, stripeCustomerId: team.stripeCustomerId };
  }

  async getCurrentPayingPayer(): Promise<PayingPayer> {
    const payer = await this.getCurrentPayer();
    assertIsPayingPayer(payer);

    return payer;
  }

  /** Falls back to the user link, which every customer created before team organizations paid still carries. */
  async findByStripeCustomerId(customerId: string): Promise<StripeCustomerOwner | undefined> {
    const team = await this.organizationRepository.findOneBy({ stripeCustomerId: customerId, type: "team" });

    if (team) return { team };

    const user = await this.userRepository.findOneBy({ stripeCustomerId: customerId });

    if (!user) return undefined;

    const personalOrganization = await this.organizationRepository.findPersonalByUserId(user.id);

    return { user, personalOrganizationId: personalOrganization?.id };
  }
}
