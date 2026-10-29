import assert from "http-assert";
import { singleton } from "tsyringe";

import { Protected } from "@src/auth/services/auth.service";
import type { AuthMethod } from "@src/core/types/app-context";
import { toOrganizationResponse } from "@src/organization/controllers/organization/organization.controller";
import type {
  AcceptInvitationRequest,
  AcceptInvitationResponse,
  InvitationPreviewResponse,
  ListReceivedInvitationsResponse,
  PreviewInvitationRequest
} from "@src/organization/http-schemas/invitation.schema";
import type { ReceivedInvitation } from "@src/organization/repositories/organization-invitation/organization-invitation.repository";
import { InvitationAcceptanceService } from "@src/organization/services/invitation-acceptance/invitation-acceptance.service";
import type { CallerMembership } from "@src/organization/services/organization/organization.service";
import { OrganizationService } from "@src/organization/services/organization/organization.service";

type RequestOrigin = { authMethod?: AuthMethod };

@singleton()
export class InvitationController {
  constructor(
    private readonly invitationAcceptanceService: InvitationAcceptanceService,
    private readonly organizationService: OrganizationService
  ) {}

  async preview({ token }: PreviewInvitationRequest["data"]): Promise<InvitationPreviewResponse> {
    const { organizationId, organizationName, inviterName, role, email, status, expiresAt } = await this.invitationAcceptanceService.getPreview(token);

    return { data: { organizationId, organizationName, inviterName, role, email, status, expiresAt: expiresAt.toISOString() } };
  }

  @Protected()
  async accept(input: AcceptInvitationRequest["data"], origin: RequestOrigin): Promise<AcceptInvitationResponse> {
    assertSignedInSession(origin, "An invitation can only be accepted from a signed-in Console session.");

    return await this.#toAcceptResponse(await this.invitationAcceptanceService.acceptInvitation(input));
  }

  @Protected()
  async listReceived(origin: RequestOrigin): Promise<ListReceivedInvitationsResponse> {
    assertSignedInSession(origin, "Invitations can only be listed from a signed-in Console session.");
    const invitations = await this.invitationAcceptanceService.listReceivedInvitations();

    return { data: invitations.map(toReceivedInvitationResponse) };
  }

  @Protected()
  async acceptReceived(id: string, origin: RequestOrigin): Promise<AcceptInvitationResponse> {
    assertSignedInSession(origin, "An invitation can only be accepted from a signed-in Console session.");

    return await this.#toAcceptResponse(await this.invitationAcceptanceService.acceptReceivedInvitation(id));
  }

  @Protected()
  async declineReceived(id: string, origin: RequestOrigin): Promise<void> {
    assertSignedInSession(origin, "An invitation can only be declined from a signed-in Console session.");
    await this.invitationAcceptanceService.declineReceivedInvitation(id);
  }

  async #toAcceptResponse(joined: CallerMembership): Promise<AcceptInvitationResponse> {
    return { data: toOrganizationResponse(await this.organizationService.withPaymentMethodStatus(joined)) };
  }
}

function assertSignedInSession(origin: RequestOrigin, message: string): void {
  assert(origin.authMethod === "bearer", 403, message, { errorCode: "session_required" });
}

function toReceivedInvitationResponse({ createdAt, expiresAt, ...invitation }: ReceivedInvitation): ListReceivedInvitationsResponse["data"][number] {
  return { ...invitation, createdAt: createdAt.toISOString(), expiresAt: expiresAt.toISOString() };
}
