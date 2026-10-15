import assert from "http-assert";
import { singleton } from "tsyringe";

import { Protected } from "@src/auth/services/auth.service";
import type { AuthMethod } from "@src/core/types/app-context";
import type {
  CreateOrganizationRequest,
  DeleteOrganizationQuery,
  ListOrganizationsResponse,
  OrganizationResponse,
  SingleOrganizationResponse,
  UpdateOrganizationRequest
} from "@src/organization/http-schemas/organization.schema";
import { type CallerMembership, OrganizationService } from "@src/organization/services/organization/organization.service";
import { TeamOrganizationService } from "@src/organization/services/team-organization/team-organization.service";
import { TeamOrganizationDeletionService } from "@src/organization/services/team-organization-deletion/team-organization-deletion.service";

@singleton()
export class OrganizationController {
  constructor(
    private readonly organizationService: OrganizationService,
    private readonly teamOrganizationService: TeamOrganizationService,
    private readonly teamOrganizationDeletionService: TeamOrganizationDeletionService
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

  @Protected()
  async delete(id: string, { acknowledgedForfeitUsd }: DeleteOrganizationQuery, origin: { authMethod?: AuthMethod }): Promise<void> {
    assert(origin.authMethod === "bearer", 403, "An organization can only be deleted from a signed-in Console session.", { errorCode: "session_required" });

    await this.teamOrganizationDeletionService.delete(id, { acknowledgedForfeitUsd });
  }
}

export function toOrganizationResponse({ role, isActive, organization }: CallerMembership): OrganizationResponse {
  const { id, name, slug, type, createdAt } = organization;

  return { id, name, slug, type, role, isActive, createdAt: createdAt.toISOString() };
}
