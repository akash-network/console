import assert from "http-assert";
import { singleton } from "tsyringe";

import { Protected } from "@src/auth/services/auth.service";
import type { AuthMethod } from "@src/core/types/app-context";
import type {
  CreateOrganizationRequest,
  ListOrganizationsResponse,
  OrganizationResponse,
  SingleOrganizationResponse,
  UpdateOrganizationRequest
} from "@src/organization/http-schemas/organization.schema";
import { type CallerMembership, OrganizationService } from "@src/organization/services/organization/organization.service";
import { TeamOrganizationService } from "@src/organization/services/team-organization/team-organization.service";

@singleton()
export class OrganizationController {
  constructor(
    private readonly organizationService: OrganizationService,
    private readonly teamOrganizationService: TeamOrganizationService
  ) {}

  @Protected()
  async list(): Promise<ListOrganizationsResponse> {
    const memberships = await this.organizationService.listCallerMemberships();

    return { data: memberships.map(toOrganizationResponse) };
  }

  @Protected()
  async create({ name }: CreateOrganizationRequest["data"], origin: { authMethod?: AuthMethod }): Promise<SingleOrganizationResponse> {
    assert(origin.authMethod === "bearer", 403, "An organization can only be created from a signed-in Console session.", { errorCode: "session_required" });

    return { data: toOrganizationResponse(await this.teamOrganizationService.create(name)) };
  }

  @Protected([{ action: "update", subject: "Organization" }])
  async update(id: string, { name }: UpdateOrganizationRequest["data"]): Promise<SingleOrganizationResponse> {
    return { data: toOrganizationResponse(await this.teamOrganizationService.rename(id, name)) };
  }
}

function toOrganizationResponse({ role, isActive, organization }: CallerMembership): OrganizationResponse {
  const { id, name, slug, type, createdAt } = organization;

  return { id, name, slug, type, role, isActive, createdAt: createdAt.toISOString() };
}
