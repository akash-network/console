import { createMongoAbility } from "@casl/ability";
import { faker } from "@faker-js/faker";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ApiKeyOutput } from "@src/auth/repositories/api-key/api-key.repository";
import type { AuthService } from "@src/auth/services/auth.service";
import type { WalletInitializerService } from "@src/billing/services/wallet-initializer/wallet-initializer.service";
import type { CreateLogger } from "@src/core/providers/logging.provider";
import type { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import type { TxService } from "@src/core/services/tx/tx.service";
import { PERSONAL_ORGANIZATION_SLUG_PREFIX } from "@src/organization/lib/personal-organization/personal-organization";
import { MAX_NUMBERED_SLUG_SUFFIX } from "@src/organization/lib/slug/slug";
import type { OrganizationOutput, OrganizationRepository } from "@src/organization/repositories/organization/organization.repository";
import type { OrganizationMemberRepository } from "@src/organization/repositories/organization-member/organization-member.repository";
import type { ProjectRepository } from "@src/organization/repositories/project/project.repository";
import type { OrganizationContext } from "@src/organization/types/organization-context";
import {
  FALLBACK_ORGANIZATION_SLUG_PREFIX,
  MAX_TEAM_ORGANIZATIONS_PER_USER,
  ORGANIZATION_LIMIT_REACHED_ERROR_CODE,
  ORGANIZATION_NAME_TAKEN_ERROR_CODE,
  PERSONAL_ORGANIZATION_ERROR_CODE,
  TEAM_SLUG_PREFIX,
  TeamOrganizationService } from "./team-organization.service";

import { createApiKey } from "@test/seeders/api-key.seeder";
import { createOrganization, createOrganizationMember, createProject } from "@test/seeders/organization.seeder";
import { createOrganizationContext } from "@test/seeders/organization-context.seeder";
import { createUser } from "@test/seeders/user.seeder";
import { createOrganizationWallet } from "@test/seeders/user-wallet.seeder";

describe(TeamOrganizationService.name, () => {
  describe("create", () => {
    it("files the caller as owner of a new team organization with a default project and a wallet", async () => {
      const { service, user, organization, organizationRepository, organizationMemberRepository, projectRepository, walletInitializerService } = setup();

      const created = await service.create("Acme Corp");

      expect(created).toEqual({ role: "owner", organization, isActive: false });
      expect(organizationRepository.createTeamWithFirstFreeSlug).toHaveBeenCalledWith(
        { name: "Acme Corp", createdByUserId: user.id },
        expect.arrayContaining(["acme-corp", "acme-corp-2"])
      );
      expect(organizationMemberRepository.unscoped).toHaveBeenCalledWith("organization-creation");
      expect(organizationMemberRepository.create).toHaveBeenCalledWith({ organizationId: organization.id, userId: user.id, role: "owner" });
      expect(projectRepository.unscoped).toHaveBeenCalledWith("organization-creation");
      expect(projectRepository.createDefaultUnlessExists).toHaveBeenCalledWith({ organizationId: organization.id, createdByUserId: user.id });
      expect(walletInitializerService.ensureTeamWallet).toHaveBeenCalledWith(organization, user.id);
    });

    it("locks the caller, then checks the limit and the name before writing anything, all in one transaction", async () => {
      const { service, user, txService, organizationRepository, organizationMemberRepository, walletInitializerService, calls } = setup();

      await service.create("Acme Corp");

      expect(txService.transaction).toHaveBeenCalledTimes(1);
      expect(organizationRepository.lockUserForOrganizationChanges).toHaveBeenCalledWith(user.id);
      expect(organizationRepository.countTeamsCreatedBy).toHaveBeenCalledWith(user.id);
      expect(organizationMemberRepository.isMemberOfOrganizationNamed).toHaveBeenCalledWith(user.id, "Acme Corp", undefined);
      expect(calls).toEqual([
        "transaction:start",
        "lockUserForOrganizationChanges",
        "countTeamsCreatedBy",
        "isMemberOfOrganizationNamed",
        "createTeamWithFirstFreeSlug",
        "createMembership",
        "createDefaultProject",
        "ensureTeamWallet",
        "transaction:end"
      ]);
      expect(walletInitializerService.ensureTeamWallet).toHaveBeenCalledTimes(1);
    });

    it("logs the created organization", async () => {
      const { service, user, organization, logger } = setup();

      await service.create("Acme Corp");

      expect(logger.info).toHaveBeenCalledWith({ event: "TEAM_ORGANIZATION_CREATED", userId: user.id, organizationId: organization.id });
    });

    it("lets a caller create one more organization while under the limit", async () => {
      const { service, organization } = setup({ createdTeamCount: MAX_TEAM_ORGANIZATIONS_PER_USER - 1 });

      await expect(service.create("Acme Corp")).resolves.toMatchObject({ organization });
    });

    it("refuses a caller who reached the limit, without writing anything", async () => {
      const { service, user, organizationRepository, organizationMemberRepository, logger } = setup({ createdTeamCount: MAX_TEAM_ORGANIZATIONS_PER_USER });

      await expect(service.create("Acme Corp")).rejects.toMatchObject({ status: 403, errorCode: ORGANIZATION_LIMIT_REACHED_ERROR_CODE, message: "You have reached the number of organizations you can create" });
      expect(logger.info).toHaveBeenCalledWith({ event: "ORGANIZATION_LIMIT_REACHED", userId: user.id });
      expect(organizationMemberRepository.isMemberOfOrganizationNamed).not.toHaveBeenCalled();
      expect(organizationRepository.createTeamWithFirstFreeSlug).not.toHaveBeenCalled();
    });

    it("refuses a name the caller already uses for another organization, without writing anything", async () => {
      const { service, organizationRepository, logger } = setup({ nameTaken: true });

      await expect(service.create("Acme Corp")).rejects.toMatchObject({ status: 409, errorCode: ORGANIZATION_NAME_TAKEN_ERROR_CODE, message: "You already belong to an organization with this name" });
      expect(organizationRepository.createTeamWithFirstFreeSlug).not.toHaveBeenCalled();
      expect(logger.info).not.toHaveBeenCalled();
    });

    it("prefixes the slug of a name that reads as an id, so the slug never does", async () => {
      const { service, organizationRepository } = setup();
      const name = faker.string.uuid();

      await service.create(name);

      const [, slugs] = organizationRepository.createTeamWithFirstFreeSlug.mock.calls[0];
      expect(slugs[0]).toBe(`${TEAM_SLUG_PREFIX}-${name}`.slice(0, 40));
      expect(slugs).toHaveLength(MAX_NUMBERED_SLUG_SUFFIX + 1);
    });

    it("prefixes the slug of a name shaped like a personal organization's slug", async () => {
      const { service, organizationRepository } = setup();

      await service.create("Personal 0f1e2d3c4b5a");

      const [, slugs] = organizationRepository.createTeamWithFirstFreeSlug.mock.calls[0];
      expect(slugs[0]).toBe(`${TEAM_SLUG_PREFIX}-personal-0f1e2d3c4b5a`);
      expect(slugs.every(slug => !slug.startsWith(PERSONAL_ORGANIZATION_SLUG_PREFIX))).toBe(true);
    });

    it("keeps a name that only starts with the personal word", async () => {
      const { service, organizationRepository } = setup();

      await service.create("Personalized Labs");

      const [, slugs] = organizationRepository.createTeamWithFirstFreeSlug.mock.calls[0];
      expect(slugs[0]).toBe("personalized-labs");
    });

    it("tries a bounded number of slugs, the last one random, for any name", async () => {
      const { service, organizationRepository } = setup();

      await service.create("Acme Corp");

      const [, slugs] = organizationRepository.createTeamWithFirstFreeSlug.mock.calls[0];
      expect(slugs).toHaveLength(MAX_NUMBERED_SLUG_SUFFIX + 1);
      expect(slugs[MAX_NUMBERED_SLUG_SUFFIX]).toMatch(/^acme-corp-[0-9a-f]{8}$/);
    });

    it("gives a name without a latin letter or digit a slug from the fallback prefix", async () => {
      const { service, organizationRepository } = setup();

      await service.create("株式会社");

      const [, slugs] = organizationRepository.createTeamWithFirstFreeSlug.mock.calls[0];
      expect(slugs[0]).toMatch(new RegExp(`^${FALLBACK_ORGANIZATION_SLUG_PREFIX}-[0-9a-f]{8}$`));
    });

    it("fails without filing a member, project or wallet when every slug is taken", async () => {
      const { service, organizationRepository, organizationMemberRepository, projectRepository, walletInitializerService } = setup();
      organizationRepository.createTeamWithFirstFreeSlug.mockResolvedValue(undefined);

      await expect(service.create("Acme Corp")).rejects.toThrow("Every slug candidate for the organization is taken");
      expect(organizationMemberRepository.create).not.toHaveBeenCalled();
      expect(projectRepository.createDefaultUnlessExists).not.toHaveBeenCalled();
      expect(walletInitializerService.ensureTeamWallet).not.toHaveBeenCalled();
    });

    it("fails the whole creation when the wallet cannot be provisioned", async () => {
      const { service, walletInitializerService, logger } = setup();
      walletInitializerService.ensureTeamWallet.mockRejectedValue(new Error("derivation failed"));

      await expect(service.create("Acme Corp")).rejects.toThrow("derivation failed");
      expect(logger.info).not.toHaveBeenCalled();
    });
  });

  describe("rename", () => {
    it("renames the active organization through the caller's update rules and answers it as active", async () => {
      const context = createOrganizationContext({ organizationType: "team", role: "admin" });
      const renamed = createOrganization({ id: context.organizationId, name: "Acme Labs" });
      const { service, ability, organizationRepository } = setup({ context, renamed });

      const result = await service.rename(context.organizationId, "Acme Labs");

      expect(result).toEqual({ role: "admin", organization: renamed, isActive: true });
      expect(organizationRepository.accessibleBy).toHaveBeenCalledWith(ability, "update");
      expect(organizationRepository.updateBy).toHaveBeenCalledWith({ id: context.organizationId, deletedAt: null }, { name: "Acme Labs" }, { returning: true });
    });

    it("locks the caller and checks the name against their other organizations in the transaction that renames", async () => {
      const context = createOrganizationContext({ organizationType: "team" });
      const { service, user, organizationRepository, organizationMemberRepository, calls } = setup({ context });

      await service.rename(context.organizationId, "Acme Labs");

      expect(organizationRepository.lockUserForOrganizationChanges).toHaveBeenCalledWith(user.id);
      expect(organizationMemberRepository.isMemberOfOrganizationNamed).toHaveBeenCalledWith(user.id, "Acme Labs", context.organizationId);
      expect(calls).toEqual(["transaction:start", "lockUserForOrganizationChanges", "isMemberOfOrganizationNamed", "updateBy", "transaction:end"]);
    });

    it("refuses a name the caller already uses for another organization", async () => {
      const context = createOrganizationContext({ organizationType: "team" });
      const { service, organizationRepository } = setup({ context, nameTaken: true });

      await expect(service.rename(context.organizationId, "Acme Labs")).rejects.toMatchObject({ status: 409, errorCode: ORGANIZATION_NAME_TAKEN_ERROR_CODE });
      expect(organizationRepository.updateBy).not.toHaveBeenCalled();
    });

    it("answers not found for an organization other than the active one", async () => {
      const { service, txService } = setup({ context: createOrganizationContext({ organizationType: "team" }) });

      await expect(service.rename(faker.string.uuid(), "Acme Labs")).rejects.toMatchObject({ status: 404, message: "Organization not found" });
      expect(txService.transaction).not.toHaveBeenCalled();
    });

    it("answers not found when the request runs in no organization", async () => {
      const { service } = setup({ context: undefined });

      await expect(service.rename(faker.string.uuid(), "Acme Labs")).rejects.toMatchObject({ status: 404 });
    });

    it("refuses to rename a personal organization", async () => {
      const context = createOrganizationContext({ organizationType: "personal" });
      const { service, txService } = setup({ context });

      await expect(service.rename(context.organizationId, "Acme Labs")).rejects.toMatchObject({ status: 403, errorCode: PERSONAL_ORGANIZATION_ERROR_CODE, message: "A personal organization cannot be renamed" });
      expect(txService.transaction).not.toHaveBeenCalled();
    });

    it("refuses an API key limited to a project", async () => {
      const context = createOrganizationContext({ organizationType: "team" });
      const { service, txService } = setup({ context, apiKey: createApiKey({ organizationId: context.organizationId, projectId: faker.string.uuid() }) });

      await expect(service.rename(context.organizationId, "Acme Labs")).rejects.toMatchObject({
        status: 403,
        message: "An API key limited to a project cannot manage organizations"
      });
      expect(txService.transaction).not.toHaveBeenCalled();
    });

    it("accepts an API key bound to the organization but to no project", async () => {
      const context = createOrganizationContext({ organizationType: "team" });
      const { service, organization } = setup({ context, apiKey: createApiKey({ organizationId: context.organizationId, projectId: null }) });

      await expect(service.rename(context.organizationId, "Acme Labs")).resolves.toMatchObject({ organization });
    });

    it("answers not found when the organization was deleted meanwhile", async () => {
      const context = createOrganizationContext({ organizationType: "team" });
      const { service } = setup({ context, renamed: null });

      await expect(service.rename(context.organizationId, "Acme Labs")).rejects.toMatchObject({ status: 404, message: "Organization not found" });
    });
  });

  it("creates the logger with the service context", () => {
    const { createLogger } = setup();

    expect(createLogger).toHaveBeenCalledWith({ context: TeamOrganizationService.name });
  });

  function setup(
    input: {
      context?: OrganizationContext;
      apiKey?: ApiKeyOutput;
      createdTeamCount?: number;
      nameTaken?: boolean;
      renamed?: OrganizationOutput | null;
    } = {}
  ) {
    const calls: string[] = [];
    const user = createUser();
    const ability = createMongoAbility();
    const organization = createOrganization({ createdByUserId: user.id });
    const membership = createOrganizationMember({ organizationId: organization.id, userId: user.id, role: "owner" });
    const project = createProject({ organizationId: organization.id, isDefault: true });
    const wallet = createOrganizationWallet({ organizationId: organization.id });
    const context = "context" in input ? input.context : createOrganizationContext({ organizationType: "personal" });
    const authService = mock<AuthService>({ currentUser: user });
    authService.ability = ability;
    const organizationRepository = mock<OrganizationRepository>({
      updateBy: vi.fn(async () => {
        calls.push("updateBy");
        return input.renamed === null ? undefined : (input.renamed ?? organization);
      }) as OrganizationRepository["updateBy"]
    });
    organizationRepository.accessibleBy.mockReturnValue(organizationRepository);
    organizationRepository.lockUserForOrganizationChanges.mockImplementation(async () => {
      calls.push("lockUserForOrganizationChanges");
    });
    organizationRepository.countTeamsCreatedBy.mockImplementation(async () => {
      calls.push("countTeamsCreatedBy");
      return input.createdTeamCount ?? 0;
    });
    organizationRepository.createTeamWithFirstFreeSlug.mockImplementation(async () => {
      calls.push("createTeamWithFirstFreeSlug");
      return organization;
    });
    const organizationMemberRepository = mock<OrganizationMemberRepository>();
    organizationMemberRepository.unscoped.mockReturnValue(organizationMemberRepository);
    organizationMemberRepository.isMemberOfOrganizationNamed.mockImplementation(async () => {
      calls.push("isMemberOfOrganizationNamed");
      return input.nameTaken ?? false;
    });
    organizationMemberRepository.create.mockImplementation(async () => {
      calls.push("createMembership");
      return membership;
    });
    const projectRepository = mock<ProjectRepository>();
    projectRepository.unscoped.mockReturnValue(projectRepository);
    projectRepository.createDefaultUnlessExists.mockImplementation(async () => {
      calls.push("createDefaultProject");
      return project;
    });
    const walletInitializerService = mock<WalletInitializerService>();
    walletInitializerService.ensureTeamWallet.mockImplementation(async () => {
      calls.push("ensureTeamWallet");
      return wallet;
    });
    const executionContextService = mock<ExecutionContextService>();
    executionContextService.get.calledWith("ORGANIZATION_CONTEXT").mockReturnValue(context);
    executionContextService.get.calledWith("CURRENT_API_KEY").mockReturnValue(input.apiKey);
    const txService = mock<TxService>();
    txService.transaction.mockImplementation(async cb => {
      calls.push("transaction:start");
      const result = await cb();
      calls.push("transaction:end");
      return result;
    });
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);

    const service = new TeamOrganizationService(
      authService,
      organizationRepository,
      organizationMemberRepository,
      projectRepository,
      walletInitializerService,
      executionContextService,
      txService,
      createLogger
    );

    return {
      service,
      user,
      ability,
      organization,
      authService,
      organizationRepository,
      organizationMemberRepository,
      projectRepository,
      walletInitializerService,
      executionContextService,
      txService,
      logger,
      createLogger,
      calls
    };
  }
});
