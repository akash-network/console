import { singleton } from "tsyringe";

import { AuthService } from "@src/auth/services/auth.service";
import type { BillingOwner } from "@src/billing/lib/billing-owner/billing-owner";
import { PaymentMethodRepository } from "@src/billing/repositories/payment-method/payment-method.repository";
import { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import { type Membership, OrganizationMemberRepository } from "@src/organization/repositories/organization-member/organization-member.repository";

export type CallerMembership = Membership & { isActive: boolean };

export type CallerOrganization = CallerMembership & { hasPaymentMethod: boolean | null };

@singleton()
export class OrganizationService {
  constructor(
    private readonly authService: AuthService,
    private readonly organizationMemberRepository: OrganizationMemberRepository,
    private readonly executionContextService: ExecutionContextService,
    private readonly paymentMethodRepository: PaymentMethodRepository
  ) {}

  async listCallerMemberships(): Promise<CallerMembership[]> {
    const memberships = await this.organizationMemberRepository.findActiveMemberships(this.authService.currentUser.id);
    const activeOrganizationId = this.executionContextService.get("ORGANIZATION_CONTEXT")?.organizationId;
    const reachableMemberships = this.executionContextService.get("CURRENT_API_KEY")
      ? memberships.filter(membership => membership.organization.id === activeOrganizationId)
      : memberships;

    return reachableMemberships.map(membership => ({ ...membership, isActive: membership.organization.id === activeOrganizationId }));
  }

  /** Payment methods are read within the organization the request runs in, which is the only one this can answer for. */
  async withPaymentMethodStatus(membership: CallerMembership): Promise<CallerOrganization> {
    if (!membership.isActive) return { ...membership, hasPaymentMethod: null };

    const count = await this.paymentMethodRepository.countByOwner(this.#billingOwnerOf(membership));

    return { ...membership, hasPaymentMethod: count > 0 };
  }

  #billingOwnerOf({ organization }: CallerMembership): BillingOwner {
    return organization.type === "team" ? { organizationId: organization.id } : { userId: this.authService.currentUser.id };
  }
}
