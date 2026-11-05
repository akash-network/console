import { singleton } from "tsyringe";

import { Protected } from "@src/auth/services/auth.service";
import type {
  CreateOrganizationInvitationsRequest,
  ListOrganizationInvitationsResponse,
  OrganizationInvitationLinkResponse,
  OrganizationInvitationResponse
} from "@src/organization/http-schemas/organization-invitation.schema";
import type { OrganizationInvitationWithInviter } from "@src/organization/repositories/organization-invitation/organization-invitation.repository";
import { OrganizationInvitationService } from "@src/organization/services/organization-invitation/organization-invitation.service";
import type { RequestOrigin } from "@src/organization/services/organization-member/organization-member.service";

@singleton()
export class OrganizationInvitationController {
  constructor(private readonly organizationInvitationService: OrganizationInvitationService) {}

  @Protected([{ action: "read", subject: "OrganizationInvitation" }])
  async list(): Promise<ListOrganizationInvitationsResponse> {
    const invitations = await this.organizationInvitationService.listInvitations();

    return { data: invitations.map(toOrganizationInvitation) };
  }

  @Protected([{ action: "create", subject: "OrganizationInvitation" }])
  async create(input: CreateOrganizationInvitationsRequest["data"], origin: RequestOrigin): Promise<ListOrganizationInvitationsResponse> {
    const invitations = await this.organizationInvitationService.createInvitations(input, origin);

    return { data: invitations.map(toOrganizationInvitation) };
  }

  @Protected([{ action: "update", subject: "OrganizationInvitation" }])
  async resend(id: string, origin: RequestOrigin): Promise<OrganizationInvitationResponse> {
    return { data: toOrganizationInvitation(await this.organizationInvitationService.resendInvitation(id, origin)) };
  }

  @Protected([{ action: "update", subject: "OrganizationInvitation" }])
  async createLink(id: string, origin: RequestOrigin): Promise<OrganizationInvitationLinkResponse> {
    return { data: { url: await this.organizationInvitationService.createInvitationLink(id, origin) } };
  }

  @Protected([{ action: "delete", subject: "OrganizationInvitation" }])
  async delete(id: string): Promise<void> {
    await this.organizationInvitationService.revokeInvitation(id);
  }
}

function toOrganizationInvitation({
  id,
  email,
  role,
  projectAccess,
  projectGrants,
  invitedBy,
  createdAt,
  expiresAt
}: OrganizationInvitationWithInviter): OrganizationInvitationResponse["data"] {
  return { id, email, role, projectAccess, projectGrants, invitedBy, createdAt: createdAt.toISOString(), expiresAt: expiresAt.toISOString() };
}
