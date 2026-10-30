import { isBefore } from "date-fns";
import assert from "http-assert";
import createError from "http-errors";
import { singleton } from "tsyringe";

import { AuthService } from "@src/auth/services/auth.service";
import { VerifiedEmailService } from "@src/auth/services/verified-email/verified-email.service";
import type { UnscopedReason } from "@src/core/repositories/unscoped-reasons";
import { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import { TxService } from "@src/core/services/tx/tx.service";
import { hashInvitationToken } from "@src/organization/lib/invitation-token/invitation-token";
import type { OrganizationInvitationStatus } from "@src/organization/model-schemas/organization-invitation/organization-invitation.schema";
import type { OrganizationRole } from "@src/organization/model-schemas/organization-member/organization-member.schema";
import { OrganizationRepository } from "@src/organization/repositories/organization/organization.repository";
import {
  type OrganizationInvitationOutput,
  type OrganizationInvitationPreview,
  OrganizationInvitationRepository,
  type ReceivedInvitation
} from "@src/organization/repositories/organization-invitation/organization-invitation.repository";
import { OrganizationMemberRepository } from "@src/organization/repositories/organization-member/organization-member.repository";
import { ProjectRepository } from "@src/organization/repositories/project/project.repository";
import { ProjectMemberRepository } from "@src/organization/repositories/project-member/project-member.repository";
import type { CallerMembership } from "@src/organization/services/organization/organization.service";
import { OrganizationActivityService } from "@src/organization/services/organization-activity/organization-activity.service";
import { ALREADY_MEMBER_ERROR_CODE } from "@src/organization/services/organization-invitation/organization-invitation.service";
import type { UserOutput } from "@src/user/repositories/user/user.repository";
import { UserRepository } from "@src/user/repositories/user/user.repository";

export const INVITATION_EMAIL_MISMATCH_ERROR_CODE = "invitation_email_mismatch";
export const INVITATION_EXPIRED_ERROR_CODE = "invitation_expired";
export const INVITATION_REVOKED_ERROR_CODE = "invitation_revoked";
export const INVITATION_DECLINED_ERROR_CODE = "invitation_declined";
export const INVITATION_ALREADY_ACCEPTED_ERROR_CODE = "invitation_already_accepted";
export const INVITATION_INVITER_LOST_ACCESS_ERROR_CODE = "invitation_inviter_lost_access";

export type InvitationStatus = OrganizationInvitationStatus | "expired";

export type InvitationPreview = Omit<OrganizationInvitationPreview, "status"> & { status: InvitationStatus };

export interface AcceptInvitationInput {
  token: string;
  confirmEmailMismatch?: boolean;
}

type Invitee = Pick<UserOutput, "id" | "email" | "emailVerified">;

type InvitationAccessReason = Extract<UnscopedReason, "invitation-by-token" | "invitation-by-verified-email">;

/** How the caller reached the invitation, which is also why answering it may write outside the caller's organization. */
type InvitationAccess =
  | { reason: "invitation-by-token"; where: Pick<OrganizationInvitationOutput, "tokenHash"> }
  | { reason: "invitation-by-verified-email"; where: Pick<OrganizationInvitationOutput, "id" | "email"> };

@singleton()
export class InvitationAcceptanceService {
  constructor(
    private readonly invitationRepository: OrganizationInvitationRepository,
    private readonly organizationRepository: OrganizationRepository,
    private readonly organizationMemberRepository: OrganizationMemberRepository,
    private readonly projectRepository: ProjectRepository,
    private readonly projectMemberRepository: ProjectMemberRepository,
    private readonly userRepository: UserRepository,
    private readonly authService: AuthService,
    private readonly executionContextService: ExecutionContextService,
    private readonly txService: TxService,
    private readonly organizationActivityService: OrganizationActivityService,
    private readonly verifiedEmailService: VerifiedEmailService
  ) {}

  async getPreview(token: string): Promise<InvitationPreview> {
    const preview = await this.invitationRepository.unscoped("invitation-by-token").findPreviewByTokenHash(hashInvitationToken(token));
    assert(preview, 404, "Invitation not found");

    return { ...preview, status: invitationStatusOf(preview) };
  }

  async listReceivedInvitations(): Promise<ReceivedInvitation[]> {
    const { id, userId } = this.authService.currentUser;
    const email = userId && (await this.verifiedEmailService.getRecentVerifiedEmail(userId));

    if (!email) return [];

    return await this.invitationRepository.unscoped("invitation-by-verified-email").findPendingSentTo(email, { exceptTeamsOf: id });
  }

  /** Accepting an invitation already accepted by the same user answers the organization again without changing their membership. */
  async acceptInvitation({ token, confirmEmailMismatch = false }: AcceptInvitationInput): Promise<CallerMembership> {
    return await this.#accept({ reason: "invitation-by-token", where: { tokenHash: hashInvitationToken(token) } }, confirmEmailMismatch);
  }

  async acceptReceivedInvitation(id: OrganizationInvitationOutput["id"]): Promise<CallerMembership> {
    return await this.#accept(await this.#receivedInvitationAccess(id));
  }

  /** Declining twice changes nothing, and the team's activity names the invited address rather than the account that declined. */
  async declineReceivedInvitation(id: OrganizationInvitationOutput["id"]): Promise<void> {
    const access = await this.#receivedInvitationAccess(id);

    await this.txService.transaction(async () => {
      const invitation = await this.#lockInvitation(access);
      const status = invitationStatusOf(invitation);

      if (status === "declined") return;
      if (status === "accepted") throw alreadyAccepted();
      assertOpen(status);

      await this.invitationRepository.unscoped(access.reason).updateById(invitation.id, { status: "declined", declinedAt: new Date() });
      await this.organizationActivityService.recordInvitationAnswer(
        { organizationId: invitation.organizationId, type: "invitation_declined", actorUserId: null, payload: { email: invitation.email } },
        access.reason
      );
    });
  }

  async #accept(access: InvitationAccess, confirmEmailMismatch = false): Promise<CallerMembership> {
    const invitee = this.authService.currentUser;

    const membership = await this.txService.transaction(async () => {
      const invitation = await this.#lockInvitation(access);
      const status = invitationStatusOf(invitation);
      const isSentToInvitee = access.reason === "invitation-by-verified-email" || isVerifiedInvitedAddress(invitation, invitee);
      assertAcceptable(invitation, status, invitee, isSentToInvitee || confirmEmailMismatch);

      if (status === "pending") {
        await this.#assertInviterMayStillInvite(invitation, access.reason);
        await this.#join(invitation, invitee, access.reason, isSentToInvitee);
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

  /** Without its token, an invitation is the caller's to answer only when it was sent to the email Auth0 verified for them, and any other is not found. */
  async #receivedInvitationAccess(id: OrganizationInvitationOutput["id"]): Promise<InvitationAccess> {
    const { userId } = this.authService.currentUser;
    const email = userId && (await this.verifiedEmailService.getVerifiedEmail(userId));
    assert(email, 404, "Invitation not found");

    return { reason: "invitation-by-verified-email", where: { id, email } };
  }

  /** Locks the organization row, then the invitation row, the order every invitation write takes, without blocking inserts that reference either row. */
  async #lockInvitation({ reason, where }: InvitationAccess): Promise<OrganizationInvitationOutput> {
    const invitations = this.invitationRepository.unscoped(reason);
    const found = await invitations.findOneBy(where);
    const organization =
      found && (await this.organizationRepository.findOneByAndLock({ id: found.organizationId, deletedAt: null }, { strength: "no key update" }));
    const invitation = organization && (await invitations.findOneByAndLock(where, { strength: "no key update" }));
    assert(invitation, 404, "Invitation not found");

    return invitation;
  }

  /** Locks the inviter's membership, so they cannot leave or lose their role while the invitee joins on their word. */
  async #assertInviterMayStillInvite({ organizationId, invitedByUserId, role }: OrganizationInvitationOutput, reason: InvitationAccessReason): Promise<void> {
    const inviter =
      invitedByUserId &&
      (await this.organizationMemberRepository.unscoped(reason).findOneByAndLock({ organizationId, userId: invitedByUserId }, { strength: "no key update" }));

    if (!inviter || !mayInviteAs(inviter.role, role)) {
      throw createError(410, "Whoever sent the invitation can no longer invite to its role", { errorCode: INVITATION_INVITER_LOST_ACCESS_ERROR_CODE });
    }
  }

  /** A user who already belongs to the organization keeps their role and project grants, and consumes only an invitation sent to their verified address. */
  async #join(invitation: OrganizationInvitationOutput, invitee: Invitee, reason: InvitationAccessReason, isSentToInvitee: boolean): Promise<void> {
    const { id, organizationId, role, projectAccess } = invitation;
    const membership = await this.organizationMemberRepository.unscoped(reason).createUnlessExists({ organizationId, userId: invitee.id, role, projectAccess });

    if (membership) {
      await this.#grantProjects(invitation, invitee, reason);
      await this.organizationActivityService.recordInvitationAnswer(
        { organizationId, type: "member_joined", actorUserId: invitee.id, payload: { role } },
        reason
      );
    } else if (!isSentToInvitee) {
      throw createError(409, "Already a member of the organization", { errorCode: ALREADY_MEMBER_ERROR_CODE });
    }

    await this.invitationRepository.unscoped(reason).updateById(id, { status: "accepted", acceptedByUserId: invitee.id, acceptedAt: new Date() });
  }

  async #grantProjects(
    { organizationId, projectAccess, projectGrants }: OrganizationInvitationOutput,
    invitee: Invitee,
    reason: InvitationAccessReason
  ): Promise<void> {
    if (projectAccess === "all" || projectGrants.length === 0) return;

    const liveProjectIds = new Set(
      await this.projectRepository.unscoped(reason).findActiveIdsAmong(
        organizationId,
        projectGrants.map(grant => grant.projectId)
      )
    );
    await this.projectMemberRepository
      .unscoped(reason)
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

function assertAcceptable(invitation: OrganizationInvitationOutput, status: InvitationStatus, invitee: Invitee, isAddressConfirmed: boolean): void {
  if (status === "accepted" && invitation.acceptedByUserId !== invitee.id) {
    throw alreadyAccepted();
  }

  assertOpen(status);

  if (status === "pending" && !isAddressConfirmed) {
    throw createError(409, "The invitation was sent to an email address this account has not verified", { errorCode: INVITATION_EMAIL_MISMATCH_ERROR_CODE });
  }
}

function assertOpen(status: InvitationStatus): void {
  if (status === "revoked") {
    throw createError(410, "The invitation was revoked", { errorCode: INVITATION_REVOKED_ERROR_CODE });
  }

  if (status === "declined") {
    throw createError(410, "The invitation was declined", { errorCode: INVITATION_DECLINED_ERROR_CODE });
  }

  if (status === "expired") {
    throw createError(410, "The invitation has expired", { errorCode: INVITATION_EXPIRED_ERROR_CODE });
  }
}

function mayInviteAs(inviterRole: OrganizationRole, invitedRole: OrganizationRole): boolean {
  return inviterRole === "owner" || (inviterRole === "admin" && invitedRole !== "owner");
}

function isVerifiedInvitedAddress(invitation: OrganizationInvitationOutput, invitee: Invitee): boolean {
  return invitee.emailVerified && invitee.email?.trim().toLowerCase() === invitation.email;
}

function alreadyAccepted() {
  return createError(409, "The invitation has already been accepted", { errorCode: INVITATION_ALREADY_ACCEPTED_ERROR_CODE });
}
