import { singleton } from "tsyringe";

import { AuthService } from "@src/auth/services/auth.service";
import { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import { type Membership, OrganizationMemberRepository } from "@src/organization/repositories/organization-member/organization-member.repository";

export type CallerMembership = Membership & { isActive: boolean };

@singleton()
export class OrganizationService {
  constructor(
    private readonly authService: AuthService,
    private readonly organizationMemberRepository: OrganizationMemberRepository,
    private readonly executionContextService: ExecutionContextService
  ) {}

  async listCallerMemberships(): Promise<CallerMembership[]> {
    const memberships = await this.organizationMemberRepository.findActiveMemberships(this.authService.currentUser.id);
    const activeOrganizationId = this.executionContextService.get("ORGANIZATION_CONTEXT")?.organizationId;

    return memberships.map(membership => ({ ...membership, isActive: membership.organization.id === activeOrganizationId }));
  }
}
