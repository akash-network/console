import { createMongoAbility } from "@casl/ability";
import { faker } from "@faker-js/faker";
import { addDays } from "date-fns";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AuthService } from "@src/auth/services/auth.service";
import type { JobQueueService } from "@src/core";
import type { TxService } from "@src/core/services";
import type { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import type { DeploymentConfigService } from "@src/deployment/services/deployment-config/deployment-config.service";
import { hashInvitationToken } from "@src/organization/lib/invitation-token/invitation-token";
import type { OrganizationRole } from "@src/organization/model-schemas/organization-member/organization-member.schema";
import type { OrganizationRepository } from "@src/organization/repositories/organization/organization.repository";
import type {
  OrganizationInvitationOutput,
  OrganizationInvitationRepository,
  OrganizationInvitationWithInviter
} from "@src/organization/repositories/organization-invitation/organization-invitation.repository";
import type { OrganizationMemberRepository } from "@src/organization/repositories/organization-member/organization-member.repository";
import type { ProjectRepository } from "@src/organization/repositories/project/project.repository";
import type { InvitationEmailLimiter } from "@src/organization/services/invitation-email-limiter/invitation-email-limiter.service";
import { OrganizationInvitationEmailJob } from "@src/organization/services/organization-invitation-email/organization-invitation-email.handler";
import { OWNER_ROLE_RESTRICTED_ERROR_CODE, PERSONAL_ORGANIZATION_ERROR_CODE } from "@src/organization/services/organization-member/organization-member.service";
import type { OrganizationContext } from "@src/organization/types/organization-context";
import {
  ALREADY_MEMBER_ERROR_CODE,
  INVITATION_LIMIT_REACHED_ERROR_CODE,
  MAX_PENDING_INVITATIONS_PER_ORGANIZATION,
  OrganizationInvitationService
} from "./organization-invitation.service";

import { mockConfigService } from "@test/mocks/config-service.mock";
import { createOrganizationInvitation, createOrganizationInvitationWithInviter } from "@test/seeders/organization.seeder";
import { createOrganizationContext } from "@test/seeders/organization-context.seeder";
import { createUser } from "@test/seeders/user.seeder";

const DEPLOY_WEB_BASE_URL = "https://console.example.com";

describe(OrganizationInvitationService.name, () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  describe("listInvitations", () => {
    it("lists the pending invitations of the active organization the caller may read", async () => {
      const invitations = [createOrganizationInvitationWithInviter(), createOrganizationInvitationWithInviter({ invitedBy: null })];
      const { service, context, ability, invitationRepository, repositories } = setup({});
      repositories.read.findPendingWithInviters.mockResolvedValue(invitations);

      await expect(service.listInvitations()).resolves.toEqual(invitations);
      expect(invitationRepository.accessibleBy).toHaveBeenCalledWith(ability, "read");
      expect(repositories.read.findPendingWithInviters).toHaveBeenCalledWith(context.organizationId);
    });

    it("refuses a request without an active organization", async () => {
      const { service } = setup({ context: null });

      await expect(service.listInvitations()).rejects.toMatchObject({ status: 403, message: "No active organization" });
    });
  });

  describe("createInvitations", () => {
    it("invites every new address once, normalized, and emails each new invitation", async () => {
      vi.useFakeTimers({ now: new Date("2026-10-09T12:00:00Z") });
      const { service, context, caller, ability, invitationRepository, repositories, jobQueueService } = setup({});
      const created = [createOrganizationInvitation({ email: "jane@example.com" }), createOrganizationInvitation({ email: "joe@example.com" })];
      repositories.create.createUnlessPending.mockResolvedValue(created);

      await service.createInvitations({ emails: [" Jane@Example.com ", "joe@example.com", "JANE@example.com"], role: "member" });

      expect(invitationRepository.accessibleBy).toHaveBeenCalledWith(ability, "create");
      expect(repositories.create.createUnlessPending).toHaveBeenCalledWith(
        ["jane@example.com", "joe@example.com"].map(email => ({
          organizationId: context.organizationId,
          email,
          role: "member",
          projectGrants: [],
          tokenHash: expect.stringMatching(/^[0-9a-f]{64}$/),
          expiresAt: new Date("2026-10-16T12:00:00Z"),
          invitedByUserId: caller.id
        }))
      );
      expect(jobQueueService.enqueue.mock.calls).toEqual(
        created.map(invitation => [new OrganizationInvitationEmailJob({ invitationId: invitation.id, tokenHash: invitation.tokenHash })])
      );
    });

    it("gives every new invitation a token of its own", async () => {
      const { service, repositories } = setup({});

      await service.createInvitations({ emails: ["jane@example.com", "joe@example.com"], role: "member" });

      const [[inputs]] = repositories.create.createUnlessPending.mock.calls;
      expect(new Set(inputs.map(input => input.tokenHash)).size).toBe(2);
    });

    it("locks the organization before reading its pending invitations", async () => {
      const { service, context, invitationRepository, organizationRepository } = setup({});

      await service.createInvitations({ emails: ["jane@example.com"], role: "member" });

      expect(organizationRepository.findOneByAndLock).toHaveBeenCalledWith({ id: context.organizationId });
      expect(organizationRepository.findOneByAndLock.mock.invocationCallOrder[0]).toBeLessThan(
        invitationRepository.findPendingWithInviters.mock.invocationCallOrder[0]
      );
    });

    it("renews and emails again an address's expired invitation, keeping its role", async () => {
      vi.useFakeTimers({ now: new Date("2026-10-09T12:00:00Z") });
      const expired = createOrganizationInvitationWithInviter({ email: "jane@example.com", role: "viewer", expiresAt: new Date("2026-10-01T00:00:00Z") });
      const renewed = createOrganizationInvitation({ id: expired.id, email: "jane@example.com" });
      const { service, context, caller, repositories, invitationRepository, emailLimiter, jobQueueService } = setup({ updated: renewed });
      invitationRepository.findPendingWithInviters.mockResolvedValue([expired]);

      await service.createInvitations({ emails: ["jane@example.com", "joe@example.com"], role: "admin" });

      expect(repositories.update.updateBy).toHaveBeenCalledWith(
        { id: expired.id, status: "pending" },
        { tokenHash: expect.stringMatching(/^[0-9a-f]{64}$/), expiresAt: new Date("2026-10-16T12:00:00Z") },
        { returning: true }
      );
      expect(emailLimiter.assertWithinLimits).toHaveBeenCalledWith({
        organizationId: context.organizationId,
        senderId: caller.id,
        emails: ["joe@example.com", "jane@example.com"]
      });
      expect(invitationRepository.countPending).toHaveBeenCalledTimes(1);
      expect(emailLimiter.recordSends).toHaveBeenCalledWith([renewed], caller.id);
      expect(jobQueueService.enqueue).toHaveBeenCalledWith(new OrganizationInvitationEmailJob({ invitationId: renewed.id, tokenHash: renewed.tokenHash }));
    });

    it("refuses to let an admin renew an expired invitation to become an owner", async () => {
      const { service, repositories, invitationRepository } = setup({ context: createOrganizationContext({ role: "admin" }) });
      invitationRepository.findPendingWithInviters.mockResolvedValue([
        createOrganizationInvitationWithInviter({ email: "jane@example.com", role: "owner", expiresAt: new Date(Date.now() - 1000) })
      ]);

      await expect(service.createInvitations({ emails: ["jane@example.com"], role: "member" })).rejects.toMatchObject({
        status: 403,
        errorCode: OWNER_ROLE_RESTRICTED_ERROR_CODE
      });
      expect(repositories.update.updateBy).not.toHaveBeenCalled();
    });

    it("returns the invitations in the order the addresses were given, keeping an address's pending invitation", async () => {
      const { service, context, repositories, invitationRepository, jobQueueService } = setup({});
      const pending = createOrganizationInvitationWithInviter({ email: "jane@example.com" });
      const created = createOrganizationInvitationWithInviter({ email: "joe@example.com" });
      invitationRepository.findPendingWithInviters.mockResolvedValue([pending]);
      repositories.read.findPendingWithInviters.mockResolvedValue([created, pending]);

      const invitations = await service.createInvitations({ emails: ["jane@example.com", "joe@example.com"], role: "admin" });

      expect(invitations).toEqual([pending, created]);
      expect(invitationRepository.findPendingWithInviters).toHaveBeenCalledWith(context.organizationId, { emails: ["jane@example.com", "joe@example.com"] });
      expect(repositories.read.findPendingWithInviters).toHaveBeenCalledWith(context.organizationId, { emails: ["jane@example.com", "joe@example.com"] });
      expect(repositories.create.createUnlessPending).toHaveBeenCalledWith([expect.objectContaining({ email: "joe@example.com" })]);
      expect(repositories.update.updateBy).not.toHaveBeenCalled();
      expect(jobQueueService.enqueue).not.toHaveBeenCalled();
    });

    it("writes the invitations and their emails in one transaction", async () => {
      const { service, txService, repositories, jobQueueService } = setup({});
      repositories.create.createUnlessPending.mockResolvedValue([createOrganizationInvitation()]);
      txService.transaction.mockImplementation(async () => undefined);

      await service.createInvitations({ emails: ["jane@example.com"], role: "member" });

      expect(repositories.create.createUnlessPending).not.toHaveBeenCalled();
      expect(jobQueueService.enqueue).not.toHaveBeenCalled();
    });

    it("lets an owner invite someone as an owner", async () => {
      const { service, repositories } = setup({ context: createOrganizationContext({ role: "owner" }) });

      await service.createInvitations({ emails: ["jane@example.com"], role: "owner" });

      expect(repositories.create.createUnlessPending).toHaveBeenCalledWith([expect.objectContaining({ role: "owner" })]);
    });

    it.each<OrganizationRole>(["admin", "member", "billing", "viewer"])("refuses to let a caller with role %s invite someone as an owner", async role => {
      const { service, repositories } = setup({ context: createOrganizationContext({ role }) });

      await expect(service.createInvitations({ emails: ["jane@example.com"], role: "owner" })).rejects.toMatchObject({
        status: 403,
        errorCode: OWNER_ROLE_RESTRICTED_ERROR_CODE
      });
      expect(repositories.create.createUnlessPending).not.toHaveBeenCalled();
    });

    it("lets an admin invite someone as an admin", async () => {
      const { service, repositories } = setup({ context: createOrganizationContext({ role: "admin" }) });

      await service.createInvitations({ emails: ["jane@example.com"], role: "admin" });

      expect(repositories.create.createUnlessPending).toHaveBeenCalledWith([expect.objectContaining({ role: "admin" })]);
    });

    it("refuses to invite into a personal organization", async () => {
      const { service, repositories } = setup({ context: createOrganizationContext({ organizationType: "personal" }) });

      await expect(service.createInvitations({ emails: ["jane@example.com"], role: "member" })).rejects.toMatchObject({
        status: 403,
        errorCode: PERSONAL_ORGANIZATION_ERROR_CODE,
        message: "A personal organization cannot invite members"
      });
      expect(repositories.create.createUnlessPending).not.toHaveBeenCalled();
    });

    it("refuses an address that belongs to a member of the organization", async () => {
      const { service, context, repositories, organizationMemberRepository } = setup({});
      organizationMemberRepository.findEmailsOfMembers.mockResolvedValue(["jane@example.com"]);

      await expect(service.createInvitations({ emails: ["Jane@example.com", "joe@example.com"], role: "member" })).rejects.toMatchObject({
        status: 409,
        errorCode: ALREADY_MEMBER_ERROR_CODE,
        message: "An address belongs to a member of the organization"
      });
      expect(organizationMemberRepository.findEmailsOfMembers).toHaveBeenCalledWith(context.organizationId, ["jane@example.com", "joe@example.com"]);
      expect(repositories.create.createUnlessPending).not.toHaveBeenCalled();
    });

    it("grants the invitations projects of the active organization", async () => {
      const { service, context, repositories, projectRepository } = setup({});
      const projectGrants = [
        { projectId: faker.string.uuid(), role: "member" as const },
        { projectId: faker.string.uuid(), role: "viewer" as const }
      ];
      projectRepository.findActiveIdsAmong.mockResolvedValue(projectGrants.map(grant => grant.projectId));

      await service.createInvitations({ emails: ["jane@example.com"], role: "member", projectGrants });

      expect(projectRepository.findActiveIdsAmong).toHaveBeenCalledWith(
        context.organizationId,
        projectGrants.map(grant => grant.projectId)
      );
      expect(repositories.create.createUnlessPending).toHaveBeenCalledWith([expect.objectContaining({ projectGrants })]);
    });

    it("refuses a project grant outside the active organization", async () => {
      const { service, repositories, projectRepository } = setup({});
      const projectGrants = [
        { projectId: faker.string.uuid(), role: "member" as const },
        { projectId: faker.string.uuid(), role: "member" as const }
      ];
      projectRepository.findActiveIdsAmong.mockResolvedValue([projectGrants[0].projectId]);

      await expect(service.createInvitations({ emails: ["jane@example.com"], role: "member", projectGrants })).rejects.toMatchObject({
        status: 400,
        message: "Project grants must name projects of the active organization"
      });
      expect(repositories.create.createUnlessPending).not.toHaveBeenCalled();
    });

    it("skips the project lookup without project grants", async () => {
      const { service, projectRepository } = setup({});

      await service.createInvitations({ emails: ["jane@example.com"], role: "member" });

      expect(projectRepository.findActiveIdsAmong).not.toHaveBeenCalled();
    });

    it("invites up to the pending invitation limit of the organization", async () => {
      const { service, context, repositories, invitationRepository } = setup({});
      invitationRepository.countPending.mockResolvedValue(MAX_PENDING_INVITATIONS_PER_ORGANIZATION - 2);

      await service.createInvitations({ emails: ["jane@example.com", "joe@example.com"], role: "member" });

      expect(invitationRepository.countPending).toHaveBeenCalledWith(context.organizationId);
      expect(repositories.create.createUnlessPending).toHaveBeenCalled();
    });

    it("refuses invitations beyond the pending invitation limit of the organization", async () => {
      const { service, repositories, invitationRepository } = setup({});
      invitationRepository.countPending.mockResolvedValue(MAX_PENDING_INVITATIONS_PER_ORGANIZATION - 1);

      await expect(service.createInvitations({ emails: ["jane@example.com", "joe@example.com"], role: "member" })).rejects.toMatchObject({
        status: 403,
        errorCode: INVITATION_LIMIT_REACHED_ERROR_CODE
      });
      expect(repositories.create.createUnlessPending).not.toHaveBeenCalled();
    });

    it("returns the pending invitations of a full organization without counting them again", async () => {
      const { service, invitationRepository } = setup({});
      invitationRepository.findPendingWithInviters.mockResolvedValue([createOrganizationInvitationWithInviter({ email: "jane@example.com" })]);
      invitationRepository.countPending.mockResolvedValue(MAX_PENDING_INVITATIONS_PER_ORGANIZATION);

      await expect(service.createInvitations({ emails: ["jane@example.com"], role: "member" })).resolves.toBeDefined();
      expect(invitationRepository.countPending).not.toHaveBeenCalled();
    });

    it("counts the new invitations against the email limits and records them as sent", async () => {
      const { service, context, caller, repositories, invitationRepository, emailLimiter } = setup({});
      const created = createOrganizationInvitation({ email: "joe@example.com" });
      invitationRepository.findPendingWithInviters.mockResolvedValue([createOrganizationInvitationWithInviter({ email: "jane@example.com" })]);
      repositories.create.createUnlessPending.mockResolvedValue([created]);

      await service.createInvitations({ emails: ["jane@example.com", "joe@example.com"], role: "member" });

      expect(emailLimiter.assertWithinLimits).toHaveBeenCalledWith({
        organizationId: context.organizationId,
        senderId: caller.id,
        emails: ["joe@example.com"]
      });
      expect(emailLimiter.recordSends).toHaveBeenCalledWith([created], caller.id);
    });

    it("invites nobody once the email limits are reached", async () => {
      const { service, repositories, emailLimiter, jobQueueService } = setup({});
      emailLimiter.assertWithinLimits.mockRejectedValue(new Error("limit reached"));

      await expect(service.createInvitations({ emails: ["jane@example.com"], role: "member" })).rejects.toThrow("limit reached");
      expect(repositories.create.createUnlessPending).not.toHaveBeenCalled();
      expect(jobQueueService.enqueue).not.toHaveBeenCalled();
    });
  });

  describe("resendInvitation", () => {
    it("counts the resent email against the email limits and records it as sent", async () => {
      const invitation = createOrganizationInvitation({ email: "jane@example.com" });
      const renewed = createOrganizationInvitation({ id: invitation.id, email: "jane@example.com" });
      const { service, context, caller, repositories, emailLimiter } = setup({ invitation, updated: renewed });
      repositories.read.findPendingWithInviters.mockResolvedValue([createOrganizationInvitationWithInviter({ id: invitation.id })]);

      await service.resendInvitation(invitation.id);

      expect(emailLimiter.assertWithinLimits).toHaveBeenCalledWith({
        organizationId: context.organizationId,
        senderId: caller.id,
        emails: ["jane@example.com"]
      });
      expect(emailLimiter.recordSends).toHaveBeenCalledWith([renewed], caller.id);
    });

    it("leaves the invitation alone once the email limits are reached", async () => {
      const { service, repositories, emailLimiter, jobQueueService } = setup({ invitation: createOrganizationInvitation() });
      emailLimiter.assertWithinLimits.mockRejectedValue(new Error("limit reached"));

      await expect(service.resendInvitation(faker.string.uuid())).rejects.toThrow("limit reached");
      expect(repositories.update.updateBy).not.toHaveBeenCalled();
      expect(jobQueueService.enqueue).not.toHaveBeenCalled();
    });

    it("renews the token and the expiry of the invitation and emails it again", async () => {
      vi.useFakeTimers({ now: new Date("2026-10-09T12:00:00Z") });
      const invitation = createOrganizationInvitation();
      const renewed = createOrganizationInvitation({ id: invitation.id });
      const listed = createOrganizationInvitationWithInviter({ id: invitation.id });
      const { service, context, ability, invitationRepository, repositories, jobQueueService } = setup({ invitation, updated: renewed });
      repositories.read.findPendingWithInviters.mockResolvedValue([listed]);

      await expect(service.resendInvitation(invitation.id)).resolves.toEqual(listed);

      expect(repositories.read.findOneBy).toHaveBeenCalledWith({ id: invitation.id, organizationId: context.organizationId, status: "pending" });
      expect(invitationRepository.accessibleBy).toHaveBeenCalledWith(ability, "update");
      expect(repositories.update.updateBy).toHaveBeenCalledWith(
        { id: invitation.id, status: "pending" },
        { tokenHash: expect.stringMatching(/^[0-9a-f]{64}$/), expiresAt: addDays(new Date("2026-10-09T12:00:00Z"), 7) },
        { returning: true }
      );
      expect(repositories.update.updateBy.mock.calls[0][1].tokenHash).not.toBe(invitation.tokenHash);
      expect(jobQueueService.enqueue).toHaveBeenCalledWith(new OrganizationInvitationEmailJob({ invitationId: invitation.id, tokenHash: renewed.tokenHash }));
      expect(repositories.read.findPendingWithInviters).toHaveBeenCalledWith(context.organizationId, { ids: [invitation.id] });
    });

    it("answers not found when the invitation stopped being pending before it was renewed", async () => {
      const { service, jobQueueService } = setup({ invitation: createOrganizationInvitation() });

      await expect(service.resendInvitation(faker.string.uuid())).rejects.toMatchObject({ status: 404 });
      expect(jobQueueService.enqueue).not.toHaveBeenCalled();
    });

    it("answers not found when the renewed invitation can no longer be read", async () => {
      const invitation = createOrganizationInvitation();
      const { service } = setup({ invitation, updated: invitation });

      await expect(service.resendInvitation(invitation.id)).rejects.toMatchObject({ status: 404, message: "Organization invitation not found" });
    });

    it("answers not found for an invitation that is not pending in the active organization", async () => {
      const { service, repositories } = setup({ invitation: undefined });

      await expect(service.resendInvitation(faker.string.uuid())).rejects.toMatchObject({ status: 404, message: "Organization invitation not found" });
      expect(repositories.update.updateBy).not.toHaveBeenCalled();
    });

    it("refuses to let an admin resend an invitation to become an owner", async () => {
      const { service, repositories } = setup({
        invitation: createOrganizationInvitation({ role: "owner" }),
        context: createOrganizationContext({ role: "admin" })
      });

      await expect(service.resendInvitation(faker.string.uuid())).rejects.toMatchObject({ status: 403, errorCode: OWNER_ROLE_RESTRICTED_ERROR_CODE });
      expect(repositories.update.updateBy).not.toHaveBeenCalled();
    });

    it("refuses a personal organization", async () => {
      const { service } = setup({ context: createOrganizationContext({ organizationType: "personal" }) });

      await expect(service.resendInvitation(faker.string.uuid())).rejects.toMatchObject({ status: 403, errorCode: PERSONAL_ORGANIZATION_ERROR_CODE });
    });
  });

  describe("createInvitationLink", () => {
    it("issues a new token and links to it while storing only its hash", async () => {
      const invitation = createOrganizationInvitation();
      const { service, ability, invitationRepository, repositories, jobQueueService } = setup({ invitation, updated: invitation });

      const url = await service.createInvitationLink(invitation.id);

      const token = url.replace(`${DEPLOY_WEB_BASE_URL}/invitations#token=`, "");
      expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(invitationRepository.accessibleBy).toHaveBeenCalledWith(ability, "update");
      expect(repositories.update.updateBy).toHaveBeenCalledWith(
        { id: invitation.id, status: "pending" },
        { tokenHash: hashInvitationToken(token) },
        { returning: true }
      );
      expect(jobQueueService.enqueue).not.toHaveBeenCalled();
    });

    it("gives an expired invitation a new expiry along with the new token", async () => {
      vi.useFakeTimers({ now: new Date("2026-10-09T12:00:00Z") });
      const invitation = createOrganizationInvitation({ expiresAt: new Date("2026-10-01T00:00:00Z") });
      const { service, repositories } = setup({ invitation, updated: invitation });

      await service.createInvitationLink(invitation.id);

      expect(repositories.update.updateBy).toHaveBeenCalledWith(
        { id: invitation.id, status: "pending" },
        { tokenHash: expect.stringMatching(/^[0-9a-f]{64}$/), expiresAt: new Date("2026-10-16T12:00:00Z") },
        { returning: true }
      );
    });

    it("answers not found when the invitation stopped being pending before the token was replaced", async () => {
      const { service } = setup({ invitation: createOrganizationInvitation() });

      await expect(service.createInvitationLink(faker.string.uuid())).rejects.toMatchObject({ status: 404, message: "Organization invitation not found" });
    });

    it("refuses to let an admin link to an invitation to become an owner", async () => {
      const { service, repositories } = setup({
        invitation: createOrganizationInvitation({ role: "owner" }),
        context: createOrganizationContext({ role: "admin" })
      });

      await expect(service.createInvitationLink(faker.string.uuid())).rejects.toMatchObject({ status: 403, errorCode: OWNER_ROLE_RESTRICTED_ERROR_CODE });
      expect(repositories.update.updateBy).not.toHaveBeenCalled();
    });
  });

  describe("revokeInvitation", () => {
    it("marks the invitation revoked", async () => {
      vi.useFakeTimers({ now: new Date("2026-10-09T12:00:00Z") });
      const invitation = createOrganizationInvitation();
      const { service, ability, invitationRepository, repositories } = setup({ invitation });

      await service.revokeInvitation(invitation.id);

      expect(invitationRepository.accessibleBy).toHaveBeenCalledWith(ability, "delete");
      expect(repositories.delete.updateBy).toHaveBeenCalledWith(
        { id: invitation.id, status: "pending" },
        { status: "revoked", revokedAt: new Date("2026-10-09T12:00:00Z") }
      );
    });

    it("answers not found for an invitation that is not pending in the active organization", async () => {
      const { service, repositories } = setup({ invitation: undefined });

      await expect(service.revokeInvitation(faker.string.uuid())).rejects.toMatchObject({ status: 404 });
      expect(repositories.delete.updateBy).not.toHaveBeenCalled();
    });

    it("lets an owner revoke an invitation to become an owner", async () => {
      const { service, repositories } = setup({
        invitation: createOrganizationInvitation({ role: "owner" }),
        context: createOrganizationContext({ role: "owner" })
      });

      await service.revokeInvitation(faker.string.uuid());

      expect(repositories.delete.updateBy).toHaveBeenCalled();
    });

    it("refuses to let an admin revoke an invitation to become an owner", async () => {
      const { service, repositories } = setup({
        invitation: createOrganizationInvitation({ role: "owner" }),
        context: createOrganizationContext({ role: "admin" })
      });

      await expect(service.revokeInvitation(faker.string.uuid())).rejects.toMatchObject({ status: 403, errorCode: OWNER_ROLE_RESTRICTED_ERROR_CODE });
      expect(repositories.delete.updateBy).not.toHaveBeenCalled();
    });
  });

  function setup(input: { context?: OrganizationContext | null; invitation?: OrganizationInvitationOutput; updated?: OrganizationInvitationOutput }) {
    const caller = createUser();
    const context = input.context === undefined ? createOrganizationContext() : input.context;
    const ability = createMongoAbility();
    const repositories = {
      read: mock<OrganizationInvitationRepository>({
        findOneBy: vi.fn().mockResolvedValue(input.invitation),
        findPendingWithInviters: vi.fn<() => Promise<OrganizationInvitationWithInviter[]>>().mockResolvedValue([])
      }),
      create: mock<OrganizationInvitationRepository>({ createUnlessPending: vi.fn().mockResolvedValue([]) }),
      update: mock<OrganizationInvitationRepository>({ updateBy: vi.fn().mockResolvedValue(input.updated) }),
      delete: mock<OrganizationInvitationRepository>()
    };
    const invitationRepository = mock<OrganizationInvitationRepository>({
      findPendingWithInviters: vi.fn().mockResolvedValue([]),
      countPending: vi.fn().mockResolvedValue(0)
    });
    invitationRepository.accessibleBy.mockImplementation((_, action) => repositories[action as keyof typeof repositories]);
    const organizationMemberRepository = mock<OrganizationMemberRepository>({ findEmailsOfMembers: vi.fn().mockResolvedValue([]) });
    const projectRepository = mock<ProjectRepository>();
    const authService = mock<AuthService>({ currentUser: caller });
    authService.ability = ability;
    const executionContextService = mock<ExecutionContextService>();
    executionContextService.get.calledWith("ORGANIZATION_CONTEXT").mockReturnValue(context ?? undefined);
    const txService = mock<TxService>({ transaction: vi.fn(cb => cb()) });
    const jobQueueService = mock<JobQueueService>();
    const deploymentConfig = mockConfigService<DeploymentConfigService>({ DEPLOY_WEB_BASE_URL });
    const emailLimiter = mock<InvitationEmailLimiter>();
    const organizationRepository = mock<OrganizationRepository>();
    const service = new OrganizationInvitationService(
      invitationRepository,
      organizationMemberRepository,
      projectRepository,
      authService,
      executionContextService,
      txService,
      jobQueueService,
      deploymentConfig,
      emailLimiter,
      organizationRepository
    );

    return {
      service,
      caller,
      ability,
      repositories,
      invitationRepository,
      organizationMemberRepository,
      projectRepository,
      txService,
      jobQueueService,
      emailLimiter,
      organizationRepository,
      context: context ?? createOrganizationContext()
    };
  }
});
