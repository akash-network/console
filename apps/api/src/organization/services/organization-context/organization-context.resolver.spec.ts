import { faker } from "@faker-js/faker";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { CreateLogger } from "@src/core/providers/logging.provider";
import { ORGANIZATION_FORBIDDEN_ERROR_CODE } from "@src/core/repositories/org-scoped.repository";
import type { OrganizationRole, ProjectAccess } from "@src/organization/model-schemas/organization-member/organization-member.schema";
import type {
  MembershipWithProjectAccess,
  OrganizationMemberRepository
} from "@src/organization/repositories/organization-member/organization-member.repository";
import type { ProjectGrantOfUser, ProjectRepository } from "@src/organization/repositories/project/project.repository";
import type { PersonalOrganizationService } from "@src/organization/services/personal-organization/personal-organization.service";
import type { UserRepository } from "@src/user/repositories/user/user.repository";
import type { AccountStatusService } from "@src/user/services/account-status/account-status.service";
import { AccountStatusGuard } from "@src/user/services/account-status-guard/account-status-guard.service";
import {
  LAST_USED_ORGANIZATION_THROTTLE_MS,
  ORGANIZATION_MISMATCH_ERROR_CODE,
  type OrganizationContextRequest,
  OrganizationContextResolver,
  PROJECT_FORBIDDEN_ERROR_CODE
} from "./organization-context.resolver";

import { createOrganization, createProject } from "@test/seeders/organization.seeder";
import { createUser } from "@test/seeders/user.seeder";

describe(OrganizationContextResolver.name, () => {
  it("logs under its own name", () => {
    const { createLogger } = setup({});

    expect(createLogger).toHaveBeenCalledWith({ context: OrganizationContextResolver.name });
  });

  describe("with an API key", () => {
    it("resolves the organization the key is bound to", async () => {
      const { resolver, team, user } = setup({ teamRole: "admin" });

      const context = await resolver.resolve({ user, apiKey: { organizationId: team.organization.id, projectId: null } });

      expect(context).toEqual({
        organizationId: team.organization.id,
        organizationType: "team",
        role: "admin",
        projectScope: { kind: "all" }
      });
    });

    it("resolves the owner's personal organization for a key bound to none, whatever was used last", async () => {
      const { resolver, personal, team } = setup({});
      const user = createUser({ lastUsedOrganizationId: team.organization.id });

      const context = await resolver.resolve({ user, apiKey: { organizationId: null, projectId: null } });

      expect(context).toMatchObject({ organizationId: personal.organization.id, role: "owner" });
    });

    it("restores the default project of the personal organization the key is bound to", async () => {
      const { resolver, personal, user, personalOrganizationService } = setup({});

      await resolver.resolve({ user, apiKey: { organizationId: personal.organization.id, projectId: null } });

      expect(personalOrganizationService.restoreDefaultProject).toHaveBeenCalledWith(user, personal.organization);
    });

    it("leaves the projects of a team the key is bound to alone", async () => {
      const { resolver, team, user, personalOrganizationService } = setup({});

      await resolver.resolve({ user, apiKey: { organizationId: team.organization.id, projectId: null } });

      expect(personalOrganizationService.restoreDefaultProject).not.toHaveBeenCalled();
    });

    it("narrows every project down to the live one the key is bound to", async () => {
      const { resolver, team, user, projectRepository } = setup({ teamRole: "owner" });
      const project = createProject({ organizationId: team.organization.id });
      projectRepository.findActive.mockResolvedValue(project);

      const context = await resolver.resolve({ user, apiKey: { organizationId: team.organization.id, projectId: project.id } });

      expect(context?.projectScope).toEqual({ kind: "projects", projectIds: [project.id], writableProjectIds: [project.id], adminProjectIds: [project.id] });
      expect(projectRepository.findActive).toHaveBeenCalledWith(team.organization.id, project.id);
    });

    it("narrows a key bound to a project that is no longer live to no project at all", async () => {
      const { resolver, team, user } = setup({ teamRole: "owner" });

      const context = await resolver.resolve({ user, apiKey: { organizationId: team.organization.id, projectId: faker.string.uuid() } });

      expect(context?.projectScope).toEqual({ kind: "projects", projectIds: [], writableProjectIds: [], adminProjectIds: [] });
    });

    it("keeps the key's project only when the caller's grants still reach it", async () => {
      const grantedProjectIds = [faker.string.uuid(), faker.string.uuid()];
      const { resolver, team, user } = setup({ teamRole: "member", grantedProjectIds });

      const reached = await resolver.resolve({ user, apiKey: { organizationId: team.organization.id, projectId: grantedProjectIds[1] } });
      const unreached = await resolver.resolve({ user, apiKey: { organizationId: team.organization.id, projectId: faker.string.uuid() } });

      expect(reached?.projectScope).toEqual({
        kind: "projects",
        projectIds: [grantedProjectIds[1]],
        writableProjectIds: [grantedProjectIds[1]],
        adminProjectIds: []
      });
      expect(unreached?.projectScope).toEqual({ kind: "projects", projectIds: [], writableProjectIds: [], adminProjectIds: [] });
    });

    it("keeps the key's project only while it is live for a member with access to every project", async () => {
      const liveProjectIds = [faker.string.uuid(), faker.string.uuid()];
      const { resolver, team, user } = setup({ teamRole: "member", projectAccess: "all", liveProjectIds });

      const reached = await resolver.resolve({ user, apiKey: { organizationId: team.organization.id, projectId: liveProjectIds[0] } });
      const unreached = await resolver.resolve({ user, apiKey: { organizationId: team.organization.id, projectId: faker.string.uuid() } });

      expect(reached?.projectScope).toEqual({
        kind: "projects",
        projectIds: [liveProjectIds[0]],
        writableProjectIds: [liveProjectIds[0]],
        adminProjectIds: []
      });
      expect(unreached?.projectScope).toEqual({ kind: "projects", projectIds: [], writableProjectIds: [], adminProjectIds: [] });
    });

    it("rejects an organization header naming another organization than the key's", async () => {
      const { resolver, team, personal, user } = setup({});

      const resolution = resolver.resolve({
        user,
        apiKey: { organizationId: team.organization.id, projectId: null },
        organizationHeader: personal.organization.id
      });

      await expect(resolution).rejects.toMatchObject({ status: 400, errorCode: ORGANIZATION_MISMATCH_ERROR_CODE });
    });

    it("accepts an organization header naming the key's organization by id or by slug, whatever its case", async () => {
      const { resolver, team, user } = setup({});
      const apiKey = { organizationId: team.organization.id, projectId: null };

      const byId = await resolver.resolve({ user, apiKey, organizationHeader: ` ${team.organization.id.toUpperCase()}` });
      const bySlug = await resolver.resolve({ user, apiKey, organizationHeader: team.organization.slug.toUpperCase() });

      expect([byId?.organizationId, bySlug?.organizationId]).toEqual([team.organization.id, team.organization.id]);
    });

    it("reaches every project with an owner's key bound to an organization but no project", async () => {
      const { resolver, personal, user } = setup({});

      const context = await resolver.resolve({ user, apiKey: { organizationId: personal.organization.id, projectId: null } });

      expect(context).toEqual({
        organizationId: personal.organization.id,
        organizationType: "personal",
        role: "owner",
        projectScope: { kind: "all" }
      });
    });

    it("rejects a key whose owner no longer belongs to its organization", async () => {
      const { resolver, user } = setup({});

      const resolution = resolver.resolve({ user, apiKey: { organizationId: faker.string.uuid(), projectId: null } });

      await expect(resolution).rejects.toMatchObject({ status: 403, errorCode: ORGANIZATION_FORBIDDEN_ERROR_CODE });
    });

    it("leaves the last used organization alone", async () => {
      const { resolver, team, user, userRepository } = setup({});

      await resolver.resolve({ user, apiKey: { organizationId: team.organization.id, projectId: null }, organizationHeader: team.organization.id });

      expect(userRepository.updateById).not.toHaveBeenCalled();
    });
  });

  describe("resolveBoundTo", () => {
    it("resolves the organization the work is bound to with what the member's role and grants reach now", async () => {
      const grantedProjectIds = [faker.string.uuid()];
      const { resolver, team, user } = setup({ teamRole: "member", grantedProjectIds });

      const context = await resolver.resolveBoundTo(user, team.organization.id);

      expect(context).toEqual({
        organizationId: team.organization.id,
        organizationType: "team",
        role: "member",
        projectScope: { kind: "projects", projectIds: grantedProjectIds, writableProjectIds: grantedProjectIds, adminProjectIds: [] }
      });
    });

    it("rejects a member who no longer belongs to the organization", async () => {
      const { resolver, user } = setup({});

      await expect(resolver.resolveBoundTo(user, faker.string.uuid())).rejects.toMatchObject({ status: 403, errorCode: ORGANIZATION_FORBIDDEN_ERROR_CODE });
    });

    it("leaves the last used organization alone", async () => {
      const { resolver, team, user, userRepository } = setup({});

      await resolver.resolveBoundTo(user, team.organization.id);

      expect(userRepository.updateById).not.toHaveBeenCalled();
      expect(userRepository.updateBy).not.toHaveBeenCalled();
    });
  });

  describe("when the user's account is terminated", () => {
    it("refuses a team named in the header with account_terminated and the reason written for them", async () => {
      const { resolver, team, accountStatusService } = setup({ userReason: "Fraud" });
      const user = createUser({ accountStatus: "terminated" });

      await expect(resolver.resolve({ user, organizationHeader: team.organization.id })).rejects.toMatchObject({
        status: 403,
        errorCode: "account_terminated",
        data: { reason: "Fraud" }
      });
      expect(accountStatusService.findUserReasonOf).toHaveBeenCalledWith(user);
    });

    it("refuses a team an API key is bound to and work bound to a team", async () => {
      const { resolver, team } = setup({});
      const user = createUser({ accountStatus: "terminated" });

      await expect(resolver.resolve({ user, apiKey: { organizationId: team.organization.id, projectId: null } })).rejects.toMatchObject({
        errorCode: "account_terminated"
      });
      await expect(resolver.resolveBoundTo(user, team.organization.id)).rejects.toMatchObject({ errorCode: "account_terminated" });
    });

    it("still resolves the personal organization named in the header", async () => {
      const { resolver, personal, accountStatusService } = setup({});
      const user = createUser({ accountStatus: "terminated" });

      const context = await resolver.resolve({ user, organizationHeader: personal.organization.id });

      expect(context).toMatchObject({ organizationId: personal.organization.id, organizationType: "personal", role: "owner" });
      expect(accountStatusService.findUserReasonOf).not.toHaveBeenCalled();
    });

    it("resolves the personal organization instead of the team used last, which stays remembered", async () => {
      const { resolver, personal, team, userRepository } = setup({});
      const user = createUser({ accountStatus: "terminated", lastUsedOrganizationId: team.organization.id });

      const context = await resolver.resolve({ user });

      expect(context).toMatchObject({ organizationId: personal.organization.id, organizationType: "personal" });
      expect(userRepository.updateBy).not.toHaveBeenCalled();
      expect(userRepository.updateById).not.toHaveBeenCalled();
    });

    it("lets a suspended user act in a team", async () => {
      const { resolver, team } = setup({});
      const user = createUser({ accountStatus: "suspended", lastUsedOrganizationId: team.organization.id });

      const context = await resolver.resolve({ user });

      expect(context).toMatchObject({ organizationId: team.organization.id, organizationType: "team" });
    });
  });

  describe("with an organization header", () => {
    it("resolves an organization the caller belongs to, named by id", async () => {
      const { resolver, team, user, organizationMemberRepository } = setup({ teamRole: "billing" });

      const context = await resolver.resolve({ user, organizationHeader: team.organization.id });

      expect(context).toEqual({
        organizationId: team.organization.id,
        organizationType: "team",
        role: "billing",
        projectScope: { kind: "projects", projectIds: [], writableProjectIds: [], adminProjectIds: [] }
      });
      expect(organizationMemberRepository.findActiveMembership).toHaveBeenCalledWith(user.id, { idOrSlug: team.organization.id });
    });

    it("restores the default project of the personal organization it names, once per user", async () => {
      const { resolver, personal, user, personalOrganizationService } = setup({});

      await resolver.resolve({ user, organizationHeader: personal.organization.id });
      await resolver.resolve({ user, organizationHeader: personal.organization.id });

      expect(personalOrganizationService.restoreDefaultProject).toHaveBeenCalledOnce();
      expect(personalOrganizationService.restoreDefaultProject).toHaveBeenCalledWith(user, personal.organization);
    });

    it("fails the request when the default project of the personal organization it names cannot be restored", async () => {
      const { resolver, personal, user, personalOrganizationService } = setup({});
      const error = new Error("database unavailable");
      personalOrganizationService.restoreDefaultProject.mockRejectedValue(error);

      await expect(resolver.resolve({ user, organizationHeader: personal.organization.id })).rejects.toBe(error);
    });

    it("looks up a header that is not a uuid by slug", async () => {
      const { resolver, team, user, organizationMemberRepository } = setup({});

      const context = await resolver.resolve({ user, organizationHeader: team.organization.slug });

      expect(context?.organizationId).toBe(team.organization.id);
      expect(organizationMemberRepository.findActiveMembership).toHaveBeenCalledWith(user.id, { slug: team.organization.slug });
    });

    it("matches the header whatever its case and surrounding spaces", async () => {
      const { resolver, team, user, organizationMemberRepository } = setup({});

      const byId = await resolver.resolve({ user, organizationHeader: ` ${team.organization.id.toUpperCase()} ` });
      const bySlug = await resolver.resolve({ user, organizationHeader: team.organization.slug.toUpperCase() });

      expect([byId?.organizationId, bySlug?.organizationId]).toEqual([team.organization.id, team.organization.id]);
      expect(organizationMemberRepository.findActiveMembership.mock.calls).toEqual([
        [user.id, { idOrSlug: team.organization.id }],
        [user.id, { slug: team.organization.slug }]
      ]);
    });

    it("resolves an organization whose slug is shaped like a uuid", async () => {
      const { resolver, team, user } = setup({});
      team.organization.slug = faker.string.uuid();

      const context = await resolver.resolve({ user, organizationHeader: team.organization.slug });

      expect(context?.organizationId).toBe(team.organization.id);
    });

    it("treats a blank header as no header", async () => {
      const { resolver, personal, user } = setup({});

      const context = await resolver.resolve({ user, organizationHeader: "  " });

      expect(context?.organizationId).toBe(personal.organization.id);
    });

    it("rejects an organization the caller does not belong to", async () => {
      const { resolver, user } = setup({});

      const resolution = resolver.resolve({ user, organizationHeader: faker.string.uuid() });

      await expect(resolution).rejects.toMatchObject({ status: 403, errorCode: ORGANIZATION_FORBIDDEN_ERROR_CODE });
    });

    it("remembers a newly named organization as the last used one", async () => {
      const { resolver, team, personal, userRepository } = setup({});
      const user = createUser({ lastUsedOrganizationId: personal.organization.id });

      await resolver.resolve({ user, organizationHeader: team.organization.id });

      expect(userRepository.updateById).toHaveBeenCalledWith(user.id, { lastUsedOrganizationId: team.organization.id });
    });

    it("does not rewrite the organization already stored as last used", async () => {
      const { resolver, team, userRepository } = setup({});
      const user = createUser({ lastUsedOrganizationId: team.organization.id });

      await resolver.resolve({ user, organizationHeader: team.organization.id });

      expect(userRepository.updateById).not.toHaveBeenCalled();
    });

    it("remembers each named organization at most once per user within the throttle window", async () => {
      vi.useFakeTimers();
      try {
        const { resolver, team, personal, userRepository, user } = setup({});
        const teamWrite = [user.id, { lastUsedOrganizationId: team.organization.id }];
        const personalWrite = [user.id, { lastUsedOrganizationId: personal.organization.id }];

        await resolver.resolve({ user, organizationHeader: team.organization.id });
        await resolver.resolve({ user, organizationHeader: personal.organization.id });
        await resolver.resolve({ user, organizationHeader: team.organization.id });
        const writesWithinWindow = [...userRepository.updateById.mock.calls];
        vi.advanceTimersByTime(LAST_USED_ORGANIZATION_THROTTLE_MS);
        await resolver.resolve({ user, organizationHeader: team.organization.id });

        expect(writesWithinWindow).toEqual([teamWrite, personalWrite]);
        expect(userRepository.updateById.mock.calls).toEqual([teamWrite, personalWrite, teamWrite]);
      } finally {
        vi.useRealTimers();
      }
    });

    it("logs a failed last used write without failing the request", async () => {
      const { resolver, team, user, userRepository, logger } = setup({});
      const error = new Error("connection reset");
      userRepository.updateById.mockRejectedValue(error);

      const context = await resolver.resolve({ user, organizationHeader: team.organization.id });

      expect(context?.organizationId).toBe(team.organization.id);
      await vi.waitFor(() =>
        expect(logger.warn).toHaveBeenCalledWith({
          event: "LAST_USED_ORGANIZATION_UPDATE_FAILED",
          userId: user.id,
          organizationId: team.organization.id,
          error
        })
      );
    });
  });

  describe("without an organization header", () => {
    it("resolves the last used organization while the caller still belongs to it", async () => {
      const { resolver, team } = setup({});
      const user = createUser({ lastUsedOrganizationId: team.organization.id });

      const context = await resolver.resolve({ user });

      expect(context?.organizationId).toBe(team.organization.id);
    });

    it("restores the default project of the personal organization used last", async () => {
      const { resolver, personal, personalOrganizationService } = setup({});
      const user = createUser({ lastUsedOrganizationId: personal.organization.id });

      await resolver.resolve({ user });

      expect(personalOrganizationService.restoreDefaultProject).toHaveBeenCalledWith(user, personal.organization);
    });

    it("falls back to the personal organization and forgets the last used one once the caller left it", async () => {
      const { resolver, personal, userRepository } = setup({});
      const user = createUser({ lastUsedOrganizationId: faker.string.uuid() });

      const context = await resolver.resolve({ user });

      expect(context).toMatchObject({ organizationId: personal.organization.id, role: "owner", projectScope: { kind: "all" } });
      expect(userRepository.updateBy).toHaveBeenCalledWith(
        { id: user.id, lastUsedOrganizationId: user.lastUsedOrganizationId },
        { lastUsedOrganizationId: null }
      );
    });

    it("logs a failed attempt to forget the last used organization without failing the request", async () => {
      const { resolver, personal, userRepository, logger } = setup({});
      const user = createUser({ lastUsedOrganizationId: faker.string.uuid() });
      const error = new Error("connection reset");
      userRepository.updateBy.mockRejectedValue(error);

      const context = await resolver.resolve({ user });

      expect(context?.organizationId).toBe(personal.organization.id);
      await vi.waitFor(() =>
        expect(logger.warn).toHaveBeenCalledWith({
          event: "LAST_USED_ORGANIZATION_CLEAR_FAILED",
          userId: user.id,
          organizationId: user.lastUsedOrganizationId,
          error
        })
      );
    });

    it("keeps the last used organization while the caller still belongs to it", async () => {
      const { resolver, team, userRepository } = setup({});
      const user = createUser({ lastUsedOrganizationId: team.organization.id });

      await resolver.resolve({ user });

      expect(userRepository.updateBy).not.toHaveBeenCalled();
    });

    it("reads the personal organization once per user", async () => {
      const { resolver, personal, user, organizationMemberRepository } = setup({});

      await resolver.resolve({ user });
      const context = await resolver.resolve({ user });

      expect(context?.organizationId).toBe(personal.organization.id);
      expect(organizationMemberRepository.findActiveMembership).toHaveBeenCalledTimes(1);
    });

    it("restores the default project of a personal organization it finds, once per user", async () => {
      const { resolver, personal, user, personalOrganizationService } = setup({});

      await resolver.resolve({ user });
      await resolver.resolve({ user });

      expect(personalOrganizationService.restoreDefaultProject).toHaveBeenCalledOnce();
      expect(personalOrganizationService.restoreDefaultProject).toHaveBeenCalledWith(user, personal.organization);
    });

    it("leaves the default project to the provisioning of a personal organization it has to create", async () => {
      const { resolver, personalOrganizationService, user } = setup({ withoutPersonalMembership: true });
      personalOrganizationService.ensureForUser.mockResolvedValue(createOrganization({ type: "personal", createdByUserId: user.id }));

      await resolver.resolve({ user });

      expect(personalOrganizationService.restoreDefaultProject).not.toHaveBeenCalled();
    });

    it("fails the request when the default project cannot be restored", async () => {
      const { resolver, personalOrganizationService, user } = setup({});
      const error = new Error("database unavailable");
      personalOrganizationService.restoreDefaultProject.mockRejectedValue(error);

      await expect(resolver.resolve({ user })).rejects.toBe(error);
    });

    it("fails the request when the personal organization cannot be created", async () => {
      const { resolver, personalOrganizationService, user } = setup({ withoutPersonalMembership: true });
      const error = new Error("insert failed");
      personalOrganizationService.ensureForUser.mockRejectedValue(error);

      await expect(resolver.resolve({ user })).rejects.toBe(error);
    });

    it("creates the personal organization once per user", async () => {
      const { resolver, personalOrganizationService, user } = setup({ withoutPersonalMembership: true });
      const created = createOrganization({ type: "personal", createdByUserId: user.id });
      personalOrganizationService.ensureForUser.mockResolvedValue(created);

      await resolver.resolve({ user });
      const context = await resolver.resolve({ user });

      expect(context?.organizationId).toBe(created.id);
      expect(personalOrganizationService.ensureForUser).toHaveBeenCalledTimes(1);
    });

    it("resolves the personal organization when nothing was used before", async () => {
      const { resolver, personal, user, organizationMemberRepository } = setup({});

      const context = await resolver.resolve({ user });

      expect(context?.organizationId).toBe(personal.organization.id);
      expect(organizationMemberRepository.findActiveMembership.mock.calls).toEqual([[user.id, { type: "personal" }]]);
    });

    it("creates the personal organization and makes the caller its owner when it is missing", async () => {
      const { resolver, personalOrganizationService, user } = setup({ withoutPersonalMembership: true });
      const created = createOrganization({ type: "personal", createdByUserId: user.id });
      personalOrganizationService.ensureForUser.mockResolvedValue(created);

      const context = await resolver.resolve({ user });

      expect(context).toMatchObject({ organizationId: created.id, organizationType: "personal", role: "owner", projectScope: { kind: "all" } });
    });
  });

  describe("project scope by role", () => {
    it.each<OrganizationRole>(["owner", "admin"])("reaches every project as %s", async role => {
      const { resolver, team, user, projectRepository } = setup({ teamRole: role });

      const context = await resolver.resolve({ user, organizationHeader: team.organization.id });

      expect(context?.projectScope).toEqual({ kind: "all" });
      expect(projectRepository.findActiveGrantsOf).not.toHaveBeenCalled();
    });

    it("reaches the granted projects as member, writing where the project role allows and administering where it is admin", async () => {
      const grants = (["viewer", "member", "admin"] as const).map(role => ({ projectId: faker.string.uuid(), role }));
      const { resolver, team, user, projectRepository } = setup({ teamRole: "member", grants });

      const context = await resolver.resolve({ user, organizationHeader: team.organization.id });

      expect(context?.projectScope).toEqual({
        kind: "projects",
        projectIds: grants.map(({ projectId }) => projectId),
        writableProjectIds: [grants[1].projectId, grants[2].projectId],
        adminProjectIds: [grants[2].projectId]
      });
      expect(projectRepository.findActiveGrantsOf).toHaveBeenCalledWith(team.organization.id, user.id);
    });

    it("reaches the granted projects as viewer for reading only, whatever the project roles", async () => {
      const grants = (["viewer", "member", "admin"] as const).map(role => ({ projectId: faker.string.uuid(), role }));
      const { resolver, team, user } = setup({ teamRole: "viewer", grants });

      const context = await resolver.resolve({ user, organizationHeader: team.organization.id });

      expect(context?.projectScope).toEqual({
        kind: "projects",
        projectIds: grants.map(({ projectId }) => projectId),
        writableProjectIds: [],
        adminProjectIds: []
      });
    });

    it("reaches only the granted projects as a member with access to specific projects", async () => {
      const grantedProjectIds = [faker.string.uuid()];
      const { resolver, team, user, projectRepository } = setup({ teamRole: "member", projectAccess: "selected", grantedProjectIds });

      const context = await resolver.resolve({ user, organizationHeader: team.organization.id });

      expect(context?.projectScope).toMatchObject({ projectIds: grantedProjectIds });
      expect(projectRepository.findActiveIdsOf).not.toHaveBeenCalled();
    });

    it("reaches and writes in every live project as a member with access to every project, administering only the projects granted as admin", async () => {
      const liveProjectIds = [faker.string.uuid(), faker.string.uuid(), faker.string.uuid()];
      const grants = [
        { projectId: liveProjectIds[0], role: "member" as const },
        { projectId: liveProjectIds[1], role: "admin" as const }
      ];
      const { resolver, team, user, projectRepository } = setup({ teamRole: "member", projectAccess: "all", liveProjectIds, grants });

      const context = await resolver.resolve({ user, organizationHeader: team.organization.id });

      expect(context?.projectScope).toEqual({
        kind: "projects",
        projectIds: liveProjectIds,
        writableProjectIds: liveProjectIds,
        adminProjectIds: [liveProjectIds[1]]
      });
      expect(projectRepository.findActiveIdsOf).toHaveBeenCalledWith(team.organization.id);
      expect(projectRepository.findActiveGrantsOf).toHaveBeenCalledWith(team.organization.id, user.id);
    });

    it("reaches every live project for reading only as a viewer with access to every project, whatever the project roles", async () => {
      const liveProjectIds = [faker.string.uuid(), faker.string.uuid()];
      const grants = [{ projectId: liveProjectIds[0], role: "admin" as const }];
      const { resolver, team, user } = setup({ teamRole: "viewer", projectAccess: "all", liveProjectIds, grants });

      const context = await resolver.resolve({ user, organizationHeader: team.organization.id });

      expect(context?.projectScope).toEqual({ kind: "projects", projectIds: liveProjectIds, writableProjectIds: [], adminProjectIds: [] });
    });

    it("reaches a project created after the member joined on their next request", async () => {
      const [firstProjectId, laterProjectId] = [faker.string.uuid(), faker.string.uuid()];
      const { resolver, team, user, projectRepository } = setup({ teamRole: "member", projectAccess: "all", liveProjectIds: [firstProjectId] });

      const before = await resolver.resolve({ user, organizationHeader: team.organization.id });
      projectRepository.findActiveIdsOf.mockResolvedValue([firstProjectId, laterProjectId]);
      const after = await resolver.resolve({ user, organizationHeader: team.organization.id });

      expect(before?.projectScope).toMatchObject({ projectIds: [firstProjectId] });
      expect(after?.projectScope).toMatchObject({ projectIds: [firstProjectId, laterProjectId], writableProjectIds: [firstProjectId, laterProjectId] });
    });

    it.each<OrganizationRole>(["owner", "admin", "billing"])("ignores the project access of %s", async role => {
      const { resolver, team, user, projectRepository } = setup({ teamRole: role, projectAccess: "all" });

      await resolver.resolve({ user, organizationHeader: team.organization.id });

      expect(projectRepository.findActiveIdsOf).not.toHaveBeenCalled();
    });

    it("reaches no project as billing", async () => {
      const { resolver, team, user, projectRepository } = setup({ teamRole: "billing" });

      const context = await resolver.resolve({ user, organizationHeader: team.organization.id });

      expect(context?.projectScope).toEqual({ kind: "projects", projectIds: [], writableProjectIds: [], adminProjectIds: [] });
      expect(projectRepository.findActiveGrantsOf).not.toHaveBeenCalled();
    });
  });

  describe("with a project header", () => {
    it("narrows every project down to one that is live in the organization", async () => {
      const { resolver, team, user, projectRepository } = setup({});
      const project = createProject({ organizationId: team.organization.id });
      projectRepository.findActive.mockResolvedValue(project);

      const context = await resolver.resolve({ user, organizationHeader: team.organization.id, projectHeader: project.id });

      expect(context?.projectScope).toEqual({ kind: "projects", projectIds: [project.id], writableProjectIds: [project.id], adminProjectIds: [project.id] });
      expect(projectRepository.findActive).toHaveBeenCalledWith(team.organization.id, project.id);
    });

    it("rejects a project that is not live in the organization", async () => {
      const { resolver, team, user } = setup({});

      const resolution = resolver.resolve({ user, organizationHeader: team.organization.id, projectHeader: faker.string.uuid() });

      await expect(resolution).rejects.toMatchObject({ status: 403, errorCode: PROJECT_FORBIDDEN_ERROR_CODE });
    });

    it("narrows the granted projects and their write levels down to the named one, whatever its case", async () => {
      const grants = [
        { projectId: faker.string.uuid(), role: "admin" as const },
        { projectId: faker.string.uuid(), role: "admin" as const }
      ];
      const { resolver, team, user, projectRepository } = setup({ teamRole: "member", grants });

      const context = await resolver.resolve({ user, organizationHeader: team.organization.id, projectHeader: ` ${grants[0].projectId.toUpperCase()} ` });

      expect(context?.projectScope).toEqual({
        kind: "projects",
        projectIds: [grants[0].projectId],
        writableProjectIds: [grants[0].projectId],
        adminProjectIds: [grants[0].projectId]
      });
      expect(projectRepository.findActive).not.toHaveBeenCalled();
    });

    it("narrows every live project of a member with access to every project down to the named one", async () => {
      const liveProjectIds = [faker.string.uuid(), faker.string.uuid()];
      const { resolver, team, user } = setup({ teamRole: "member", projectAccess: "all", liveProjectIds });

      const context = await resolver.resolve({ user, organizationHeader: team.organization.id, projectHeader: liveProjectIds[1] });
      const outside = resolver.resolve({ user, organizationHeader: team.organization.id, projectHeader: faker.string.uuid() });

      expect(context?.projectScope).toEqual({
        kind: "projects",
        projectIds: [liveProjectIds[1]],
        writableProjectIds: [liveProjectIds[1]],
        adminProjectIds: []
      });
      await expect(outside).rejects.toMatchObject({ status: 403, errorCode: PROJECT_FORBIDDEN_ERROR_CODE });
    });

    it("rejects a project outside the caller's grants", async () => {
      const { resolver, team, user, projectRepository } = setup({ teamRole: "viewer", grantedProjectIds: [faker.string.uuid()] });

      const resolution = resolver.resolve({ user, organizationHeader: team.organization.id, projectHeader: faker.string.uuid() });

      await expect(resolution).rejects.toMatchObject({ status: 403, errorCode: PROJECT_FORBIDDEN_ERROR_CODE });
      expect(projectRepository.findActive).not.toHaveBeenCalled();
    });

    it("rejects a project other than the one an API key is bound to", async () => {
      const { resolver, team, user, projectRepository } = setup({});
      projectRepository.findActive.mockResolvedValue(createProject({ organizationId: team.organization.id }));

      const resolution = resolver.resolve({
        user,
        apiKey: { organizationId: team.organization.id, projectId: faker.string.uuid() },
        projectHeader: faker.string.uuid()
      });

      await expect(resolution).rejects.toMatchObject({ status: 403, errorCode: PROJECT_FORBIDDEN_ERROR_CODE });
    });

    it("rejects a project header that is not a uuid without looking it up", async () => {
      const { resolver, team, user, projectRepository } = setup({});

      const resolution = resolver.resolve({ user, organizationHeader: team.organization.id, projectHeader: "default" });

      await expect(resolution).rejects.toMatchObject({ status: 403, errorCode: PROJECT_FORBIDDEN_ERROR_CODE });
      expect(projectRepository.findActive).not.toHaveBeenCalled();
    });
  });

  function setup(input: {
    teamRole?: OrganizationRole;
    projectAccess?: ProjectAccess;
    liveProjectIds?: string[];
    grantedProjectIds?: string[];
    grants?: ProjectGrantOfUser[];
    withoutPersonalMembership?: boolean;
    userReason?: string;
  }) {
    const user: OrganizationContextRequest["user"] = createUser();
    const personal: MembershipWithProjectAccess = {
      role: "owner",
      projectAccess: "all",
      organization: createOrganization({ type: "personal", createdByUserId: user.id })
    };
    const team: MembershipWithProjectAccess = {
      role: input.teamRole ?? "owner",
      projectAccess: input.projectAccess ?? "selected",
      organization: createOrganization({ type: "team" })
    };
    const memberships = input.withoutPersonalMembership ? [team] : [personal, team];

    const organizationMemberRepository = mock<OrganizationMemberRepository>({
      findActiveMembership: vi.fn(async (_userId, lookup) =>
        memberships.find(({ organization }) => {
          if ("id" in lookup) return organization.id === lookup.id;
          if ("idOrSlug" in lookup) return organization.id === lookup.idOrSlug || organization.slug === lookup.idOrSlug;
          if ("slug" in lookup) return organization.slug === lookup.slug;
          return organization.type === "personal";
        })
      )
    });
    const projectRepository = mock<ProjectRepository>({
      findActiveGrantsOf: vi.fn().mockResolvedValue(input.grants ?? (input.grantedProjectIds ?? []).map(projectId => ({ projectId, role: "member" }))),
      findActiveIdsOf: vi.fn().mockResolvedValue(input.liveProjectIds ?? []),
      findActive: vi.fn().mockResolvedValue(undefined)
    });
    const personalOrganizationService = mock<PersonalOrganizationService>();
    const userRepository = mock<UserRepository>({ updateById: vi.fn().mockResolvedValue(undefined), updateBy: vi.fn().mockResolvedValue(undefined) });
    const accountStatusService = mock<AccountStatusService>({ findUserReasonOf: vi.fn().mockResolvedValue(input.userReason ?? null) });
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);

    const resolver = new OrganizationContextResolver(
      organizationMemberRepository,
      projectRepository,
      personalOrganizationService,
      userRepository,
      new AccountStatusGuard(userRepository, accountStatusService),
      createLogger
    );

    return {
      resolver,
      user,
      personal,
      team,
      organizationMemberRepository,
      projectRepository,
      personalOrganizationService,
      userRepository,
      accountStatusService,
      logger,
      createLogger
    };
  }
});
