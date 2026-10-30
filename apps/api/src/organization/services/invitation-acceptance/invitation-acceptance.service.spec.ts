import { faker } from "@faker-js/faker";
import { addDays, addMilliseconds } from "date-fns";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AuthService } from "@src/auth/services/auth.service";
import type { VerifiedEmailService } from "@src/auth/services/verified-email/verified-email.service";
import type { TxService } from "@src/core/services";
import type { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import { createInvitationToken, hashInvitationToken } from "@src/organization/lib/invitation-token/invitation-token";
import type { OrganizationOutput, OrganizationRepository } from "@src/organization/repositories/organization/organization.repository";
import type {
  OrganizationInvitationOutput,
  OrganizationInvitationPreview,
  OrganizationInvitationRepository,
  ReceivedInvitation
} from "@src/organization/repositories/organization-invitation/organization-invitation.repository";
import type {
  Membership,
  OrganizationMemberOutput,
  OrganizationMemberRepository
} from "@src/organization/repositories/organization-member/organization-member.repository";
import type { ProjectRepository } from "@src/organization/repositories/project/project.repository";
import type { ProjectMemberRepository } from "@src/organization/repositories/project-member/project-member.repository";
import type { OrganizationActivityService } from "@src/organization/services/organization-activity/organization-activity.service";
import { ALREADY_MEMBER_ERROR_CODE } from "@src/organization/services/organization-invitation/organization-invitation.service";
import type { OrganizationContext } from "@src/organization/types/organization-context";
import type { UserOutput, UserRepository } from "@src/user/repositories";
import {
  INVITATION_ALREADY_ACCEPTED_ERROR_CODE,
  INVITATION_DECLINED_ERROR_CODE,
  INVITATION_EMAIL_MISMATCH_ERROR_CODE,
  INVITATION_EXPIRED_ERROR_CODE,
  INVITATION_INVITER_LOST_ACCESS_ERROR_CODE,
  INVITATION_REVOKED_ERROR_CODE,
  InvitationAcceptanceService,
  invitationStatusOf
} from "./invitation-acceptance.service";

import { createOrganization, createOrganizationInvitation, createOrganizationMember } from "@test/seeders/organization.seeder";
import { createOrganizationContext } from "@test/seeders/organization-context.seeder";
import { createUser } from "@test/seeders/user.seeder";

describe(InvitationAcceptanceService.name, () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  describe("getPreview", () => {
    it("looks the invitation up by the hash of its token, outside the caller's organization", async () => {
      const token = createInvitationToken();
      const preview = createPreview();
      const { service, invitationRepository, unscopedRepositories } = setup({ preview });

      await expect(service.getPreview(token)).resolves.toEqual(preview);
      expect(invitationRepository.unscoped).toHaveBeenCalledWith("invitation-by-token");
      expect(unscopedRepositories.invitations.findPreviewByTokenHash).toHaveBeenCalledWith(hashInvitationToken(token));
    });

    it("reports a pending invitation past its expiry as expired", async () => {
      const { service } = setup({ preview: createPreview({ expiresAt: addDays(new Date(), -1) }) });

      await expect(service.getPreview(createInvitationToken())).resolves.toMatchObject({ status: "expired" });
    });

    it("answers not found for an unknown token", async () => {
      const { service } = setup({ preview: undefined });

      await expect(service.getPreview(createInvitationToken())).rejects.toMatchObject({ status: 404, message: "Invitation not found" });
    });
  });

  describe("acceptInvitation", () => {
    it("adds the invitee with the invited role, project access and grants of live projects, then marks the invitation accepted", async () => {
      vi.useFakeTimers({ now: new Date("2026-10-10T12:00:00.000Z") });
      const token = createInvitationToken();
      const [grantedProjectId, deletedProjectId] = [faker.string.uuid(), faker.string.uuid()];
      const invitation = createOrganizationInvitation({
        role: "member",
        projectAccess: "selected",
        projectGrants: [
          { projectId: grantedProjectId, role: "viewer" },
          { projectId: deletedProjectId, role: "member" }
        ]
      });
      const { service, invitee, txService, invitationRepository, organizationRepository, unscopedRepositories, organizationMemberRepository, userRepository } =
        setup({
          invitation,
          liveProjectIds: [grantedProjectId]
        });

      await service.acceptInvitation({ token });

      expect(txService.transaction).toHaveBeenCalledTimes(1);
      expect(invitationRepository.unscoped).toHaveBeenCalledWith("invitation-by-token");
      expect(unscopedRepositories.invitations.findOneBy).toHaveBeenCalledWith({ tokenHash: hashInvitationToken(token) });
      expect(organizationRepository.findOneByAndLock).toHaveBeenCalledWith({ id: invitation.organizationId, deletedAt: null }, { strength: "no key update" });
      expect(unscopedRepositories.invitations.findOneByAndLock).toHaveBeenCalledWith({ tokenHash: hashInvitationToken(token) }, { strength: "no key update" });
      expect(organizationRepository.findOneByAndLock.mock.invocationCallOrder[0]).toBeLessThan(
        unscopedRepositories.invitations.findOneByAndLock.mock.invocationCallOrder[0]
      );
      expect(unscopedRepositories.members.createUnlessExists).toHaveBeenCalledWith({
        organizationId: invitation.organizationId,
        userId: invitee.id,
        role: "member",
        projectAccess: "selected"
      });
      expect(unscopedRepositories.projects.findActiveIdsAmong).toHaveBeenCalledWith(invitation.organizationId, [grantedProjectId, deletedProjectId]);
      expect(unscopedRepositories.projectMembers.createManyUnlessExist).toHaveBeenCalledWith([
        { organizationId: invitation.organizationId, projectId: grantedProjectId, userId: invitee.id, role: "viewer" }
      ]);
      expect(unscopedRepositories.invitations.updateById).toHaveBeenCalledWith(invitation.id, {
        status: "accepted",
        acceptedByUserId: invitee.id,
        acceptedAt: new Date("2026-10-10T12:00:00.000Z")
      });
      expect(organizationMemberRepository.findActiveMembership).toHaveBeenCalledWith(invitee.id, { id: invitation.organizationId });
      expect(userRepository.updateById).toHaveBeenCalledWith(invitee.id, { lastUsedOrganizationId: invitation.organizationId });
    });

    it("records the join in the organization's activity, by the invitee and with the invited role", async () => {
      const invitation = createOrganizationInvitation({ role: "billing" });
      const { service, invitee, organizationActivityService } = setup({ invitation });

      await service.acceptInvitation({ token: createInvitationToken() });

      expect(organizationActivityService.recordInvitationAnswer).toHaveBeenCalledTimes(1);
      expect(organizationActivityService.recordInvitationAnswer).toHaveBeenCalledWith(
        { organizationId: invitation.organizationId, type: "member_joined", actorUserId: invitee.id, payload: { role: "billing" } },
        "invitation-by-token"
      );
    });

    it("answers the joined organization as inactive while the request ran in another one", async () => {
      const invitation = createOrganizationInvitation();
      const membership = createMembership({ organizationId: invitation.organizationId, role: "member" });
      const { service } = setup({ invitation, membership, context: createOrganizationContext() });

      await expect(service.acceptInvitation({ token: createInvitationToken() })).resolves.toEqual({ ...membership, isActive: false });
    });

    it("answers the joined organization as active when the request ran in it", async () => {
      const invitation = createOrganizationInvitation();
      const membership = createMembership({ organizationId: invitation.organizationId });
      const { service } = setup({ invitation, membership, context: createOrganizationContext({ organizationId: invitation.organizationId }) });

      await expect(service.acceptInvitation({ token: createInvitationToken() })).resolves.toMatchObject({ isActive: true });
    });

    it("answers the joined organization as inactive without an active organization", async () => {
      const invitation = createOrganizationInvitation();
      const { service } = setup({ invitation, context: null });

      await expect(service.acceptInvitation({ token: createInvitationToken() })).resolves.toMatchObject({ isActive: false });
    });

    it("adds the invitee with access to every project and without grants when the invitation reaches every project", async () => {
      const invitation = createOrganizationInvitation({
        role: "viewer",
        projectAccess: "all",
        projectGrants: [{ projectId: faker.string.uuid(), role: "viewer" }]
      });
      const { service, invitee, unscopedRepositories } = setup({ invitation });

      await service.acceptInvitation({ token: createInvitationToken() });

      expect(unscopedRepositories.members.createUnlessExists).toHaveBeenCalledWith({
        organizationId: invitation.organizationId,
        userId: invitee.id,
        role: "viewer",
        projectAccess: "all"
      });
      expect(unscopedRepositories.projects.findActiveIdsAmong).not.toHaveBeenCalled();
      expect(unscopedRepositories.projectMembers.createManyUnlessExist).not.toHaveBeenCalled();
    });

    it("grants no project when the invitation names none", async () => {
      const { service, unscopedRepositories } = setup({ invitation: createOrganizationInvitation({ projectGrants: [] }) });

      await service.acceptInvitation({ token: createInvitationToken() });

      expect(unscopedRepositories.projects.findActiveIdsAmong).not.toHaveBeenCalled();
      expect(unscopedRepositories.projectMembers.createManyUnlessExist).not.toHaveBeenCalled();
    });

    it("keeps the role and grants of an invitee who is already a member and consumes the invitation", async () => {
      const invitation = createOrganizationInvitation({ role: "owner", projectGrants: [{ projectId: faker.string.uuid(), role: "admin" }] });
      const membership = createMembership({ organizationId: invitation.organizationId, role: "viewer" });
      const { service, invitee, unscopedRepositories, organizationActivityService } = setup({ invitation, membership, isAlreadyMember: true });

      await expect(service.acceptInvitation({ token: createInvitationToken() })).resolves.toMatchObject({ role: "viewer" });
      expect(unscopedRepositories.projectMembers.createManyUnlessExist).not.toHaveBeenCalled();
      expect(organizationActivityService.recordInvitationAnswer).not.toHaveBeenCalled();
      expect(unscopedRepositories.invitations.updateById).toHaveBeenCalledWith(invitation.id, expect.objectContaining({ acceptedByUserId: invitee.id }));
    });

    it.each([
      { case: "with another email", invitee: { email: "joe@example.com", emailVerified: true } },
      { case: "whose matching email is not verified", invitee: { email: "jane@example.com", emailVerified: false } }
    ])("refuses a member $case who confirmed, leaving the invitation pending", async ({ invitee }) => {
      const invitation = createOrganizationInvitation({ email: "jane@example.com" });
      const { service, unscopedRepositories, userRepository, organizationActivityService } = setup({ invitation, invitee, isAlreadyMember: true });

      await expect(service.acceptInvitation({ token: createInvitationToken(), confirmEmailMismatch: true })).rejects.toMatchObject({
        status: 409,
        errorCode: ALREADY_MEMBER_ERROR_CODE,
        message: "Already a member of the organization"
      });
      expect(unscopedRepositories.invitations.updateById).not.toHaveBeenCalled();
      expect(userRepository.updateById).not.toHaveBeenCalled();
      expect(organizationActivityService.recordInvitationAnswer).not.toHaveBeenCalled();
    });

    it.each([
      { case: "differs only in case and surrounding spaces", email: "  Jane@Example.COM " },
      { case: "matches exactly", email: "jane@example.com" }
    ])("accepts without confirmation when the invitee's email $case", async ({ email }) => {
      const { service, unscopedRepositories } = setup({
        invitation: createOrganizationInvitation({ email: "jane@example.com" }),
        invitee: { email }
      });

      await service.acceptInvitation({ token: createInvitationToken() });

      expect(unscopedRepositories.members.createUnlessExists).toHaveBeenCalled();
    });

    it.each([
      { case: "another email", email: "joe@example.com", emailVerified: true },
      { case: "no email", email: null, emailVerified: true },
      { case: "the invited email not verified", email: "jane@example.com", emailVerified: false }
    ])("refuses an invitee with $case until they confirm", async ({ email, emailVerified }) => {
      const { service, unscopedRepositories, userRepository } = setup({
        invitation: createOrganizationInvitation({ email: "jane@example.com" }),
        invitee: { email, emailVerified }
      });

      await expect(service.acceptInvitation({ token: createInvitationToken() })).rejects.toMatchObject({
        status: 409,
        errorCode: INVITATION_EMAIL_MISMATCH_ERROR_CODE,
        message: "The invitation was sent to an email address this account has not verified"
      });
      expect(unscopedRepositories.members.createUnlessExists).not.toHaveBeenCalled();
      expect(unscopedRepositories.invitations.updateById).not.toHaveBeenCalled();
      expect(userRepository.updateById).not.toHaveBeenCalled();
    });

    it("lets an invitee with another email join once they confirm", async () => {
      const invitation = createOrganizationInvitation({ email: "jane@example.com" });
      const { service, invitee, unscopedRepositories } = setup({ invitation, invitee: { email: "joe@example.com" } });

      await service.acceptInvitation({ token: createInvitationToken(), confirmEmailMismatch: true });

      expect(unscopedRepositories.members.createUnlessExists).toHaveBeenCalledWith(expect.objectContaining({ userId: invitee.id }));
      expect(unscopedRepositories.invitations.updateById).toHaveBeenCalledWith(invitation.id, expect.objectContaining({ status: "accepted" }));
    });

    it("answers the organization again to the invitee who already accepted, without writing a membership", async () => {
      const { service, invitee, unscopedRepositories, userRepository, organizationActivityService } = setup({ invitation: undefined });
      const invitation = createOrganizationInvitation({ status: "accepted", acceptedByUserId: invitee.id, email: "someone-else@example.com" });
      unscopedRepositories.invitations.findOneBy.mockResolvedValue(invitation);
      unscopedRepositories.invitations.findOneByAndLock.mockResolvedValue(invitation);

      await expect(service.acceptInvitation({ token: createInvitationToken() })).resolves.toMatchObject({ isActive: false });
      expect(unscopedRepositories.members.createUnlessExists).not.toHaveBeenCalled();
      expect(organizationActivityService.recordInvitationAnswer).not.toHaveBeenCalled();
      expect(unscopedRepositories.invitations.updateById).not.toHaveBeenCalled();
      expect(userRepository.updateById).toHaveBeenCalledWith(invitee.id, { lastUsedOrganizationId: invitation.organizationId });
    });

    it("refuses the invitee who accepted and was removed since", async () => {
      const { service, invitee, unscopedRepositories, userRepository } = setup({ invitation: undefined, membership: null });
      const invitation = createOrganizationInvitation({ status: "accepted", acceptedByUserId: invitee.id });
      unscopedRepositories.invitations.findOneBy.mockResolvedValue(invitation);
      unscopedRepositories.invitations.findOneByAndLock.mockResolvedValue(invitation);

      await expect(service.acceptInvitation({ token: createInvitationToken() })).rejects.toMatchObject({
        status: 409,
        errorCode: INVITATION_ALREADY_ACCEPTED_ERROR_CODE
      });
      expect(userRepository.updateById).not.toHaveBeenCalled();
    });

    it("refuses an invitation someone else accepted", async () => {
      const { service, unscopedRepositories, organizationMemberRepository } = setup({
        invitation: createOrganizationInvitation({ status: "accepted", acceptedByUserId: faker.string.uuid() })
      });

      await expect(service.acceptInvitation({ token: createInvitationToken(), confirmEmailMismatch: true })).rejects.toMatchObject({
        status: 409,
        errorCode: INVITATION_ALREADY_ACCEPTED_ERROR_CODE,
        message: "The invitation has already been accepted"
      });
      expect(unscopedRepositories.members.createUnlessExists).not.toHaveBeenCalled();
      expect(organizationMemberRepository.findActiveMembership).not.toHaveBeenCalled();
    });

    it.each([
      {
        case: "a revoked invitation",
        invitation: { status: "revoked" as const, expiresAt: addDays(new Date(), -1) },
        error: { status: 410, errorCode: INVITATION_REVOKED_ERROR_CODE, message: "The invitation was revoked" }
      },
      {
        case: "a declined invitation",
        invitation: { status: "declined" as const, declinedAt: new Date() },
        error: { status: 410, errorCode: INVITATION_DECLINED_ERROR_CODE, message: "The invitation was declined" }
      },
      {
        case: "an expired invitation",
        invitation: { expiresAt: addDays(new Date(), -1) },
        error: { status: 410, errorCode: INVITATION_EXPIRED_ERROR_CODE, message: "The invitation has expired" }
      }
    ])("explains why it refuses $case before checking the email", async ({ invitation, error }) => {
      const { service, unscopedRepositories } = setup({ invitation: createOrganizationInvitation({ email: "jane@example.com", ...invitation }) });

      await expect(service.acceptInvitation({ token: createInvitationToken() })).rejects.toMatchObject(error);
      expect(unscopedRepositories.members.createUnlessExists).not.toHaveBeenCalled();
      expect(unscopedRepositories.invitations.updateById).not.toHaveBeenCalled();
    });

    it("answers not found for an unknown token", async () => {
      const { service, organizationRepository, organizationMemberRepository } = setup({ invitation: undefined });

      await expect(service.acceptInvitation({ token: createInvitationToken() })).rejects.toMatchObject({ status: 404, message: "Invitation not found" });
      expect(organizationRepository.findOneByAndLock).not.toHaveBeenCalled();
      expect(organizationMemberRepository.findActiveMembership).not.toHaveBeenCalled();
    });

    it("answers not found for an invitation of a deleted organization", async () => {
      const { service, unscopedRepositories } = setup({ invitation: createOrganizationInvitation(), organization: null });

      await expect(service.acceptInvitation({ token: createInvitationToken() })).rejects.toMatchObject({ status: 404, message: "Invitation not found" });
      expect(unscopedRepositories.invitations.findOneByAndLock).not.toHaveBeenCalled();
      expect(unscopedRepositories.members.createUnlessExists).not.toHaveBeenCalled();
    });

    it("answers not found when the token stopped matching before the invitation was locked", async () => {
      const { service, unscopedRepositories } = setup({ invitation: createOrganizationInvitation(), lockedInvitation: null });

      await expect(service.acceptInvitation({ token: createInvitationToken() })).rejects.toMatchObject({ status: 404, message: "Invitation not found" });
      expect(unscopedRepositories.members.createUnlessExists).not.toHaveBeenCalled();
    });

    it("locks the inviter's membership in the invitation's organization after the invitation and before the invitee joins", async () => {
      const invitation = createOrganizationInvitation();
      const { service, unscopedRepositories } = setup({ invitation });

      await service.acceptInvitation({ token: createInvitationToken() });

      expect(unscopedRepositories.members.findOneByAndLock).toHaveBeenCalledWith(
        { organizationId: invitation.organizationId, userId: invitation.invitedByUserId },
        { strength: "no key update" }
      );
      expect(unscopedRepositories.invitations.findOneByAndLock.mock.invocationCallOrder[0]).toBeLessThan(
        unscopedRepositories.members.findOneByAndLock.mock.invocationCallOrder[0]
      );
      expect(unscopedRepositories.members.findOneByAndLock.mock.invocationCallOrder[0]).toBeLessThan(
        unscopedRepositories.members.createUnlessExists.mock.invocationCallOrder[0]
      );
    });

    it.each([
      { inviterRole: "owner" as const, role: "owner" as const },
      { inviterRole: "owner" as const, role: "admin" as const },
      { inviterRole: "admin" as const, role: "admin" as const },
      { inviterRole: "admin" as const, role: "viewer" as const }
    ])("lets the invitee join as $role on the word of an inviter who is still $inviterRole", async ({ inviterRole, role }) => {
      const { service, unscopedRepositories } = setup({ invitation: createOrganizationInvitation({ role }), inviter: { role: inviterRole } });

      await service.acceptInvitation({ token: createInvitationToken() });

      expect(unscopedRepositories.members.createUnlessExists).toHaveBeenCalledWith(expect.objectContaining({ role }));
    });

    it.each([
      { case: "who is no longer a member", invitation: {}, inviter: null },
      { case: "who is now a member", invitation: { role: "member" as const }, inviter: { role: "member" as const } },
      { case: "who is now billing", invitation: { role: "viewer" as const }, inviter: { role: "billing" as const } },
      { case: "who is now a viewer", invitation: { role: "viewer" as const }, inviter: { role: "viewer" as const } },
      { case: "who is now an admin, to an owner invitation", invitation: { role: "owner" as const }, inviter: { role: "admin" as const } },
      { case: "whose account is gone", invitation: { invitedByUserId: null }, inviter: undefined }
    ])("refuses with 410 an invitation from an inviter $case, writing nothing", async ({ invitation, inviter }) => {
      const { service, unscopedRepositories, userRepository, organizationActivityService } = setup({
        invitation: createOrganizationInvitation(invitation),
        inviter
      });

      await expect(service.acceptInvitation({ token: createInvitationToken() })).rejects.toMatchObject({
        status: 410,
        errorCode: INVITATION_INVITER_LOST_ACCESS_ERROR_CODE,
        message: "Whoever sent the invitation can no longer invite to its role"
      });
      expect(unscopedRepositories.members.createUnlessExists).not.toHaveBeenCalled();
      expect(unscopedRepositories.invitations.updateById).not.toHaveBeenCalled();
      expect(organizationActivityService.recordInvitationAnswer).not.toHaveBeenCalled();
      expect(userRepository.updateById).not.toHaveBeenCalled();
    });

    it("looks for no inviter on an invitation whose inviter's account is gone", async () => {
      const { service, unscopedRepositories } = setup({ invitation: createOrganizationInvitation({ invitedByUserId: null }) });

      await expect(service.acceptInvitation({ token: createInvitationToken() })).rejects.toMatchObject({ status: 410 });
      expect(unscopedRepositories.members.findOneByAndLock).not.toHaveBeenCalled();
    });

    it("answers the organization again to the invitee who already accepted, whatever became of the inviter", async () => {
      const { service, invitee, unscopedRepositories } = setup({ invitation: undefined, inviter: null });
      const invitation = createOrganizationInvitation({ status: "accepted", acceptedByUserId: invitee.id });
      unscopedRepositories.invitations.findOneBy.mockResolvedValue(invitation);
      unscopedRepositories.invitations.findOneByAndLock.mockResolvedValue(invitation);

      await expect(service.acceptInvitation({ token: createInvitationToken() })).resolves.toMatchObject({ role: "member" });
      expect(unscopedRepositories.members.findOneByAndLock).not.toHaveBeenCalled();
    });
  });

  describe("listReceivedInvitations", () => {
    it("lists the pending invitations sent to the email Auth0 verified for the caller, except to the teams they belong to", async () => {
      const receivedInvitations = [createReceivedInvitation(), createReceivedInvitation()];
      const { service, invitee, invitationRepository, unscopedRepositories, verifiedEmailService } = setup({
        verifiedEmail: "jane@example.com",
        receivedInvitations
      });

      await expect(service.listReceivedInvitations()).resolves.toEqual(receivedInvitations);
      expect(verifiedEmailService.getRecentVerifiedEmail).toHaveBeenCalledWith(invitee.userId);
      expect(invitationRepository.unscoped).toHaveBeenCalledWith("invitation-by-verified-email");
      expect(unscopedRepositories.invitations.findPendingSentTo).toHaveBeenCalledWith("jane@example.com", { exceptTeamsOf: invitee.id });
    });

    it("lists nothing when Auth0 verified no email for the caller", async () => {
      const { service, unscopedRepositories } = setup({
        invitee: { email: "jane@example.com", emailVerified: true },
        verifiedEmail: null,
        receivedInvitations: [createReceivedInvitation()]
      });

      await expect(service.listReceivedInvitations()).resolves.toEqual([]);
      expect(unscopedRepositories.invitations.findPendingSentTo).not.toHaveBeenCalled();
    });

    it("lists nothing without asking Auth0 for a user it does not know", async () => {
      const { service, verifiedEmailService, unscopedRepositories } = setup({ invitee: { userId: null }, verifiedEmail: "jane@example.com" });

      await expect(service.listReceivedInvitations()).resolves.toEqual([]);
      expect(verifiedEmailService.getRecentVerifiedEmail).not.toHaveBeenCalled();
      expect(unscopedRepositories.invitations.findPendingSentTo).not.toHaveBeenCalled();
    });
  });

  describe("acceptReceivedInvitation", () => {
    it("joins the invitee through the invitation with this id sent to the email Auth0 verified for them, without its token", async () => {
      vi.useFakeTimers({ now: new Date("2026-10-29T12:00:00.000Z") });
      const projectId = faker.string.uuid();
      const invitation = createOrganizationInvitation({
        email: "jane@example.com",
        role: "member",
        projectAccess: "selected",
        projectGrants: [{ projectId, role: "viewer" }]
      });
      const {
        service,
        invitee,
        verifiedEmailService,
        invitationRepository,
        organizationMemberRepository,
        projectRepository,
        projectMemberRepository,
        organizationRepository,
        unscopedRepositories,
        organizationActivityService,
        userRepository
      } = setup({ invitation, invitee: { email: "joe@example.com", emailVerified: false }, verifiedEmail: "jane@example.com", liveProjectIds: [projectId] });

      await expect(service.acceptReceivedInvitation(invitation.id)).resolves.toMatchObject({ role: "member" });

      const where = { id: invitation.id, email: "jane@example.com" };
      expect(verifiedEmailService.getVerifiedEmail).toHaveBeenCalledWith(invitee.userId);
      expect(verifiedEmailService.getRecentVerifiedEmail).not.toHaveBeenCalled();
      expect(unscopedRepositories.invitations.findOneBy).toHaveBeenCalledWith(where);
      expect(unscopedRepositories.invitations.findOneByAndLock).toHaveBeenCalledWith(where, { strength: "no key update" });
      expect(organizationRepository.findOneByAndLock.mock.invocationCallOrder[0]).toBeLessThan(
        unscopedRepositories.invitations.findOneByAndLock.mock.invocationCallOrder[0]
      );
      for (const repository of [invitationRepository, organizationMemberRepository, projectRepository, projectMemberRepository]) {
        expect(repository.unscoped).toHaveBeenCalledWith("invitation-by-verified-email");
        expect(repository.unscoped).not.toHaveBeenCalledWith("invitation-by-token");
      }
      expect(unscopedRepositories.members.createUnlessExists).toHaveBeenCalledWith({
        organizationId: invitation.organizationId,
        userId: invitee.id,
        role: "member",
        projectAccess: "selected"
      });
      expect(unscopedRepositories.projectMembers.createManyUnlessExist).toHaveBeenCalledWith([
        { organizationId: invitation.organizationId, projectId, userId: invitee.id, role: "viewer" }
      ]);
      expect(organizationActivityService.recordInvitationAnswer).toHaveBeenCalledWith(
        { organizationId: invitation.organizationId, type: "member_joined", actorUserId: invitee.id, payload: { role: "member" } },
        "invitation-by-verified-email"
      );
      expect(unscopedRepositories.invitations.updateById).toHaveBeenCalledWith(invitation.id, {
        status: "accepted",
        acceptedByUserId: invitee.id,
        acceptedAt: new Date("2026-10-29T12:00:00.000Z")
      });
      expect(userRepository.updateById).toHaveBeenCalledWith(invitee.id, { lastUsedOrganizationId: invitation.organizationId });
    });

    it("consumes the invitation of an invitee who is already a member", async () => {
      const invitation = createOrganizationInvitation({ email: "jane@example.com" });
      const { service, invitee, unscopedRepositories } = setup({
        invitation,
        invitee: { email: "joe@example.com" },
        verifiedEmail: "jane@example.com",
        isAlreadyMember: true
      });

      await service.acceptReceivedInvitation(invitation.id);

      expect(unscopedRepositories.invitations.updateById).toHaveBeenCalledWith(invitation.id, expect.objectContaining({ acceptedByUserId: invitee.id }));
    });

    it("answers not found for an invitation not sent to the caller's verified email", async () => {
      const { service, unscopedRepositories } = setup({ invitation: undefined });

      await expect(service.acceptReceivedInvitation(faker.string.uuid())).rejects.toMatchObject({ status: 404, message: "Invitation not found" });
      expect(unscopedRepositories.members.createUnlessExists).not.toHaveBeenCalled();
    });

    it.each([
      {
        case: "Auth0 verified no email for the caller",
        invitee: { email: "jane@example.com", emailVerified: true },
        verifiedEmail: null
      },
      { case: "Auth0 does not know the caller", invitee: { userId: null }, verifiedEmail: "jane@example.com" }
    ])("answers not found without looking anything up when $case", async ({ invitee, verifiedEmail }) => {
      const invitation = createOrganizationInvitation({ email: "jane@example.com" });
      const { service, txService, unscopedRepositories } = setup({ invitation, invitee, verifiedEmail });

      await expect(service.acceptReceivedInvitation(invitation.id)).rejects.toMatchObject({ status: 404, message: "Invitation not found" });
      expect(txService.transaction).not.toHaveBeenCalled();
      expect(unscopedRepositories.invitations.findOneBy).not.toHaveBeenCalled();
    });

    it("refuses an invitation the caller declined", async () => {
      const invitation = createOrganizationInvitation({ status: "declined", declinedAt: new Date() });
      const { service, unscopedRepositories } = setup({ invitation });

      await expect(service.acceptReceivedInvitation(invitation.id)).rejects.toMatchObject({ status: 410, errorCode: INVITATION_DECLINED_ERROR_CODE });
      expect(unscopedRepositories.members.createUnlessExists).not.toHaveBeenCalled();
    });
  });

  describe("declineReceivedInvitation", () => {
    it("marks the invitation declined and shows the team the invited address rather than who declined", async () => {
      vi.useFakeTimers({ now: new Date("2026-10-29T12:00:00.000Z") });
      const invitation = createOrganizationInvitation({ email: "jane@example.com" });
      const {
        service,
        invitee,
        verifiedEmailService,
        txService,
        invitationRepository,
        organizationRepository,
        unscopedRepositories,
        organizationActivityService
      } = setup({ invitation, verifiedEmail: "jane@example.com" });

      await service.declineReceivedInvitation(invitation.id);

      const where = { id: invitation.id, email: "jane@example.com" };
      expect(verifiedEmailService.getVerifiedEmail).toHaveBeenCalledWith(invitee.userId);
      expect(txService.transaction).toHaveBeenCalledTimes(1);
      expect(invitationRepository.unscoped).toHaveBeenCalledWith("invitation-by-verified-email");
      expect(invitationRepository.unscoped).not.toHaveBeenCalledWith("invitation-by-token");
      expect(unscopedRepositories.invitations.findOneBy).toHaveBeenCalledWith(where);
      expect(organizationRepository.findOneByAndLock).toHaveBeenCalledWith({ id: invitation.organizationId, deletedAt: null }, { strength: "no key update" });
      expect(unscopedRepositories.invitations.findOneByAndLock).toHaveBeenCalledWith(where, { strength: "no key update" });
      expect(unscopedRepositories.invitations.updateById).toHaveBeenCalledWith(invitation.id, {
        status: "declined",
        declinedAt: new Date("2026-10-29T12:00:00.000Z")
      });
      expect(organizationActivityService.recordInvitationAnswer).toHaveBeenCalledWith(
        { organizationId: invitation.organizationId, type: "invitation_declined", actorUserId: null, payload: { email: "jane@example.com" } },
        "invitation-by-verified-email"
      );
      expect(unscopedRepositories.members.createUnlessExists).not.toHaveBeenCalled();
    });

    it("changes nothing for an invitation already declined", async () => {
      const invitation = createOrganizationInvitation({ status: "declined", declinedAt: new Date() });
      const { service, unscopedRepositories, organizationActivityService } = setup({ invitation });

      await expect(service.declineReceivedInvitation(invitation.id)).resolves.toBeUndefined();
      expect(unscopedRepositories.invitations.updateById).not.toHaveBeenCalled();
      expect(organizationActivityService.recordInvitationAnswer).not.toHaveBeenCalled();
    });

    it.each([
      {
        case: "an accepted invitation",
        invitation: { status: "accepted" as const, acceptedAt: new Date() },
        error: { status: 409, errorCode: INVITATION_ALREADY_ACCEPTED_ERROR_CODE }
      },
      {
        case: "a revoked invitation",
        invitation: { status: "revoked" as const, revokedAt: new Date() },
        error: { status: 410, errorCode: INVITATION_REVOKED_ERROR_CODE }
      },
      { case: "an expired invitation", invitation: { expiresAt: addDays(new Date(), -1) }, error: { status: 410, errorCode: INVITATION_EXPIRED_ERROR_CODE } }
    ])("refuses $case and writes nothing", async ({ invitation: overrides, error }) => {
      const invitation = createOrganizationInvitation(overrides);
      const { service, unscopedRepositories, organizationActivityService } = setup({ invitation });

      await expect(service.declineReceivedInvitation(invitation.id)).rejects.toMatchObject(error);
      expect(unscopedRepositories.invitations.updateById).not.toHaveBeenCalled();
      expect(organizationActivityService.recordInvitationAnswer).not.toHaveBeenCalled();
    });

    it.each([
      { case: "Auth0 verified no email for the caller", invitee: {}, verifiedEmail: null },
      { case: "Auth0 does not know the caller", invitee: { userId: null }, verifiedEmail: "jane@example.com" }
    ])("answers not found without looking anything up when $case", async ({ invitee, verifiedEmail }) => {
      const invitation = createOrganizationInvitation();
      const { service, txService, unscopedRepositories } = setup({ invitation, invitee, verifiedEmail });

      await expect(service.declineReceivedInvitation(invitation.id)).rejects.toMatchObject({ status: 404, message: "Invitation not found" });
      expect(txService.transaction).not.toHaveBeenCalled();
      expect(unscopedRepositories.invitations.findOneBy).not.toHaveBeenCalled();
    });

    it("answers not found for an invitation not sent to the caller", async () => {
      const { service, unscopedRepositories } = setup({ invitation: undefined });

      await expect(service.declineReceivedInvitation(faker.string.uuid())).rejects.toMatchObject({ status: 404, message: "Invitation not found" });
      expect(unscopedRepositories.invitations.updateById).not.toHaveBeenCalled();
    });
  });

  describe(invitationStatusOf.name, () => {
    it("keeps a pending invitation pending up to the instant it expires", () => {
      const now = new Date("2026-10-10T12:00:00.000Z");
      vi.useFakeTimers({ now });

      expect(invitationStatusOf({ status: "pending", expiresAt: now })).toBe("pending");
      expect(invitationStatusOf({ status: "pending", expiresAt: addMilliseconds(now, -1) })).toBe("expired");
    });

    it.each(["accepted", "revoked", "declined"] as const)("keeps an %s invitation %s after its expiry", status => {
      expect(invitationStatusOf({ status, expiresAt: addDays(new Date(), -1) })).toBe(status);
    });
  });

  function createPreview(overrides: Partial<OrganizationInvitationPreview> = {}): OrganizationInvitationPreview {
    return {
      organizationId: faker.string.uuid(),
      organizationName: faker.company.name(),
      inviterName: faker.internet.userName(),
      role: "member",
      email: faker.internet.email().toLowerCase(),
      status: "pending",
      expiresAt: addDays(new Date(), 7),
      ...overrides
    };
  }

  function createReceivedInvitation(overrides: Partial<ReceivedInvitation> = {}): ReceivedInvitation {
    return {
      id: faker.string.uuid(),
      organizationId: faker.string.uuid(),
      organizationName: faker.company.name(),
      inviterName: faker.internet.userName(),
      role: "member",
      createdAt: faker.date.recent(),
      expiresAt: addDays(new Date(), 7),
      ...overrides
    };
  }

  function createMembership({ organizationId, role = "member" }: { organizationId?: string; role?: Membership["role"] } = {}): Membership {
    return { role, organization: createOrganization({ id: organizationId }) };
  }

  function setup(input: {
    preview?: OrganizationInvitationPreview;
    receivedInvitations?: ReceivedInvitation[];
    verifiedEmail?: string | null;
    invitation?: OrganizationInvitationOutput;
    membership?: Membership | null;
    invitee?: Partial<UserOutput>;
    isAlreadyMember?: boolean;
    liveProjectIds?: string[];
    context?: OrganizationContext | null;
    organization?: OrganizationOutput | null;
    lockedInvitation?: OrganizationInvitationOutput | null;
    inviter?: Partial<OrganizationMemberOutput> | null;
  }) {
    const invitee = createUser({ email: input.invitation?.email ?? faker.internet.email(), emailVerified: true, ...input.invitee });
    const unscopedRepositories = {
      invitations: mock<OrganizationInvitationRepository>({
        findPreviewByTokenHash: vi.fn().mockResolvedValue(input.preview),
        findPendingSentTo: vi.fn().mockResolvedValue(input.receivedInvitations ?? []),
        findOneBy: vi.fn().mockResolvedValue(input.invitation),
        findOneByAndLock: vi.fn().mockResolvedValue(input.lockedInvitation === undefined ? input.invitation : input.lockedInvitation ?? undefined)
      }),
      members: mock<OrganizationMemberRepository>({
        createUnlessExists: vi.fn().mockResolvedValue(input.isAlreadyMember ? undefined : { id: faker.string.uuid() }),
        findOneByAndLock: vi.fn().mockResolvedValue(input.inviter === null ? undefined : createOrganizationMember({ role: "owner", ...input.inviter }))
      }),
      projects: mock<ProjectRepository>({ findActiveIdsAmong: vi.fn().mockResolvedValue(input.liveProjectIds ?? []) }),
      projectMembers: mock<ProjectMemberRepository>()
    };
    const invitationRepository = mock<OrganizationInvitationRepository>();
    const membership = input.membership === undefined ? createMembership({ organizationId: input.invitation?.organizationId }) : input.membership;
    const organizationMemberRepository = mock<OrganizationMemberRepository>({
      findActiveMembership: vi.fn().mockResolvedValue(membership ?? undefined)
    });
    const projectRepository = mock<ProjectRepository>();
    const projectMemberRepository = mock<ProjectMemberRepository>();
    for (const reason of ["invitation-by-token", "invitation-by-verified-email"] as const) {
      invitationRepository.unscoped.calledWith(reason).mockReturnValue(unscopedRepositories.invitations);
      organizationMemberRepository.unscoped.calledWith(reason).mockReturnValue(unscopedRepositories.members);
      projectRepository.unscoped.calledWith(reason).mockReturnValue(unscopedRepositories.projects);
      projectMemberRepository.unscoped.calledWith(reason).mockReturnValue(unscopedRepositories.projectMembers);
    }
    const organizationRepository = mock<OrganizationRepository>({
      findOneByAndLock: vi.fn().mockResolvedValue(input.organization === undefined ? createOrganization() : input.organization ?? undefined)
    });
    const userRepository = mock<UserRepository>();
    const authService = mock<AuthService>({ currentUser: invitee });
    const executionContextService = mock<ExecutionContextService>();
    executionContextService.get
      .calledWith("ORGANIZATION_CONTEXT")
      .mockReturnValue(input.context === undefined ? createOrganizationContext() : input.context ?? undefined);
    const txService = mock<TxService>({ transaction: vi.fn(cb => cb()) });
    const organizationActivityService = mock<OrganizationActivityService>();
    const verifiedEmail = input.verifiedEmail === undefined ? input.invitation?.email ?? faker.internet.email().toLowerCase() : input.verifiedEmail;
    const verifiedEmailService = mock<VerifiedEmailService>({
      getVerifiedEmail: vi.fn().mockResolvedValue(verifiedEmail),
      getRecentVerifiedEmail: vi.fn().mockResolvedValue(verifiedEmail)
    });
    const service = new InvitationAcceptanceService(
      invitationRepository,
      organizationRepository,
      organizationMemberRepository,
      projectRepository,
      projectMemberRepository,
      userRepository,
      authService,
      executionContextService,
      txService,
      organizationActivityService,
      verifiedEmailService
    );

    return {
      service,
      invitee,
      txService,
      invitationRepository,
      organizationRepository,
      organizationMemberRepository,
      projectRepository,
      projectMemberRepository,
      userRepository,
      unscopedRepositories,
      organizationActivityService,
      verifiedEmailService
    };
  }
});
