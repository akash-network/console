import assert from "http-assert";
import { singleton } from "tsyringe";

import { Protected } from "@src/auth/services/auth.service";
import type { AuthMethod } from "@src/core/types/app-context";
import { toOrganizationResponse } from "@src/organization/controllers/organization/organization.controller";
import type {
  AcceptInvitationRequest,
  AcceptInvitationResponse,
  InvitationPreviewResponse,
  PreviewInvitationRequest
} from "@src/organization/http-schemas/invitation.schema";
import { InvitationAcceptanceService } from "@src/organization/services/invitation-acceptance/invitation-acceptance.service";

@singleton()
export class InvitationController {
  constructor(private readonly invitationAcceptanceService: InvitationAcceptanceService) {}

  async preview({ token }: PreviewInvitationRequest["data"]): Promise<InvitationPreviewResponse> {
    const { organizationName, inviterName, role, email, status, expiresAt } = await this.invitationAcceptanceService.getPreview(token);

    return { data: { organizationName, inviterName, role, email, status, expiresAt: expiresAt.toISOString() } };
  }

  @Protected()
  async accept(input: AcceptInvitationRequest["data"], origin: { authMethod?: AuthMethod }): Promise<AcceptInvitationResponse> {
    assert(origin.authMethod === "bearer", 403, "An invitation can only be accepted from a signed-in Console session.", { errorCode: "session_required" });

    return { data: toOrganizationResponse(await this.invitationAcceptanceService.acceptInvitation(input)) };
  }
}
