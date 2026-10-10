import { faker } from "@faker-js/faker";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { CreateLogger } from "@src/core/providers/logging.provider";
import { ORGANIZATION_FORBIDDEN_ERROR_CODE } from "@src/core/repositories/org-scoped.repository";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import type { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import type { OrganizationRole } from "@src/organization/model-schemas/organization-member/organization-member.schema";
import type { Membership, OrganizationMemberRepository } from "@src/organization/repositories/organization-member/organization-member.repository";
import type { ProjectRepository } from "@src/organization/repositories/project/project.repository";
import type { PersonalOrganizationService } from "@src/organization/services/personal-organization/personal-organization.service";
import type { UserRepository } from "@src/user/repositories/user/user.repository";
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
  describe("when organizations are off for the user", () => {
    it("resolves the personal organization as its owner reaching every project, whatever the headers name", async () => {
      const { resolver, personal, team, projectRepository, organizationMemberRepository, user } = setup({ organizationsOn: false, teamRole: "viewer" });

      const context = await resolver.resolve({
        user,
        organizationHeader: team.organization.id,
        projectHeader: faker.string.uuid()
      });

      expect(context).toEqual({
        organizationId: personal.organization.id,
        organizationType: "personal",
        role: "owner",
        projectScope: { kind: "all" },
        mode: "legacy"
      });
      expect(organizationMemberRepository.findActiveMembership).toHaveBeenCalledTimes(1);
      expect(projectRepository.findActive).not.toHaveBeenCalled();
    });

    it("rejects an API key bound to another organization than the personal one", async () => {
      const { resolver, team, user } = setup({ organizationsOn: false });

      const resolution = resolver.resolve({ user, apiKey: { organizationId: team.organization.id, projectId: null } });

      await expect(resolution).rejects.toMatchObject({
        status: 403,
        errorCode: ORGANIZATION_FORBIDDEN_ERROR_CODE,
        message: "The API key belongs to an organization this request cannot run in"
      });
    });

    it("rejects an API key bound to another organization than the personal one once enforcement is on", async () => {
      const { resolver, team, user } = setup({ organizationsOn: false, enforceOn: true });

      const resolution = resolver.resolve({ user, apiKey: { organizationId: team.organization.id, projectId: faker.string.uuid() } });

      await expect(resolution).rejects.toMatchObject({ status: 403, errorCode: ORGANIZATION_FORBIDDEN_ERROR_CODE });
    });

    it("reaches every project of the personal organization with an API key bound to it or to no organization", async () => {
      const { resolver, personal, user } = setup({ organizationsOn: false });

      const [boundToPersonal, boundToNone] = await Promise.all([
        resolver.resolve({ user, apiKey: { organizationId: personal.organization.id, projectId: null } }),
        resolver.resolve({ user, apiKey: { organizationId: null, projectId: null } })
      ]);

      expect(boundToPersonal).toEqual({
        organizationId: personal.organization.id,
        organizationType: "personal",
        role: "owner",
        projectScope: { kind: "all" },
        mode: "legacy"
      });
      expect(boundToNone).toEqual(boundToPersonal);
    });

    it("narrows every project down to the one an API key is bound to, with or without enforcement", async () => {
      const { resolver, personal, user } = setup({ organizationsOn: false });
      const { resolver: enforcingResolver, personal: enforcedPersonal, user: enforcedUser } = setup({ organizationsOn: false, enforceOn: true });
      const projectId = faker.string.uuid();

      const [context, enforcedContext] = await Promise.all([
        resolver.resolve({ user, apiKey: { organizationId: personal.organization.id, projectId } }),
        enforcingResolver.resolve({ user: enforcedUser, apiKey: { organizationId: enforcedPersonal.organization.id, projectId } })
      ]);

      expect(context).toMatchObject({ organizationId: personal.organization.id, projectScope: { kind: "projects", projectIds: [projectId] }, mode: "legacy" });
      expect(enforcedContext).toMatchObject({
        organizationId: enforcedPersonal.organization.id,
        projectScope: { kind: "projects", projectIds: [projectId] },
        mode: "organization"
      });
    });

    it("leaves the request without an organization context when the personal organization cannot be resolved", async () => {
      const { resolver, personalOrganizationService, user, logger } = setup({ organizationsOn: false, withoutPersonalMembership: true });
      const error = new Error("insert failed");
      personalOrganizationService.ensureForUser.mockRejectedValue(error);

      const context = await resolver.resolve({ user });

      expect(context).toBeUndefined();
      expect(logger.error).toHaveBeenCalledWith({ event: "PERSONAL_ORGANIZATION_CONTEXT_UNAVAILABLE", userId: user.id, error });
    });

    it("fails the request when the personal organization cannot be resolved once enforcement is on", async () => {
      const { resolver, personalOrganizationService, user } = setup({ organizationsOn: false, enforceOn: true, withoutPersonalMembership: true });
      const error = new Error("insert failed");
      personalOrganizationService.ensureForUser.mockRejectedValue(error);

      await expect(resolver.resolve({ user })).rejects.toBe(error);
    });

    it("creates the personal organization of a user who has none yet", async () => {
      const { resolver, personalOrganizationService, user } = setup({ organizationsOn: false, withoutPersonalMembership: true });
      const created = createOrganization({ type: "personal", createdByUserId: user.id });
      personalOrganizationService.ensureForUser.mockResolvedValue(created);

      const context = await resolver.resolve({ user });

      expect(personalOrganizationService.ensureForUser).toHaveBeenCalledWith(user);
      expect(context).toMatchObject({ organizationId: created.id, organizationType: "personal", role: "owner" });
    });

    it("runs in organization mode once enforcement is on for everyone", async () => {
      const { resolver, user, featureFlagsService } = setup({ organizationsOn: false, enforceOn: true });

      const context = await resolver.resolve({ user });

      expect(context?.mode).toBe("organization");
      expect(featureFlagsService.isEnabled).toHaveBeenCalledWith(FeatureFlags.ORGANIZATIONS_ENFORCE, { userId: user.id });
    });
  });

  it("logs under its own name", () => {
    const { createLogger } = setup({});

    expect(createLogger).toHaveBeenCalledWith({ context: OrganizationContextResolver.name });
  });

  describe("when organizations are on for the user", () => {
    it("runs in organization mode", async () => {
      const { resolver, user, featureFlagsService } = setup({});

      const context = await resolver.resolve({ user });

      expect(context?.mode).toBe("organization");
      expect(featureFlagsService.isEnabled).toHaveBeenCalledWith(FeatureFlags.ORGANIZATIONS, { userId: user.id });
    });
  });

  describe("with an API key", () => {
    it("resolves the organization the key is bound to", async () => {
      const { resolver, team, user } = setup({ teamRole: "admin" });

      const context = await resolver.resolve({ user, apiKey: { organizationId: team.organization.id, projectId: null } });

      expect(context).toEqual({
        organizationId: team.organization.id,
        organizationType: "team",
        role: "admin",
        projectScope: { kind: "all" },
        mode: "organization"
      });
    });

    it("resolves the owner's personal organization for a key bound to none, whatever was used last", async () => {
      const { resolver, personal, team } = setup({});
      const user = createUser({ lastUsedOrganizationId: team.organization.id });

      const context = await resolver.resolve({ user, apiKey: { organizationId: null, projectId: null } });

      expect(context).toMatchObject({ organizationId: personal.organization.id, role: "owner" });
    });

    it("narrows every project down to the one the key is bound to", async () => {
      const { resolver, team, user } = setup({ teamRole: "owner" });
      const projectId = faker.string.uuid();

      const context = await resolver.resolve({ user, apiKey: { organizationId: team.organization.id, projectId } });

      expect(context?.projectScope).toEqual({ kind: "projects", projectIds: [projectId] });
    });

    it("keeps the key's project only when the caller's grants still reach it", async () => {
      const grantedProjectIds = [faker.string.uuid(), faker.string.uuid()];
      const { resolver, team, user } = setup({ teamRole: "member", grantedProjectIds });

      const reached = await resolver.resolve({ user, apiKey: { organizationId: team.organization.id, projectId: grantedProjectIds[1] } });
      const unreached = await resolver.resolve({ user, apiKey: { organizationId: team.organization.id, projectId: faker.string.uuid() } });

      expect(reached?.projectScope).toEqual({ kind: "projects", projectIds: [grantedProjectIds[1]] });
      expect(unreached?.projectScope).toEqual({ kind: "projects", projectIds: [] });
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
        projectScope: { kind: "all" },
        mode: "organization"
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

  describe("with an organization header", () => {
    it("resolves an organization the caller belongs to, named by id", async () => {
      const { resolver, team, user, organizationMemberRepository } = setup({ teamRole: "billing" });

      const context = await resolver.resolve({ user, organizationHeader: team.organization.id });

      expect(context).toEqual({
        organizationId: team.organization.id,
        organizationType: "team",
        role: "billing",
        projectScope: { kind: "projects", projectIds: [] },
        mode: "organization"
      });
      expect(organizationMemberRepository.findActiveMembership).toHaveBeenCalledWith(user.id, { idOrSlug: team.organization.id });
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

    it("creates the personal organization once per user", async () => {
      const { resolver, personalOrganizationService, user } = setup({ organizationsOn: false, withoutPersonalMembership: true });
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
      expect(projectRepository.findActiveIdsGrantedTo).not.toHaveBeenCalled();
    });

    it.each<OrganizationRole>(["member", "viewer"])("reaches the granted projects as %s", async role => {
      const grantedProjectIds = [faker.string.uuid()];
      const { resolver, team, user, projectRepository } = setup({ teamRole: role, grantedProjectIds });

      const context = await resolver.resolve({ user, organizationHeader: team.organization.id });

      expect(context?.projectScope).toEqual({ kind: "projects", projectIds: grantedProjectIds });
      expect(projectRepository.findActiveIdsGrantedTo).toHaveBeenCalledWith(team.organization.id, user.id);
    });

    it("reaches no project as billing", async () => {
      const { resolver, team, user, projectRepository } = setup({ teamRole: "billing" });

      const context = await resolver.resolve({ user, organizationHeader: team.organization.id });

      expect(context?.projectScope).toEqual({ kind: "projects", projectIds: [] });
      expect(projectRepository.findActiveIdsGrantedTo).not.toHaveBeenCalled();
    });
  });

  describe("with a project header", () => {
    it("narrows every project down to one that is live in the organization", async () => {
      const { resolver, team, user, projectRepository } = setup({});
      const project = createProject({ organizationId: team.organization.id });
      projectRepository.findActive.mockResolvedValue(project);

      const context = await resolver.resolve({ user, organizationHeader: team.organization.id, projectHeader: project.id });

      expect(context?.projectScope).toEqual({ kind: "projects", projectIds: [project.id] });
      expect(projectRepository.findActive).toHaveBeenCalledWith(team.organization.id, project.id);
    });

    it("rejects a project that is not live in the organization", async () => {
      const { resolver, team, user } = setup({});

      const resolution = resolver.resolve({ user, organizationHeader: team.organization.id, projectHeader: faker.string.uuid() });

      await expect(resolution).rejects.toMatchObject({ status: 403, errorCode: PROJECT_FORBIDDEN_ERROR_CODE });
    });

    it("narrows the granted projects down to the named one, whatever its case", async () => {
      const grantedProjectIds = [faker.string.uuid(), faker.string.uuid()];
      const { resolver, team, user, projectRepository } = setup({ teamRole: "member", grantedProjectIds });

      const context = await resolver.resolve({ user, organizationHeader: team.organization.id, projectHeader: ` ${grantedProjectIds[0].toUpperCase()} ` });

      expect(context?.projectScope).toEqual({ kind: "projects", projectIds: [grantedProjectIds[0]] });
      expect(projectRepository.findActive).not.toHaveBeenCalled();
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
    organizationsOn?: boolean;
    enforceOn?: boolean;
    teamRole?: OrganizationRole;
    grantedProjectIds?: string[];
    withoutPersonalMembership?: boolean;
  }) {
    const user: OrganizationContextRequest["user"] = createUser();
    const personal: Membership = { role: "owner", organization: createOrganization({ type: "personal", createdByUserId: user.id }) };
    const team: Membership = { role: input.teamRole ?? "owner", organization: createOrganization({ type: "team" }) };
    const memberships = input.withoutPersonalMembership ? [team] : [personal, team];

    const featureFlagsService = mock<FeatureFlagsService>({
      isEnabled: vi.fn(flag =>
        flag === FeatureFlags.ORGANIZATIONS ? input.organizationsOn ?? true : flag === FeatureFlags.ORGANIZATIONS_ENFORCE && !!input.enforceOn
      )
    });
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
      findActiveIdsGrantedTo: vi.fn().mockResolvedValue(input.grantedProjectIds ?? []),
      findActive: vi.fn().mockResolvedValue(undefined)
    });
    const personalOrganizationService = mock<PersonalOrganizationService>();
    const userRepository = mock<UserRepository>({ updateById: vi.fn().mockResolvedValue(undefined), updateBy: vi.fn().mockResolvedValue(undefined) });
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);

    const resolver = new OrganizationContextResolver(
      featureFlagsService,
      organizationMemberRepository,
      projectRepository,
      personalOrganizationService,
      userRepository,
      createLogger
    );

    return {
      resolver,
      user,
      personal,
      team,
      featureFlagsService,
      organizationMemberRepository,
      projectRepository,
      personalOrganizationService,
      userRepository,
      logger,
      createLogger
    };
  }
});
