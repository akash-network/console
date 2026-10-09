import { singleton } from "tsyringe";

import { Protected } from "@src/auth/services/auth.service";
import type { ListOrganizationsResponse, OrganizationResponse } from "@src/organization/http-schemas/organization.schema";
import { type CallerMembership, OrganizationService } from "@src/organization/services/organization/organization.service";

@singleton()
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  @Protected()
  async list(): Promise<ListOrganizationsResponse> {
    const memberships = await this.organizationService.listCallerMemberships();

    return { data: memberships.map(toOrganizationResponse) };
  }
}

function toOrganizationResponse({ role, isActive, organization }: CallerMembership): OrganizationResponse {
  const { id, name, slug, type, createdAt } = organization;

  return { id, name, slug, type, role, isActive, createdAt: createdAt.toISOString() };
}
