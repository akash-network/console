import { isBefore } from "date-fns";
import assert from "http-assert";
import createError from "http-errors";
import { singleton } from "tsyringe";

import { AuthService } from "@src/auth/services/auth.service";
import { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import { TxService } from "@src/core/services/tx/tx.service";
import { hashInvitationToken } from "@src/organization/lib/invitation-token/invitation-token";
import type { OrganizationInvitationStatus } from "@src/organization/model-schemas/organization-invitation/organization-invitation.schema";
import {
  type OrganizationInvitationOutput,
  type OrganizationInvitationPreview,
  OrganizationInvitationRepository
} from "@src/organization/repositories/organization-invitation/organization-invitation.repository";
import { OrganizationMemberRepository } from "@src/organization/repositories/organization-member/organization-member.repository";
import { ProjectRepository } from "@src/organization/repositories/project/project.repository";
import { ProjectMemberRepository } from "@src/organization/repositories/project-member/project-member.repository";
import type { CallerMembership } from "@src/organization/services/organization/organization.service";
import type { UserOutput } from "@src/user/repositories/user/user.repository";
import { UserRepository } from "@src/user/repositories/user/user.repository";

export const INVITATION_EMAIL_MISMATCH_ERROR_CODE = "invitation_email_mismatch";
export const INVITATION_EXPIRED_ERROR_CODE = "invitation_expired";
export const INVITATION_REVOKED_ERROR_CODE = "invitation_revoked";
export const INVITATION_ALREADY_ACCEPTED_ERROR_CODE = "invitation_already_accepted";

export type InvitationStatus = OrganizationInvitationStatus | "expired";

export type InvitationPreview = Omit<OrganizationInvitationPreview, "status"> & { status: InvitationStatus };

export interface AcceptInvitationInput {
  token: string;
  confirmEmailMismatch?: boolean;
}

type Invitee = Pick<UserOutput, "id" | "email" | "emailVerified">;

@singleton()
export class InvitationAcceptanceService {
  constructor(
    private readonly invitationRepository: OrganizationInvitationRepository,
    private readonly organizationMemberRepository: OrganizationMemberRepository,
    private readonly projectRepository: ProjectRepository,
    private readonly projectMemberRepository: ProjectMemberRepository,
    private readonly userRepository: UserRepository,
    private readonly authService: AuthService,
    private readonly executionContextService: ExecutionContextService,
    private readonly txService: TxService
  ) {}

  async getPreview(token: string): Promise<InvitationPreview> {
    const preview = await this.invitationRepository.unscoped("invitation-by-token").findPreviewByTokenHash(hashInvitationToken(token));
    assert(preview, 404, "Invitation not found");

    return { ...preview, status: invitationStatusOf(preview) };
  }

  /** Accepting an invitation already accepted by the same user answers the organization again without changing their membership. */
  async acceptInvitation({ token, confirmEmailMismatch = false }: AcceptInvitationInput): Promise<CallerMembership> {
    const invitee = this.authService.currentUser;

    const membership = await this.txService.transaction(async () => {
      const invitation = await this.invitationRepository.unscoped("invitation-by-token").findByTokenHashAndLock(hashInvitationToken(token));
      assert(invitation, 404, "Invitation not found");
      const status = invitationStatusOf(invitation);
      assertAcceptable(invitation, status, invitee, confirmEmailMismatch);

      if (status === "pending") {
        await this.#join(invitation, invitee);
      }

      const joined = await this.organizationMemberRepository.findActiveMembership(invitee.id, { id: invitation.organizationId });

      if (!joined) {
        throw alreadyAccepted();
      }

      await this.userRepository.updateById(invitee.id, { lastUsedOrganizationId: invitation.organizationId });

      return joined;
    });

    return { ...membership, isActive: membership.organization.id === this.executionContextService.get("ORGANIZATION_CONTEXT")?.organizationId };
  }

  /** A user who already belongs to the organization keeps their role and project grants. */
  async #join(invitation: OrganizationInvitationOutput, invitee: Invitee): Promise<void> {
    const { id, organizationId, role } = invitation;
    const membership = await this.organizationMemberRepository.unscoped("invitation-by-token").createUnlessExists({ organizationId, userId: invitee.id, role });

    if (membership) {
      await this.#grantProjects(invitation, invitee);
    }

    await this.invitationRepository
      .unscoped("invitation-by-token")
      .updateById(id, { status: "accepted", acceptedByUserId: invitee.id, acceptedAt: new Date() });
  }

  async #grantProjects({ organizationId, projectGrants }: OrganizationInvitationOutput, invitee: Invitee): Promise<void> {
    if (projectGrants.length === 0) return;

    const liveProjectIds = new Set(
      await this.projectRepository.unscoped("invitation-by-token").findActiveIdsAmong(
        organizationId,
        projectGrants.map(grant => grant.projectId)
      )
    );
    await this.projectMemberRepository
      .unscoped("invitation-by-token")
      .createManyUnlessExist(
        projectGrants
          .filter(grant => liveProjectIds.has(grant.projectId))
          .map(({ projectId, role }) => ({ organizationId, projectId, userId: invitee.id, role }))
      );
  }
}

export function invitationStatusOf({ status, expiresAt }: Pick<OrganizationInvitationOutput, "status" | "expiresAt">): InvitationStatus {
  return status === "pending" && isBefore(expiresAt, new Date()) ? "expired" : status;
}

function assertAcceptable(invitation: OrganizationInvitationOutput, status: InvitationStatus, invitee: Invitee, confirmEmailMismatch: boolean): void {
  if (status === "accepted" && invitation.acceptedByUserId !== invitee.id) {
    throw alreadyAccepted();
  }

  if (status === "revoked") {
    throw createError(410, "The invitation was revoked", { errorCode: INVITATION_REVOKED_ERROR_CODE });
  }

  if (status === "expired") {
    throw createError(410, "The invitation has expired", { errorCode: INVITATION_EXPIRED_ERROR_CODE });
  }

  if (status === "pending" && !confirmEmailMismatch && !isVerifiedInvitedAddress(invitation, invitee)) {
    throw createError(409, "The invitation was sent to an email address this account has not verified", { errorCode: INVITATION_EMAIL_MISMATCH_ERROR_CODE });
  }
}

function isVerifiedInvitedAddress(invitation: OrganizationInvitationOutput, invitee: Invitee): boolean {
  return invitee.emailVerified && invitee.email?.trim().toLowerCase() === invitation.email;
}

function alreadyAccepted() {
  return createError(409, "The invitation has already been accepted", { errorCode: INVITATION_ALREADY_ACCEPTED_ERROR_CODE });
}
