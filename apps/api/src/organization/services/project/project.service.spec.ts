import { createMongoAbility } from "@casl/ability";
import { faker } from "@faker-js/faker";
import { PostgresError } from "postgres";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { organizationRules } from "@src/auth/services/ability/ability-rules";
import type { AuthService } from "@src/auth/services/auth.service";
import type { CreateLogger } from "@src/core/providers/logging.provider";
import type { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import type { TxService } from "@src/core/services/tx/tx.service";
import type { DeploymentRepository } from "@src/deployment/repositories/deployment/deployment.repository";
import type { DeploymentSettingRepository, OpenDeployment } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import type {
  ProjectDeploymentSummary,
  ProjectDeploymentSummaryService
} from "@src/deployment/services/project-deployment-summary/project-deployment-summary.service";
import { MAX_NUMBERED_SLUG_SUFFIX } from "@src/organization/lib/slug/slug";
import { PROJECT_NAME_UNIQUE_INDEX } from "@src/organization/model-schemas/project/project.schema";
import type { OrganizationConfig } from "@src/organization/providers/config.provider";
import type { OrganizationRepository } from "@src/organization/repositories/organization/organization.repository";
import type { ProjectRepository, ProjectWithCreator, ProjectWithLastActivity } from "@src/organization/repositories/project/project.repository";
import type { OrganizationActivityService } from "@src/organization/services/organization-activity/organization-activity.service";
import type { OrganizationContext } from "@src/organization/types/organization-context";
import { PROJECT_LIMIT_REACHED_ERROR_CODE, ProjectService } from "./project.service";

import { createAkashAddress } from "@test/seeders/akash-address.seeder";
import { createOrganization, createProject } from "@test/seeders/organization.seeder";
import { createOrganizationContext, createProjectsScope } from "@test/seeders/organization-context.seeder";
import { createUser } from "@test/seeders/user.seeder";

describe(ProjectService.name, () => {
  describe("list", () => {
    it("lists the projects the caller may read with their deployments, last activity and the caller's access", async () => {
      const context = createOrganizationContext({ role: "owner" });
      const project = listedProject({ organizationId: context.organizationId, createdAt: new Date("2026-10-01"), lastActivityAt: new Date("2026-10-10") });
      const summary = { activeCount: 1, preview: [{ dseq: "42", name: "web", status: "running" as const }] };
      const { service, projectRepository, projectDeploymentSummaryService, ability } = setup({
        context,
        ability: abilityOf(context),
        listed: [project],
        summaries: new Map([[project.id, summary]])
      });

      const projects = await service.list();

      expect(projects).toEqual([{ ...project, lastActivityAt: new Date("2026-10-10"), deployments: summary, access: { canDeploy: true, canManage: true } }]);
      expect(projectRepository.accessibleBy).toHaveBeenCalledWith(ability, "read");
      expect(projectDeploymentSummaryService.summarizeByProject).toHaveBeenCalledWith(context.organizationId);
    });

    it("orders the projects by their last activity, then newest first, then by id", async () => {
      const context = createOrganizationContext();
      const at = (day: string) => new Date(`2026-10-${day}`);
      const inOrganization = { organizationId: context.organizationId };
      const active = listedProject({ ...inOrganization, createdAt: at("01"), lastActivityAt: at("12") });
      const [older, newer] = [listedProject({ ...inOrganization, createdAt: at("02") }), listedProject({ ...inOrganization, createdAt: at("03") })];
      const [first, second] = [
        listedProject({ ...inOrganization, id: "00000000-0000-4000-8000-000000000001", createdAt: at("02") }),
        listedProject({ ...inOrganization, id: "00000000-0000-4000-8000-000000000002", createdAt: at("02") })
      ];
      const { service } = setup({ context, ability: abilityOf(context), listed: [second, older, newer, first, active] });

      const projects = await service.list();

      expect(projects.map(({ id }) => id)).toEqual([active.id, newer.id, ...[older, first, second].map(({ id }) => id).sort()]);
    });

    it("dates a project nothing happened in since its creation by its creation", async () => {
      const context = createOrganizationContext();
      const createdAt = new Date("2026-10-05");
      const { service } = setup({
        context,
        ability: abilityOf(context),
        listed: [
          listedProject({ organizationId: context.organizationId, createdAt, lastActivityAt: null }),
          listedProject({ organizationId: context.organizationId, createdAt, lastActivityAt: new Date("2026-10-04") })
        ]
      });

      const projects = await service.list();

      expect(projects.map(({ lastActivityAt }) => lastActivityAt)).toEqual([createdAt, createdAt]);
    });

    it("tells a billing member nothing of what runs or happens in the projects it cannot open, and no right in them", async () => {
      const context = createOrganizationContext({ role: "billing", projectScope: createProjectsScope([]) });
      const createdAt = new Date("2026-10-01");
      const project = listedProject({ organizationId: context.organizationId, createdAt, lastActivityAt: new Date("2026-10-10") });
      const { service } = setup({
        context,
        ability: abilityOf(context),
        listed: [project],
        summaries: new Map([[project.id, { activeCount: 3, preview: [] }]])
      });

      const [listed] = await service.list();

      expect(listed).toMatchObject({ lastActivityAt: createdAt, deployments: null, access: { canDeploy: false, canManage: false } });
    });

    it("lets a member deploy into the projects it writes to and manage only those it administers", async () => {
      const [administered, written, viewed] = [faker.string.uuid(), faker.string.uuid(), faker.string.uuid()];
      const context = createOrganizationContext({
        role: "member",
        projectScope: createProjectsScope([administered, written, viewed], { writableProjectIds: [administered, written], adminProjectIds: [administered] })
      });
      const { service } = setup({
        context,
        ability: abilityOf(context),
        listed: [administered, written, viewed].map((id, index) =>
          listedProject({ id, organizationId: context.organizationId, createdAt: new Date(2026, 9, 3 - index) })
        )
      });

      const projects = await service.list();

      expect(projects.map(({ access }) => access)).toEqual([
        { canDeploy: true, canManage: true },
        { canDeploy: true, canManage: false },
        { canDeploy: false, canManage: false }
      ]);
      expect(projects.map(({ deployments }) => deployments)).toEqual([0, 1, 2].map(() => ({ activeCount: 0, preview: [] })));
    });

    it("lets a key bound to a project deploy into it but not manage it", async () => {
      const projectId = faker.string.uuid();
      const context = createOrganizationContext({ role: "owner", projectScope: createProjectsScope([projectId], { adminProjectIds: [projectId] }) });
      const project = listedProject({ id: projectId, organizationId: context.organizationId });
      const { service } = setup({ context, ability: abilityOf(context, { projectId }), listed: [project] });

      const [listed] = await service.list();

      expect(listed.access).toEqual({ canDeploy: true, canManage: false });
    });

    it("shows no deployments of any project when too many are open to count", async () => {
      const context = createOrganizationContext();
      const { service } = setup({
        context,
        ability: abilityOf(context),
        listed: [listedProject({ organizationId: context.organizationId })],
        summaries: undefined
      });

      const [listed] = await service.list();

      expect(listed.deployments).toBeNull();
    });

    it("reads no deployment when the caller reaches no project", async () => {
      const context = createOrganizationContext({ role: "member", projectScope: createProjectsScope([]) });
      const { service, projectDeploymentSummaryService } = setup({ context, ability: abilityOf(context), listed: [] });

      const projects = await service.list();

      expect(projects).toEqual([]);
      expect(projectDeploymentSummaryService.summarizeByProject).not.toHaveBeenCalled();
    });
  });

  describe("get", () => {
    it("returns the active project with this id the caller may read", async () => {
      const { service, projectRepository, ability, project } = setup();

      const found = await service.get(project.id);

      expect(found).toEqual(project);
      expect(projectRepository.accessibleBy).toHaveBeenCalledWith(ability, "read");
      expect(projectRepository.findActiveWithCreator).toHaveBeenCalledWith({ id: project.id });
    });

    it("answers not found when the caller may read no such project", async () => {
      const { service, projectRepository } = setup();
      projectRepository.findActiveWithCreator.mockResolvedValue([]);

      await expect(service.get(faker.string.uuid())).rejects.toMatchObject({ status: 404 });
    });
  });

  describe("create", () => {
    it("files the project into the active organization under the first free slug of its name and records it in the same transaction", async () => {
      const { service, projectRepository, organizationActivityService, txService, ability, user, context } = setup();
      const created = createProject({ organizationId: context.organizationId, name: "Checkout API", slug: "checkout-api" });
      projectRepository.createWithFirstFreeSlug.mockResolvedValue(created);
      txService.transaction.mockImplementation(async callback => {
        const result = await callback();
        expect(organizationActivityService.record).toHaveBeenCalled();
        return result;
      });

      const project = await service.create({ name: "Checkout API", description: "Storefront" });

      expect(projectRepository.accessibleBy).toHaveBeenCalledWith(ability, "create");
      expect(projectRepository.createWithFirstFreeSlug).toHaveBeenCalledWith(
        { organizationId: context.organizationId, name: "Checkout API", description: "Storefront", createdByUserId: user.id },
        expect.any(Array)
      );
      expect(slugsTried(projectRepository).slice(0, 2)).toEqual(["checkout-api", "checkout-api-2"]);
      expect(slugsTried(projectRepository)).toHaveLength(MAX_NUMBERED_SLUG_SUFFIX + 1);
      expect(organizationActivityService.record).toHaveBeenCalledWith({
        organizationId: context.organizationId,
        type: "project_created",
        actorUserId: user.id,
        projectId: created.id,
        payload: { projectName: "Checkout API" }
      });
      expect(project).toEqual({ ...created, createdBy: { id: user.id, username: user.username } });
    });

    it("gives a name without a latin letter or digit a generated slug", async () => {
      const { service, projectRepository } = setup();

      await service.create({ name: "プロジェクト" });

      expect(slugsTried(projectRepository)[0]).toMatch(/^project-[0-9a-f]{8}$/);
    });

    it.each([undefined, ""])("stores a project created with the description %j as having none", async description => {
      const { service, projectRepository } = setup();

      await service.create({ name: "web", description });

      expect(projectRepository.createWithFirstFreeSlug).toHaveBeenCalledWith(expect.objectContaining({ description: null }), expect.any(Array));
    });

    it("names no username for a creator who has none", async () => {
      const { service } = setup({ username: null });

      const project = await service.create({ name: "web" });

      expect(project.createdBy).toEqual({ id: expect.any(String), username: null });
    });

    it("refuses a name another live project of the organization already has", async () => {
      const { service, projectRepository, organizationActivityService } = setup();
      projectRepository.createWithFirstFreeSlug.mockRejectedValue(createUniqueViolation(PROJECT_NAME_UNIQUE_INDEX));

      await expect(service.create({ name: "web" })).rejects.toMatchObject({ status: 409, errorCode: "project_name_taken" });
      expect(organizationActivityService.record).not.toHaveBeenCalled();
    });

    it("passes on any other failure to write the project", async () => {
      const { service, projectRepository } = setup();
      const failure = createUniqueViolation("projects_organization_id_id_unique");
      projectRepository.createWithFirstFreeSlug.mockRejectedValue(failure);

      await expect(service.create({ name: "web" })).rejects.toBe(failure);
    });

    it("fails without recording anything when every slug candidate is taken", async () => {
      const { service, projectRepository, organizationActivityService } = setup();
      projectRepository.createWithFirstFreeSlug.mockResolvedValue(undefined);

      await expect(service.create({ name: "web" })).rejects.toThrow("Every slug candidate for the project is taken");
      expect(organizationActivityService.record).not.toHaveBeenCalled();
    });

    it("refuses a request that runs in no organization", async () => {
      const { service, projectRepository } = setup({ context: null });

      await expect(service.create({ name: "web" })).rejects.toMatchObject({ status: 403 });
      expect(projectRepository.createWithFirstFreeSlug).not.toHaveBeenCalled();
    });

    it("locks the organization before writing the project, then counts its live projects before recording anything", async () => {
      const { service, organizationRepository, projectRepository, organizationActivityService, txService, context } = setup();

      await service.create({ name: "web" });

      expect(organizationRepository.findOneByAndLock).toHaveBeenCalledWith({ id: context.organizationId, deletedAt: null }, { strength: "no key update" });
      expect(projectRepository.count).toHaveBeenCalledWith({ organizationId: context.organizationId, deletedAt: null });
      const [transaction] = txService.transaction.mock.invocationCallOrder;
      const [lock] = organizationRepository.findOneByAndLock.mock.invocationCallOrder;
      const [write] = projectRepository.createWithFirstFreeSlug.mock.invocationCallOrder;
      const [count] = projectRepository.count.mock.invocationCallOrder;
      const [record] = organizationActivityService.record.mock.invocationCallOrder;
      expect(transaction).toBeLessThan(lock);
      expect(lock).toBeLessThan(write);
      expect(write).toBeLessThan(count);
      expect(count).toBeLessThan(record);
    });

    it("creates the project that brings the organization to its limit", async () => {
      const { service, project } = setup({ projectLimit: 10, liveProjectCount: 10 });

      await expect(service.create({ name: "web" })).resolves.toMatchObject({ id: project.id });
    });

    it("refuses a project past the organization's limit, with the limit, without recording it", async () => {
      const { service, organizationActivityService, logger, context } = setup({ projectLimit: 10, liveProjectCount: 11 });

      await expect(service.create({ name: "web" })).rejects.toMatchObject({
        status: 403,
        errorCode: PROJECT_LIMIT_REACHED_ERROR_CODE,
        message: "The organization has reached the number of projects it can have",
        data: { limit: 10 }
      });
      expect(logger.info).toHaveBeenCalledWith({ event: "PROJECT_LIMIT_REACHED", organizationId: context.organizationId, limit: 10 });
      expect(organizationActivityService.record).not.toHaveBeenCalled();
    });

    it("applies the configured limit", async () => {
      const atLimit = setup({ projectLimit: 3, liveProjectCount: 3 });
      const pastLimit = setup({ projectLimit: 3, liveProjectCount: 4 });

      await expect(atLimit.service.create({ name: "web" })).resolves.toMatchObject({ id: atLimit.project.id });
      await expect(pastLimit.service.create({ name: "web" })).rejects.toMatchObject({ errorCode: PROJECT_LIMIT_REACHED_ERROR_CODE, data: { limit: 3 } });
    });
  });

  it("creates its logger under its own name", () => {
    const { createLogger } = setup();

    expect(createLogger).toHaveBeenCalledWith({ context: ProjectService.name });
  });

  describe("update", () => {
    it("renames an active project without touching its slug, then returns it as the caller reads it", async () => {
      const { service, projectRepository, ability, project } = setup();

      const updated = await service.update(project.id, { name: "Checkout API" });

      expect(projectRepository.accessibleBy).toHaveBeenCalledWith(ability, "update");
      expect(projectRepository.updateBy).toHaveBeenCalledWith({ id: project.id, deletedAt: null }, { name: "Checkout API" }, { returning: true });
      expect(projectRepository.findActiveWithCreator).toHaveBeenCalledWith({ id: project.id });
      expect(updated).toEqual(project);
    });

    it("changes only the description when the request names no new name", async () => {
      const { service, projectRepository, project } = setup();

      await service.update(project.id, { description: "Storefront" });

      expect(projectRepository.updateBy).toHaveBeenCalledWith(expect.anything(), { description: "Storefront" }, { returning: true });
    });

    it.each([null, ""])("clears the description when the request sets it to %j", async description => {
      const { service, projectRepository, project } = setup();

      await service.update(project.id, { description });

      expect(projectRepository.updateBy).toHaveBeenCalledWith(expect.anything(), { description: null }, { returning: true });
    });

    it("answers not found when no active project with this id is within the caller's rules", async () => {
      const { service, projectRepository } = setup();
      projectRepository.updateBy.mockResolvedValue(undefined);

      await expect(service.update(faker.string.uuid(), { name: "web" })).rejects.toMatchObject({ status: 404 });
    });

    it("refuses a new name another live project of the organization already has", async () => {
      const { service, projectRepository, project } = setup();
      projectRepository.updateBy.mockRejectedValue(createUniqueViolation(PROJECT_NAME_UNIQUE_INDEX));

      await expect(service.update(project.id, { name: "web" })).rejects.toMatchObject({ status: 409, errorCode: "project_name_taken" });
    });
  });

  describe("delete", () => {
    it("marks a project holding no open deployment deleted, inside the transaction that locked it", async () => {
      const { service, projectRepository, deploymentSettingRepository, txService, ability, project } = setup();
      txService.transaction.mockImplementation(async callback => {
        const result = await callback();
        expect(projectRepository.updateById).toHaveBeenCalled();
        return result;
      });

      await service.delete(project.id);

      expect(projectRepository.accessibleBy).toHaveBeenCalledWith(ability, "delete");
      expect(projectRepository.findOneBy).toHaveBeenCalledWith({ id: project.id, deletedAt: null });
      expect(projectRepository.findOneByAndLock).toHaveBeenCalledWith({ id: project.id, deletedAt: null });
      expect(deploymentSettingRepository.findOpenInProject).toHaveBeenCalledWith({ organizationId: project.organizationId, projectId: project.id });
      expect(deploymentSettingRepository.count).toHaveBeenCalledWith({ organizationId: project.organizationId, projectId: project.id, closed: false });
      expect(projectRepository.updateById).toHaveBeenCalledWith(project.id, { deletedAt: expect.any(Date) });
    });

    it("closes the deployments the chain reports closed before deciding the project is empty", async () => {
      const paddedDseq = createOpenDeployment({ dseq: "000123" });
      const unpadded = createOpenDeployment();
      const { service, projectRepository, deploymentSettingRepository, deploymentRepository, project } = setup({ openDeployments: [paddedDseq, unpadded] });
      deploymentRepository.findClosureStates.mockResolvedValue([
        { owner: paddedDseq.address, dseq: "123", isClosed: true },
        { owner: unpadded.address, dseq: unpadded.dseq, isClosed: true }
      ]);

      await service.delete(project.id);

      expect(deploymentRepository.findClosureStates).toHaveBeenCalledWith([
        { owner: paddedDseq.address, dseq: "123" },
        { owner: unpadded.address, dseq: unpadded.dseq }
      ]);
      expect(deploymentSettingRepository.markAsClosedInProject).toHaveBeenCalledWith({ organizationId: project.organizationId, projectId: project.id }, [
        paddedDseq.id,
        unpadded.id
      ]);
      expect(projectRepository.updateById).toHaveBeenCalled();
    });

    it("refuses while a deployment is still open on chain, after closing the ones it found closed outside the transaction", async () => {
      const closedOnChain = createOpenDeployment();
      const openOnChain = createOpenDeployment();
      const unindexed = createOpenDeployment();
      const { service, projectRepository, deploymentSettingRepository, deploymentRepository, txService, project } = setup({
        openDeployments: [closedOnChain, openOnChain, unindexed]
      });
      deploymentRepository.findClosureStates.mockResolvedValue([
        { owner: closedOnChain.address, dseq: closedOnChain.dseq, isClosed: true },
        { owner: openOnChain.address, dseq: openOnChain.dseq, isClosed: false }
      ]);
      deploymentSettingRepository.count.mockResolvedValue(2);
      let inTransaction = false;
      txService.transaction.mockImplementation(async callback => {
        inTransaction = true;
        try {
          return await callback();
        } finally {
          inTransaction = false;
        }
      });
      const closedInTransaction = vi.fn();
      deploymentSettingRepository.markAsClosedInProject.mockImplementation(async () => closedInTransaction(inTransaction));

      await expect(service.delete(project.id)).rejects.toMatchObject({ status: 409, errorCode: "project_not_empty" });
      expect(deploymentSettingRepository.markAsClosedInProject).toHaveBeenCalledWith({ organizationId: project.organizationId, projectId: project.id }, [
        closedOnChain.id
      ]);
      expect(closedInTransaction).toHaveBeenCalledWith(false);
      expect(projectRepository.updateById).not.toHaveBeenCalled();
    });

    it("answers not found when no active project with this id is within the caller's rules", async () => {
      const { service, projectRepository, deploymentSettingRepository, txService } = setup();
      projectRepository.findOneBy.mockResolvedValue(undefined);

      await expect(service.delete(faker.string.uuid())).rejects.toMatchObject({ status: 404 });
      expect(deploymentSettingRepository.findOpenInProject).not.toHaveBeenCalled();
      expect(txService.transaction).not.toHaveBeenCalled();
    });

    it("refuses to delete the default project", async () => {
      const { service, projectRepository, deploymentSettingRepository, txService, project } = setup();
      projectRepository.findOneBy.mockResolvedValue({ ...project, isDefault: true });

      await expect(service.delete(project.id)).rejects.toMatchObject({ status: 409, errorCode: "project_is_default" });
      expect(deploymentSettingRepository.findOpenInProject).not.toHaveBeenCalled();
      expect(txService.transaction).not.toHaveBeenCalled();
    });

    it("answers not found when the project is deleted before the transaction locks it", async () => {
      const { service, projectRepository, deploymentSettingRepository, project } = setup();
      projectRepository.findOneByAndLock.mockResolvedValue(undefined);

      await expect(service.delete(project.id)).rejects.toMatchObject({ status: 404 });
      expect(deploymentSettingRepository.count).not.toHaveBeenCalled();
      expect(projectRepository.updateById).not.toHaveBeenCalled();
    });

    it("refuses when the project became the default before the transaction locks it", async () => {
      const { service, projectRepository, project } = setup();
      projectRepository.findOneByAndLock.mockResolvedValue({ ...project, isDefault: true });

      await expect(service.delete(project.id)).rejects.toMatchObject({ status: 409, errorCode: "project_is_default" });
      expect(projectRepository.updateById).not.toHaveBeenCalled();
    });
  });

  function slugsTried(projectRepository: ReturnType<typeof setup>["projectRepository"]) {
    return projectRepository.createWithFirstFreeSlug.mock.calls[0][1];
  }

  function createOpenDeployment(overrides: Partial<OpenDeployment> = {}): OpenDeployment {
    return {
      id: faker.string.uuid(),
      userId: faker.string.uuid(),
      dseq: faker.string.numeric({ length: 7, allowLeadingZeros: false }),
      address: createAkashAddress(),
      createdAt: faker.date.recent(),
      ...overrides
    };
  }

  function createUniqueViolation(constraintName: string) {
    const driverError = Object.assign(Object.create(PostgresError.prototype), {
      name: "PostgresError",
      code: "23505",
      constraint_name: constraintName,
      message: `duplicate key value violates unique constraint "${constraintName}"`
    });

    return new Error("Failed query: insert into projects", { cause: driverError });
  }

  function listedProject(overrides: Partial<ProjectWithLastActivity> = {}): ProjectWithLastActivity {
    return { ...createProject(overrides), createdBy: null, lastActivityAt: null, ...overrides };
  }

  function abilityOf(context: OrganizationContext, apiKey?: { projectId: string }) {
    return createMongoAbility(organizationRules(createUser(), context, apiKey));
  }

  function setup(
    input: {
      context?: OrganizationContext | null;
      username?: string | null;
      openDeployments?: OpenDeployment[];
      projectLimit?: number;
      liveProjectCount?: number;
      ability?: AuthService["ability"];
      listed?: ProjectWithLastActivity[];
      summaries?: Map<string, ProjectDeploymentSummary>;
    } = {}
  ) {
    const user = createUser({ username: input.username === undefined ? faker.internet.userName() : input.username });
    const context = input.context === undefined ? createOrganizationContext() : input.context;
    const ability = input.ability ?? mock<AuthService["ability"]>();
    const project: ProjectWithCreator = { ...createProject({ organizationId: context?.organizationId }), createdBy: { id: user.id, username: user.username } };
    const projectRepository = mock<ProjectRepository>({
      findActiveWithCreator: vi.fn().mockResolvedValue([project]),
      findActiveWithLastActivity: vi.fn().mockResolvedValue(input.listed ?? []),
      createWithFirstFreeSlug: vi.fn().mockResolvedValue(project),
      updateBy: vi.fn().mockResolvedValue(project),
      findOneBy: vi.fn().mockResolvedValue(project),
      findOneByAndLock: vi.fn().mockResolvedValue(project),
      count: vi.fn().mockResolvedValue(input.liveProjectCount ?? 1)
    });
    projectRepository.accessibleBy.mockReturnValue(projectRepository);
    const organizationRepository = mock<OrganizationRepository>({
      findOneByAndLock: vi.fn().mockResolvedValue(createOrganization({ id: context?.organizationId }))
    });
    const deploymentSettingRepository = mock<DeploymentSettingRepository>({
      findOpenInProject: vi.fn().mockResolvedValue(input.openDeployments ?? []),
      count: vi.fn().mockResolvedValue(0)
    });
    const deploymentRepository = mock<DeploymentRepository>({ findClosureStates: vi.fn().mockResolvedValue([]) });
    const projectDeploymentSummaryService = mock<ProjectDeploymentSummaryService>();
    projectDeploymentSummaryService.summarizeByProject.mockResolvedValue("summaries" in input ? input.summaries : new Map());
    const organizationActivityService = mock<OrganizationActivityService>();
    const authService = mock<AuthService>({ currentUser: user });
    authService.ability = ability;
    const executionContextService = mock<ExecutionContextService>();
    executionContextService.get.mockImplementation(((key: string) =>
      key === "ORGANIZATION_CONTEXT" ? context ?? undefined : undefined) as ExecutionContextService["get"]);
    const txService = mock<TxService>({ transaction: vi.fn(callback => callback()) });
    const config: OrganizationConfig = { TEAM_ORGANIZATIONS_PER_USER_LIMIT: 3, PROJECTS_PER_ORGANIZATION_LIMIT: input.projectLimit ?? 10 };
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);

    const service = new ProjectService(
      projectRepository,
      organizationRepository,
      deploymentSettingRepository,
      deploymentRepository,
      projectDeploymentSummaryService,
      organizationActivityService,
      authService,
      executionContextService,
      txService,
      config,
      createLogger
    );

    return {
      service,
      projectRepository,
      organizationRepository,
      logger,
      createLogger,
      deploymentSettingRepository,
      deploymentRepository,
      projectDeploymentSummaryService,
      organizationActivityService,
      txService,
      ability,
      user,
      context: context!,
      project
    };
  }
});
