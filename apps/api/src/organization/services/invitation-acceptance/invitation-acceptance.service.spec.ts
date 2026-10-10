import { faker } from "@faker-js/faker";
import { addDays, addMilliseconds } from "date-fns";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AuthService } from "@src/auth/services/auth.service";
import type { TxService } from "@src/core/services";
import type { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import { createInvitationToken, hashInvitationToken } from "@src/organization/lib/invitation-token/invitation-token";
import type {
  OrganizationInvitationOutput,
  OrganizationInvitationPreview,
  OrganizationInvitationRepository
} from "@src/organization/repositories/organization-invitation/organization-invitation.repository";
import type { Membership, OrganizationMemberRepository } from "@src/organization/repositories/organization-member/organization-member.repository";
import type { ProjectRepository } from "@src/organization/repositories/project/project.repository";
import type { ProjectMemberRepository } from "@src/organization/repositories/project-member/project-member.repository";
import type { OrganizationContext } from "@src/organization/types/organization-context";
import type { UserOutput, UserRepository } from "@src/user/repositories";
import {
  INVITATION_ALREADY_ACCEPTED_ERROR_CODE,
  INVITATION_EMAIL_MISMATCH_ERROR_CODE,
  INVITATION_EXPIRED_ERROR_CODE,
  INVITATION_REVOKED_ERROR_CODE,
  InvitationAcceptanceService,
  invitationStatusOf
} from "./invitation-acceptance.service";

import { createOrganization, createOrganizationInvitation } from "@test/seeders/organization.seeder";
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
    it("adds the invitee with the invited role and the grants of live projects, then marks the invitation accepted", async () => {
      vi.useFakeTimers({ now: new Date("2026-10-10T12:00:00.000Z") });
      const token = createInvitationToken();
      const [grantedProjectId, deletedProjectId] = [faker.string.uuid(), faker.string.uuid()];
      const invitation = createOrganizationInvitation({
        role: "admin",
        projectGrants: [
          { projectId: grantedProjectId, role: "viewer" },
          { projectId: deletedProjectId, role: "member" }
        ]
      });
      const { service, invitee, txService, invitationRepository, unscopedRepositories, organizationMemberRepository, userRepository } = setup({
        invitation,
        liveProjectIds: [grantedProjectId]
      });

      await service.acceptInvitation({ token });

      expect(txService.transaction).toHaveBeenCalledTimes(1);
      expect(invitationRepository.unscoped).toHaveBeenCalledWith("invitation-by-token");
      expect(unscopedRepositories.invitations.findByTokenHashAndLock).toHaveBeenCalledWith(hashInvitationToken(token));
      expect(unscopedRepositories.members.createUnlessExists).toHaveBeenCalledWith({
        organizationId: invitation.organizationId,
        userId: invitee.id,
        role: "admin"
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

    it("grants no project when the invitation names none", async () => {
      const { service, unscopedRepositories } = setup({ invitation: createOrganizationInvitation({ projectGrants: [] }) });

      await service.acceptInvitation({ token: createInvitationToken() });

      expect(unscopedRepositories.projects.findActiveIdsAmong).not.toHaveBeenCalled();
      expect(unscopedRepositories.projectMembers.createManyUnlessExist).not.toHaveBeenCalled();
    });

    it("keeps the role and grants of an invitee who is already a member and consumes the invitation", async () => {
      const invitation = createOrganizationInvitation({ role: "owner", projectGrants: [{ projectId: faker.string.uuid(), role: "admin" }] });
      const membership = createMembership({ organizationId: invitation.organizationId, role: "viewer" });
      const { service, invitee, unscopedRepositories } = setup({ invitation, membership, isAlreadyMember: true });

      await expect(service.acceptInvitation({ token: createInvitationToken() })).resolves.toMatchObject({ role: "viewer" });
      expect(unscopedRepositories.projectMembers.createManyUnlessExist).not.toHaveBeenCalled();
      expect(unscopedRepositories.invitations.updateById).toHaveBeenCalledWith(invitation.id, expect.objectContaining({ acceptedByUserId: invitee.id }));
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
      { case: "another email", email: "joe@example.com" },
      { case: "no email", email: null }
    ])("refuses an invitee with $case until they confirm", async ({ email }) => {
      const { service, unscopedRepositories, userRepository } = setup({
        invitation: createOrganizationInvitation({ email: "jane@example.com" }),
        invitee: { email }
      });

      await expect(service.acceptInvitation({ token: createInvitationToken() })).rejects.toMatchObject({
        status: 409,
        errorCode: INVITATION_EMAIL_MISMATCH_ERROR_CODE,
        message: "The invitation was sent to another email address"
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
      const { service, invitee, unscopedRepositories, userRepository } = setup({ invitation: undefined });
      const invitation = createOrganizationInvitation({ status: "accepted", acceptedByUserId: invitee.id, email: "someone-else@example.com" });
      unscopedRepositories.invitations.findByTokenHashAndLock.mockResolvedValue(invitation);

      await expect(service.acceptInvitation({ token: createInvitationToken() })).resolves.toMatchObject({ isActive: false });
      expect(unscopedRepositories.members.createUnlessExists).not.toHaveBeenCalled();
      expect(unscopedRepositories.invitations.updateById).not.toHaveBeenCalled();
      expect(userRepository.updateById).toHaveBeenCalledWith(invitee.id, { lastUsedOrganizationId: invitation.organizationId });
    });

    it("refuses the invitee who accepted and was removed since", async () => {
      const { service, invitee, unscopedRepositories, userRepository } = setup({ invitation: undefined, membership: null });
      unscopedRepositories.invitations.findByTokenHashAndLock.mockResolvedValue(
        createOrganizationInvitation({ status: "accepted", acceptedByUserId: invitee.id })
      );

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
      const { service, organizationMemberRepository } = setup({ invitation: undefined });

      await expect(service.acceptInvitation({ token: createInvitationToken() })).rejects.toMatchObject({ status: 404, message: "Invitation not found" });
      expect(organizationMemberRepository.findActiveMembership).not.toHaveBeenCalled();
    });
  });

  describe(invitationStatusOf.name, () => {
    it("keeps a pending invitation pending up to the instant it expires", () => {
      const now = new Date("2026-10-10T12:00:00.000Z");
      vi.useFakeTimers({ now });

      expect(invitationStatusOf({ status: "pending", expiresAt: now })).toBe("pending");
      expect(invitationStatusOf({ status: "pending", expiresAt: addMilliseconds(now, -1) })).toBe("expired");
    });

    it.each(["accepted", "revoked"] as const)("keeps an %s invitation %s after its expiry", status => {
      expect(invitationStatusOf({ status, expiresAt: addDays(new Date(), -1) })).toBe(status);
    });
  });

  function createPreview(overrides: Partial<OrganizationInvitationPreview> = {}): OrganizationInvitationPreview {
    return {
      organizationName: faker.company.name(),
      inviterName: faker.internet.userName(),
      role: "member",
      email: faker.internet.email().toLowerCase(),
      status: "pending",
      expiresAt: addDays(new Date(), 7),
      ...overrides
    };
  }

  function createMembership({ organizationId, role = "member" }: { organizationId?: string; role?: Membership["role"] } = {}): Membership {
    return { role, organization: createOrganization({ id: organizationId }) };
  }

  function setup(input: {
    preview?: OrganizationInvitationPreview;
    invitation?: OrganizationInvitationOutput;
    membership?: Membership | null;
    invitee?: Partial<UserOutput>;
    isAlreadyMember?: boolean;
    liveProjectIds?: string[];
    context?: OrganizationContext | null;
  }) {
    const invitee = createUser({ email: input.invitation?.email ?? faker.internet.email(), ...input.invitee });
    const unscopedRepositories = {
      invitations: mock<OrganizationInvitationRepository>({
        findPreviewByTokenHash: vi.fn().mockResolvedValue(input.preview),
        findByTokenHashAndLock: vi.fn().mockResolvedValue(input.invitation)
      }),
      members: mock<OrganizationMemberRepository>({
        createUnlessExists: vi.fn().mockResolvedValue(input.isAlreadyMember ? undefined : { id: faker.string.uuid() })
      }),
      projects: mock<ProjectRepository>({ findActiveIdsAmong: vi.fn().mockResolvedValue(input.liveProjectIds ?? []) }),
      projectMembers: mock<ProjectMemberRepository>()
    };
    const invitationRepository = mock<OrganizationInvitationRepository>();
    invitationRepository.unscoped.calledWith("invitation-by-token").mockReturnValue(unscopedRepositories.invitations);
    const membership = input.membership === undefined ? createMembership({ organizationId: input.invitation?.organizationId }) : input.membership;
    const organizationMemberRepository = mock<OrganizationMemberRepository>({
      findActiveMembership: vi.fn().mockResolvedValue(membership ?? undefined)
    });
    organizationMemberRepository.unscoped.calledWith("invitation-by-token").mockReturnValue(unscopedRepositories.members);
    const projectRepository = mock<ProjectRepository>();
    projectRepository.unscoped.calledWith("invitation-by-token").mockReturnValue(unscopedRepositories.projects);
    const projectMemberRepository = mock<ProjectMemberRepository>();
    projectMemberRepository.unscoped.calledWith("invitation-by-token").mockReturnValue(unscopedRepositories.projectMembers);
    const userRepository = mock<UserRepository>();
    const authService = mock<AuthService>({ currentUser: invitee });
    const executionContextService = mock<ExecutionContextService>();
    executionContextService.get
      .calledWith("ORGANIZATION_CONTEXT")
      .mockReturnValue(input.context === undefined ? createOrganizationContext() : input.context ?? undefined);
    const txService = mock<TxService>({ transaction: vi.fn(cb => cb()) });
    const service = new InvitationAcceptanceService(
      invitationRepository,
      organizationMemberRepository,
      projectRepository,
      projectMemberRepository,
      userRepository,
      authService,
      executionContextService,
      txService
    );

    return { service, invitee, txService, invitationRepository, organizationMemberRepository, userRepository, unscopedRepositories };
  }
});
